import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { dataSourceError, errorFromUnknown } from "../../shared/structured-error.js";
import { listEnabledEventWorkflows, type AutomationWorkflowRecord } from "../automation/automation.repository.js";
import { recordPushAutomationPayload } from "../automation/automation.service.js";
import { listDataSources, updateDataSourceReadResult, type DataSourceRecord } from "./dataSources.repository.js";
import { parseGpioInputConfig, processGpioPayload, type GpioInputConfig } from "./dataSources.service.js";

type Watcher = {
  key: string;
  process: ChildProcessWithoutNullStreams;
  lastEventAt: number;
};

const watchers = new Map<string, Watcher>();

export function getGpioInputCapability() {
  const devicePath = "/dev/gpiochip0";
  const deviceAvailable = existsSync(devicePath);
  return {
    available: deviceAvailable,
    devicePath,
    reason: deviceAvailable ? null : `${devicePath} is not mounted in the backend container. Reinstall with ENABLE_GPIO=true or add a Docker Compose override.`
  };
}

export function startGpioIngestion() {
  syncGpioDataSources();
}

export function stopGpioIngestion() {
  for (const watcher of watchers.values()) {
    watcher.process.kill("SIGTERM");
  }
  watchers.clear();
}

export function syncGpioDataSources() {
  const gpioSources = new Map(listDataSources().filter((source) => source.type === "gpio-input").map((source) => [source.id, source]));
  const gpioWorkflows = new Map([...gpioSources.keys()].map((sourceId) => [sourceId, listEnabledEventWorkflows("gpio_event_start", sourceId)[0]]).filter((entry): entry is [string, AutomationWorkflowRecord] => Boolean(entry[1])));
  const activeIds = new Set(gpioWorkflows.keys());

  for (const [sourceId, watcher] of watchers.entries()) {
    if (!activeIds.has(sourceId)) {
      watcher.process.kill("SIGTERM");
      watchers.delete(sourceId);
    }
  }

  for (const [sourceId, workflow] of gpioWorkflows.entries()) {
    const source = gpioSources.get(sourceId)!;
    try {
      const config = parseGpioInputConfig(JSON.parse(source.config) as unknown);
      const key = `${workflow.id}|${workflow.updated_at}|${config.chip}|${config.pin}|${config.profile}|${config.pull}|${config.edge}|${config.debounceMs}|${config.activeState}`;
      const existing = watchers.get(source.id);
      if (existing?.key === key) continue;

      existing?.process.kill("SIGTERM");
      watchers.set(source.id, { key, process: watchGpioSource(source, workflow, config), lastEventAt: 0 });
    } catch (error) {
      updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "configuration_invalid", ...errorFromUnknown(error, "Invalid GPIO input source configuration", { sourceId: source.id }), message: error instanceof Error ? error.message : "Invalid GPIO input source configuration" }) });
    }
  }
}

function watchGpioSource(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: GpioInputConfig) {
  const child = spawn("stdbuf", ["-oL", "-eL", "gpiomon", ...gpiomonArgs(config)], { shell: false });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
      handleGpioLine(source, workflow, config, line).catch((error: Error) => {
        if ("code" in error && error.code === "WORKFLOW_ALREADY_RUNNING") return;
        console.error(`GPIO workflow ${workflow.id} failed for source ${source.id}: ${error.message}`);
      });
    }
  });

  child.stderr.on("data", (chunk: string) => {
    const message = chunk.trim();
    if (message) updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "hardware_unavailable", message: "GPIO watcher reported an error", nativeMessage: message, context: { sourceId: source.id, chip: config.chip, pin: config.pin } }) });
  });

  child.on("error", (error) => {
    updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "hardware_unavailable", ...errorFromUnknown(error, "GPIO watcher could not start", { sourceId: source.id, chip: config.chip, pin: config.pin }), message: "GPIO watcher could not start" }) });
  });

  child.on("exit", (code, signal) => {
    if (watchers.has(source.id)) updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "source_unavailable", message: "GPIO watcher stopped", nativeMessage: `GPIO watcher stopped (${signal ?? code ?? "unknown"})`, context: { sourceId: source.id, chip: config.chip, pin: config.pin } }) });
  });

  return child;
}

async function handleGpioLine(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: GpioInputConfig, line: string) {
  if (!listDataSources().some((current) => current.id === source.id)) return;

  const watcher = watchers.get(source.id);
  const now = Date.now();
  if (watcher && config.debounceMs > 0 && now - watcher.lastEventAt < config.debounceMs) return;
  if (watcher) watcher.lastEventAt = now;

  const edge = parseEdge(line);
  const state = edge === "falling" ? "low" : "high";
  const payload = {
    source: "gpio",
    chip: config.chip,
    pin: config.pin,
    profile: config.profile,
    numbering: "BCM",
    state,
    active: config.activeState === state,
    edge,
    event: config.profile === "pir-motion" ? edge === "falling" ? "motion_cleared" : "motion_detected" : "gpio_edge",
    pull: config.pull,
    debounceMs: config.debounceMs,
    timestamp: new Date().toISOString(),
    raw: line
  };
  const result = processGpioPayload(payload);
  await recordPushAutomationPayload({ workflow, dataSource: source, sourceUrl: sourceUrl(config), triggerType: "gpio", result });
}

function gpiomonArgs(config: GpioInputConfig) {
  const bias = config.pull === "up" ? "pull-up" : config.pull === "down" ? "pull-down" : "disable";
  const edgeArgs = config.edge === "rising" ? ["--rising-edge"] : config.edge === "falling" ? ["--falling-edge"] : [];
  return [...edgeArgs, "--num-events=0", `--bias=${bias}`, config.chip, String(config.pin)];
}

function parseEdge(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes("falling")) return "falling";
  return "rising";
}

function sourceUrl(config: GpioInputConfig) {
  return config.profile === "pir-motion" ? `PIR motion ${config.chip} GPIO${config.pin}` : `${config.chip} GPIO${config.pin}`;
}

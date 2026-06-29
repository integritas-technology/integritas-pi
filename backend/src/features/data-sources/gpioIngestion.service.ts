import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { listAutomationWorkflows, type AutomationWorkflowRecord } from "../automation/automation.repository.js";
import { recordPushAutomationError, recordPushAutomationPayload } from "../automation/automation.service.js";
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
  const gpioWorkflows = listAutomationWorkflows().filter((workflow) => workflow.enabled && gpioSources.has(workflow.data_source_id));
  const activeIds = new Set(gpioWorkflows.map((workflow) => workflow.data_source_id));

  for (const [sourceId, watcher] of watchers.entries()) {
    if (!activeIds.has(sourceId)) {
      watcher.process.kill("SIGTERM");
      watchers.delete(sourceId);
    }
  }

  for (const workflow of gpioWorkflows) {
    const source = gpioSources.get(workflow.data_source_id)!;
    try {
      const config = parseGpioInputConfig(JSON.parse(source.config) as unknown);
      const key = `${workflow.id}|${workflow.stamp_with_integritas}|${config.chip}|${config.pin}|${config.pull}|${config.edge}|${config.debounceMs}|${config.activeState}`;
      const existing = watchers.get(source.id);
      if (existing?.key === key) continue;

      existing?.process.kill("SIGTERM");
      watchers.set(source.id, { key, process: watchGpioSource(source, workflow, config), lastEventAt: 0 });
    } catch (error) {
      updateDataSourceReadResult(source.id, { error: error instanceof Error ? error.message : "Invalid GPIO input source configuration" });
    }
  }
}

function watchGpioSource(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: GpioInputConfig) {
  const child = spawn("gpiomon", gpiomonArgs(config), { shell: false });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
      handleGpioLine(source, workflow, config, line).catch((error: Error) => {
        recordPushAutomationError({ workflow, dataSource: source, sourceUrl: sourceUrl(config), triggerType: "gpio", error: error.message });
      });
    }
  });

  child.stderr.on("data", (chunk: string) => {
    const message = chunk.trim();
    if (message) updateDataSourceReadResult(source.id, { error: `GPIO watcher error: ${message}` });
  });

  child.on("error", (error) => {
    updateDataSourceReadResult(source.id, { error: `GPIO watcher could not start: ${error.message}` });
  });

  child.on("exit", (code, signal) => {
    if (watchers.has(source.id)) updateDataSourceReadResult(source.id, { error: `GPIO watcher stopped (${signal ?? code ?? "unknown"})` });
  });

  return child;
}

async function handleGpioLine(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: GpioInputConfig, line: string) {
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
    numbering: "BCM",
    state,
    active: config.activeState === state,
    edge,
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
  return [...edgeArgs, `--bias=${bias}`, config.chip, String(config.pin)];
}

function parseEdge(line: string) {
  const normalized = line.toLowerCase();
  if (normalized.includes("falling")) return "falling";
  return "rising";
}

function sourceUrl(config: GpioInputConfig) {
  return `${config.chip} GPIO${config.pin}`;
}

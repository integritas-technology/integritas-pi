import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { getDataSource } from "./dataSources.repository.js";
import { parseGpioOutputConfig } from "./dataSources.service.js";

const inactiveHolders = new Map<string, ChildProcessWithoutNullStreams>();

export async function pulseGpioOutput(input: { targetId: string; durationMs: number }) {
  const source = getDataSource(input.targetId);
  if (!source) throw new Error("GPIO output target not found");
  if (source.type !== "gpio-output") throw new Error("Control output block requires a GPIO output target");
  const config = parseGpioOutputConfig(JSON.parse(source.config) as unknown);
  if (config.profile !== "led") throw new Error("Only LED output targets are supported for pulse actions");
  if (!Number.isFinite(input.durationMs) || input.durationMs < 1 || input.durationMs > 60000) throw new Error("Pulse duration must be between 1 and 60000 ms");

  const activeValue = config.activeState === "high" ? 1 : 0;
  const inactiveValue = activeValue === 1 ? 0 : 1;
  const durationUs = Math.trunc(input.durationMs * 1000);
  const key = outputKey(config.chip, config.pin);

  stopInactiveHolder(key);
  try {
    await runGpioset(["--mode=time", `--usec=${durationUs}`, config.chip, `${config.pin}=${activeValue}`]);
  } finally {
    startInactiveHolder(key, config.chip, config.pin, inactiveValue);
  }

  return {
    targetId: source.id,
    targetName: source.name,
    profile: config.profile,
    chip: config.chip,
    pin: config.pin,
    action: "pulse",
    durationMs: input.durationMs,
    activeState: config.activeState
  };
}

function startInactiveHolder(key: string, chip: string, pin: number, value: number) {
  stopInactiveHolder(key);

  const child = spawn("gpioset", ["--mode=signal", chip, `${pin}=${value}`], { shell: false });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    const message = chunk.trim();
    if (message) console.error(`GPIO output inactive holder error: ${message}`);
  });
  child.on("error", (error) => console.error(`GPIO output inactive holder could not start: ${error.message}`));
  child.on("exit", () => {
    if (inactiveHolders.get(key) === child) inactiveHolders.delete(key);
  });
  inactiveHolders.set(key, child);
}

function stopInactiveHolder(key: string) {
  const existing = inactiveHolders.get(key);
  if (!existing) return;
  existing.kill("SIGTERM");
  inactiveHolders.delete(key);
}

function outputKey(chip: string, pin: number) {
  return `${chip}:${pin}`;
}

function runGpioset(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("gpioset", args, { shell: false });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`GPIO output could not start: ${error.message}`)));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`GPIO output failed${stderr.trim() ? `: ${stderr.trim()}` : ` with exit code ${code}`}`));
    });
  });
}

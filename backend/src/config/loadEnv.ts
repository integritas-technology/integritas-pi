import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envFilePath = path.join(repoRoot, ".env");

function applyEnvFile(contents: string) {
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (process.env.NODE_ENV !== "production" && fs.existsSync(envFilePath)) {
  applyEnvFile(fs.readFileSync(envFilePath, "utf8"));
}

process.env.INTEGRITAS_PI_ROOT ??= repoRoot;

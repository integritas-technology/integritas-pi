import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function findTests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return findTests(fullPath);
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [fullPath] : [];
  });
}

const tests = findTests("src");
if (tests.length === 0) {
  console.error("No backend test files found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], { stdio: "inherit" });
process.exit(result.status ?? 1);

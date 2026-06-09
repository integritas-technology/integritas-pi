import fs from "node:fs";
import path from "node:path";

export function ensureDatabaseDirectory(databasePath: string) {
  const directory = path.dirname(databasePath);
  if (!directory || directory === ".") {
    return;
  }

  fs.mkdirSync(directory, { recursive: true });
}

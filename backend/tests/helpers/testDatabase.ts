import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export async function setupTestDatabase() {
  const dbFile = path.join(os.tmpdir(), `integritas-pi-test-${crypto.randomUUID()}.db`);
  process.env.DATABASE_PATH = dbFile;

  const { db, runMigrations } = await import("../../src/db/database.js");
  runMigrations();

  return {
    db,
    teardown() {
      db.close();
      for (const suffix of ["", "-wal", "-shm"]) {
        fs.rmSync(`${dbFile}${suffix}`, { force: true });
      }
    }
  };
}

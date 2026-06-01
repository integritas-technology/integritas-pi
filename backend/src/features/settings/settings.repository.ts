import { db } from "../../db/database.js";

export function saveSetting(key: string, value: string) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

export function getSetting(key: string) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function deleteSetting(key: string) {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

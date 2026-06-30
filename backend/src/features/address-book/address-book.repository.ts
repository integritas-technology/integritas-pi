import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { AddressBookEntry } from "./address-book.types.js";

export function listAddressBookEntries(): AddressBookEntry[] {
  return db.prepare(`
    SELECT id, label, address, notes, created_at
    FROM address_book
    ORDER BY label COLLATE NOCASE ASC
  `).all() as AddressBookEntry[];
}

export function getAddressBookEntryById(id: string): AddressBookEntry | null {
  const row = db.prepare(`
    SELECT id, label, address, notes, created_at
    FROM address_book
    WHERE id = ?
    LIMIT 1
  `).get(id) as AddressBookEntry | undefined;
  return row ?? null;
}

export function getAddressBookEntryByAddress(address: string): AddressBookEntry | null {
  const row = db.prepare(`
    SELECT id, label, address, notes, created_at
    FROM address_book
    WHERE address = ?
    LIMIT 1
  `).get(address) as AddressBookEntry | undefined;
  return row ?? null;
}

export function insertAddressBookEntry(input: {
  label: string;
  address: string;
  notes: string | null;
}): AddressBookEntry {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO address_book (id, label, address, notes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.label, input.address, input.notes, createdAt);
  return getAddressBookEntryById(id)!;
}

export function updateAddressBookEntry(
  id: string,
  input: { label?: string; notes?: string | null }
): AddressBookEntry | null {
  const entry = getAddressBookEntryById(id);
  if (!entry) return null;

  const newLabel = input.label ?? entry.label;
  const newNotes = input.notes !== undefined ? input.notes : entry.notes;

  db.prepare(`
    UPDATE address_book SET label = ?, notes = ? WHERE id = ?
  `).run(newLabel, newNotes, id);

  return getAddressBookEntryById(id)!;
}

export function deleteAddressBookEntry(id: string): boolean {
  const result = db.prepare(`DELETE FROM address_book WHERE id = ?`).run(id);
  return result.changes > 0;
}

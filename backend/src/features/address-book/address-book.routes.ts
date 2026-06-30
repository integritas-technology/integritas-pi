import { Router } from "express";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { isMinimaAddress } from "../../shared/minima-address.js";
import {
  deleteAddressBookEntry,
  getAddressBookEntryByAddress,
  getAddressBookEntryById,
  insertAddressBookEntry,
  listAddressBookEntries,
  updateAddressBookEntry,
} from "./address-book.repository.js";

export const addressBookRouter = Router();

addressBookRouter.get("/", (_req, res) => {
  res.json(listAddressBookEntries());
});

addressBookRouter.post("/", requireRole("admin"), (req, res) => {
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() || null : null;

  if (!label) return res.status(400).json({ ok: false, error: "label is required" });
  if (label.length > 80) return res.status(400).json({ ok: false, error: "label must be 80 characters or fewer" });
  if (!address) return res.status(400).json({ ok: false, error: "address is required" });
  if (!isMinimaAddress(address)) {
    return res.status(400).json({ ok: false, error: "address must start with Mx or 0x" });
  }

  const existing = getAddressBookEntryByAddress(address);
  if (existing) return res.status(409).json({ ok: false, error: "address already exists in address book" });

  const entry = insertAddressBookEntry({ label, address, notes });
  recordAuditEvent("address-book.create", {
    userId: req.user?.id,
    detail: JSON.stringify({ id: entry.id, label: entry.label, address: entry.address }),
  });
  res.status(201).json(entry);
});

addressBookRouter.patch("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;

  const entry = getAddressBookEntryById(id);
  if (!entry) return res.status(404).json({ ok: false, error: "entry not found" });

  const label = typeof req.body?.label === "string" ? req.body.label.trim() : undefined;
  const notes =
    req.body?.notes !== undefined
      ? typeof req.body.notes === "string"
        ? req.body.notes.trim() || null
        : null
      : undefined;

  if (label !== undefined && !label) {
    return res.status(400).json({ ok: false, error: "label cannot be empty" });
  }
  if (label !== undefined && label.length > 80) {
    return res.status(400).json({ ok: false, error: "label must be 80 characters or fewer" });
  }

  const updated = updateAddressBookEntry(id, { label, notes });
  recordAuditEvent("address-book.update", {
    userId: req.user?.id,
    detail: JSON.stringify({ id, label: updated?.label }),
  });
  res.json(updated);
});

addressBookRouter.delete("/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;

  const entry = getAddressBookEntryById(id);
  if (!entry) return res.status(404).json({ ok: false, error: "entry not found" });

  deleteAddressBookEntry(id);
  recordAuditEvent("address-book.delete", {
    userId: req.user?.id,
    detail: JSON.stringify({ id, label: entry.label, address: entry.address }),
  });
  res.status(204).send();
});

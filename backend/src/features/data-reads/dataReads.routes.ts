import { Router } from "express";
import { countDataSourceReads, DATA_READ_LIST_STATUSES, getDataSourceRead, listDataSourceReads } from "./dataReads.repository.js";
import { serializeDataSourceRead } from "./dataReads.service.js";
import { parseListQuery, toPaginatedResult } from "../../shared/list-query.js";

export const dataReadsRouter = Router();

dataReadsRouter.get("/", (req, res) => {
  const parsed = parseListQuery(req.query, { allowedStatuses: DATA_READ_LIST_STATUSES });
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const total = countDataSourceReads(parsed.value);
  const items = listDataSourceReads(parsed.value).map(serializeDataSourceRead);
  return res.json(toPaginatedResult(items, total, parsed.value));
});

dataReadsRouter.get("/:id", (req, res) => {
  const read = getDataSourceRead(req.params.id);
  if (!read) return res.status(404).json({ error: "Data read not found" });
  return res.json({ item: serializeDataSourceRead(read) });
});

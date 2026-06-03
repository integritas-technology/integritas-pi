import { Router } from "express";
import { listDataSourceReads } from "./dataReads.repository.js";
import { serializeDataSourceRead } from "./dataReads.service.js";

export const dataReadsRouter = Router();

dataReadsRouter.get("/", (_req, res) => {
  res.json({ items: listDataSourceReads().map(serializeDataSourceRead) });
});

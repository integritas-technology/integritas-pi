import { Router } from "express";
import { listFiles } from "./files.service.js";

export const filesRouter = Router();

filesRouter.get("/", async (req, res) => {
  const requestedPath = typeof req.query.path === "string" ? req.query.path : "/";

  try {
    res.json(await listFiles(requestedPath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "OUTSIDE_ROOT") return res.status(403).json({ error: "Path is outside the allowed directory" });
    if (code === "NOT_DIRECTORY") return res.status(400).json({ error: "Path must be a directory" });
    if (code === "ENOENT") return res.status(404).json({ error: "Path not found" });
    if (code === "EACCES" || code === "EPERM") return res.status(403).json({ error: "Permission denied" });

    console.error(error);
    return res.status(500).json({ error: "Failed to list files" });
  }
});

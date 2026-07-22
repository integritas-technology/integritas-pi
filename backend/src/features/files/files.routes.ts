import { Router } from "express";
import { badRequest, forbidden, notFound, unexpected } from "../../shared/api-error.js";
import { requireRole } from "../auth/auth.middleware.js";
import { listFiles } from "./files.service.js";

export const filesRouter = Router();

filesRouter.use(requireRole("admin"));

filesRouter.get("/", async (req, res) => {
  const requestedPath = typeof req.query.path === "string" ? req.query.path : "/";

  try {
    res.json(await listFiles(requestedPath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "OUTSIDE_ROOT") return forbidden(res, "Path is outside the allowed directory");
    if (code === "NOT_DIRECTORY") return badRequest(res, "Path must be a directory", { path: requestedPath });
    if (code === "ENOENT") return notFound(res, "Path not found");
    if (code === "EACCES" || code === "EPERM") return forbidden(res, "Permission denied");

    console.error(error);
    return unexpected(res, "Failed to list files", error, { path: requestedPath });
  }
});

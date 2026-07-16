import { Router } from "express";
import { getApplyJobStatus, startApplyJob } from "./apply.job.js";

export const applyRouter = Router();

// POST kicks off the update in the background and returns immediately: a
// successful frontend update restarts the very container proxying this
// request, which would kill an in-flight synchronous response. Callers must
// poll GET /apply instead of waiting on this response body.
applyRouter.post("/", (_req, res) => {
  const { started } = startApplyJob();
  if (!started) {
    return res.status(409).json({ error: "An update is already in progress" });
  }
  res.status(202).json({ status: "running" });
});

applyRouter.get("/", (_req, res) => {
  res.json(getApplyJobStatus());
});

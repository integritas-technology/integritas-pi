import { Router } from "express";
import { recordAuditEvent } from "../auth/audit.service.js";
import { appendFeedbackSubmission, FeedbackValidationError, getFeedbackExport } from "./feedback.service.js";

export const feedbackRouter = Router();

feedbackRouter.post("/", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = appendFeedbackSubmission(req.body, req.user);
    recordAuditEvent("feedback.submit", {
      userId: req.user.id,
      detail: JSON.stringify({ id: result.submission.id, type: result.submission.type, area: result.submission.area, page: result.submission.page })
    });
    return res.status(201).json({ id: result.submission.id, fileName: result.fileName, exportUrl: result.exportUrl });
  } catch (error) {
    if (error instanceof FeedbackValidationError) return res.status(400).json({ error: error.message });
    console.error("Failed to save feedback", error);
    return res.status(500).json({ error: "Failed to save feedback" });
  }
});

feedbackRouter.get("/export", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = getFeedbackExport(req.user);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="feedback-submissions.json"');
    return res.send(body);
  } catch (error) {
    console.error("Failed to export feedback", error);
    return res.status(500).json({ error: "Failed to export feedback" });
  }
});

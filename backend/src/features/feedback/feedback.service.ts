import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { db } from "../../db/database.js";
import type { SessionUser } from "../auth/auth.types.js";
import { getDeviceInfo } from "../status/device.service.js";

const FEEDBACK_DIR = "feedback";
const FEEDBACK_FILE = "feedback-submissions.json";
const SCHEMA_VERSION = 1;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_PAGE_PATH_LENGTH = 500;
const MAX_PAGE_LABEL_LENGTH = 120;
const feedbackTypes = new Set(["bug", "ux_issue", "feature_request", "question", "other"]);

type FeedbackType = "bug" | "ux_issue" | "feature_request" | "question" | "other";

type FeedbackSubmission = {
  id: string;
  submittedAt: string;
  page: {
    path: string;
    label: string | null;
  };
  type: FeedbackType;
  description: string;
  stats: {
    dataSources: number;
    dataReads: number;
    integritasProofs: number;
    automationWorkflows: number;
  };
};

type FeedbackDocument = {
  schemaVersion: 1;
  metadata: {
    createdAt: string;
    updatedAt: string;
    app: {
      name: "integritas-pi";
      version: string;
    };
    user: {
      id: string;
      displayName: string;
      role: string;
    };
    device: ReturnType<typeof getDeviceInfo>;
  };
  submissions: FeedbackSubmission[];
};

export type FeedbackInput = {
  type?: unknown;
  description?: unknown;
  page?: {
    path?: unknown;
    label?: unknown;
  };
};

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackValidationError";
  }
}

export function getFeedbackExportPath() {
  return path.join(env.dataDir, FEEDBACK_DIR, FEEDBACK_FILE);
}

export function getEmptyFeedbackDocument(user: SessionUser, now = new Date().toISOString()): FeedbackDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: buildMetadata(user, now, now),
    submissions: []
  };
}

export function appendFeedbackSubmission(input: FeedbackInput, user: SessionUser) {
  const parsed = parseFeedbackInput(input);
  const now = new Date().toISOString();
  const filePath = getFeedbackExportPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const existing = readFeedbackDocument(filePath, user, now);
  const submission: FeedbackSubmission = {
    id: crypto.randomUUID(),
    submittedAt: now,
    page: parsed.page,
    type: parsed.type,
    description: parsed.description,
    stats: getFeedbackStats()
  };

  const createdAt = existing.metadata.createdAt || now;
  const document: FeedbackDocument = {
    schemaVersion: SCHEMA_VERSION,
    metadata: buildMetadata(user, createdAt, now),
    submissions: [...existing.submissions, submission]
  };

  writeJsonAtomically(filePath, document);
  return { submission, fileName: FEEDBACK_FILE, exportUrl: "/api/feedback/export" };
}

export function getFeedbackExport(user: SessionUser) {
  const filePath = getFeedbackExportPath();
  if (!fs.existsSync(filePath)) {
    return JSON.stringify(getEmptyFeedbackDocument(user), null, 2) + "\n";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseFeedbackInput(input: FeedbackInput): Pick<FeedbackSubmission, "type" | "description" | "page"> {
  const type = typeof input.type === "string" ? input.type : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const pagePath = typeof input.page?.path === "string" ? input.page.path.trim() : "";
  const pageLabel = typeof input.page?.label === "string" ? input.page.label.trim() : "";

  if (!feedbackTypes.has(type)) throw new FeedbackValidationError("Choose a feedback type.");
  if (!description) throw new FeedbackValidationError("Feedback description is required.");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new FeedbackValidationError(`Feedback description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }
  if (!pagePath) throw new FeedbackValidationError("Page path is required.");
  if (pagePath.length > MAX_PAGE_PATH_LENGTH) {
    throw new FeedbackValidationError(`Page path must be ${MAX_PAGE_PATH_LENGTH} characters or fewer.`);
  }
  if (pageLabel.length > MAX_PAGE_LABEL_LENGTH) {
    throw new FeedbackValidationError(`Page label must be ${MAX_PAGE_LABEL_LENGTH} characters or fewer.`);
  }

  return {
    type: type as FeedbackType,
    description,
    page: {
      path: pagePath,
      label: pageLabel || null
    }
  };
}

function readFeedbackDocument(filePath: string, user: SessionUser, now: string): FeedbackDocument {
  if (!fs.existsSync(filePath)) return getEmptyFeedbackDocument(user, now);

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<FeedbackDocument>;
  if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.metadata || !Array.isArray(parsed.submissions)) {
    throw new Error("Existing feedback file has an unsupported format.");
  }

  return parsed as FeedbackDocument;
}

function writeJsonAtomically(filePath: string, document: FeedbackDocument) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(document, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function buildMetadata(user: SessionUser, createdAt: string, updatedAt: string): FeedbackDocument["metadata"] {
  return {
    createdAt,
    updatedAt,
    app: {
      name: "integritas-pi",
      version: process.env.INTEGRITAS_PI_VERSION ?? "unknown"
    },
    user: {
      id: user.id,
      displayName: user.displayName,
      role: user.role
    },
    device: getDeviceInfo()
  };
}

function getFeedbackStats(): FeedbackSubmission["stats"] {
  return {
    dataSources: countRows("data_sources"),
    dataReads: countRows("data_source_reads"),
    integritasProofs: countRows("integritas_proofs"),
    automationWorkflows: countRows("automation_workflows")
  };
}

function countRows(table: string) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
  return row.count;
}

import { Router } from "express";
import { dependencyUnavailable, validationFailed } from "../../shared/api-error.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { createCustomToken, getTokenCreateRequirements, listWalletTokens } from "./tokens.service.js";

export const tokensRouter = Router();

tokensRouter.get("/create-requirements", (_req, res) => {
  res.json(getTokenCreateRequirements());
});

tokensRouter.get("/", async (_req, res) => {
  try {
    res.json(await listWalletTokens());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    dependencyUnavailable(res, message, message, undefined, { ok: false });
  }
});

tokensRouter.post("/create", requireRole("admin"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const amount = typeof req.body?.amount === "string" ? req.body.amount.trim() : "";
  const decimal = Number(req.body?.decimal);

  if (!name) return validationFailed(res, "name is required", { name: "name is required" }, { ok: false });
  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return validationFailed(res, "amount must be a positive number", { amount: "amount must be a positive number" }, { ok: false });
  }
  if (!Number.isInteger(decimal) || decimal < 0) {
    return validationFailed(res, "decimal must be a non-negative integer", { decimal: "decimal must be a non-negative integer" }, { ok: false });
  }

  try {
    const result = await createCustomToken({ name, amount, decimal });
    if (!result.ok) {
      return dependencyUnavailable(res, result.message ?? "Token creation failed", result.message, undefined, result);
    }
    recordAuditEvent("tokens.create", {
      userId: req.user?.id,
      detail: JSON.stringify({
        tokenId: result.tokenId,
        name: result.name,
        amount: result.amount,
        decimal: result.decimal,
        txpowId: result.txpowId
      })
    });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    dependencyUnavailable(res, message, message, undefined, { ok: false });
  }
});

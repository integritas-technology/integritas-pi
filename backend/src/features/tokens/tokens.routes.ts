import { Router } from "express";
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
    res.status(502).json({ ok: false, error: message });
  }
});

tokensRouter.post("/create", requireRole("admin"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const amount = typeof req.body?.amount === "string" ? req.body.amount.trim() : "";
  const decimal = Number(req.body?.decimal);
  const fromAccountAddress = typeof req.body?.fromAccountAddress === "string" ? req.body.fromAccountAddress.trim() : "";

  if (!name) return res.status(400).json({ ok: false, error: "name is required" });
  if (!fromAccountAddress) return res.status(400).json({ ok: false, error: "fromAccountAddress is required" });
  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ ok: false, error: "amount must be a positive number" });
  }
  if (!Number.isInteger(decimal) || decimal < 0) {
    return res.status(400).json({ ok: false, error: "decimal must be a non-negative integer" });
  }

  try {
    const result = await createCustomToken({ name, amount, decimal, fromAccountAddress });
    if (!result.ok) {
      return res.status(502).json({
        ...result,
        error: result.message ?? "Token creation failed"
      });
    }
    recordAuditEvent("tokens.create", {
      userId: req.user?.id,
      detail: JSON.stringify({
        tokenId: result.tokenId,
        name: result.name,
        amount: result.amount,
        decimal: result.decimal,
        txpowId: result.txpowId,
        fromAccountAddress
      })
    });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

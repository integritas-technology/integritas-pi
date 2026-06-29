import { Router } from "express";
import { env } from "../../config/env.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { isMinimaAddress } from "../../shared/minima-address.js";
import { clearWalletSendHistoryForDebug, getPaymentStatus, getReceiveAddress, getWalletStatus, importWallet, listWalletSendHistory, recordWalletSendHistory, sendPayment } from "./wallet.service.js";

export const walletRouter = Router();

walletRouter.get("/", async (_req, res) => {
  try {
    res.json(await getWalletStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

walletRouter.post("/receive-address", requireRole("admin"), async (req, res) => {
  try {
    const result = await getReceiveAddress();
    recordAuditEvent("wallet.address.get", { userId: req.user?.id });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

walletRouter.post("/send-payment", requireRole("admin"), async (req, res) => {
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  const amount = typeof req.body?.amount === "string" ? req.body.amount.trim() : "";
  const tokenId = typeof req.body?.tokenId === "string" ? req.body.tokenId.trim() : "0x00";
  const tokenName = typeof req.body?.tokenName === "string" ? req.body.tokenName.trim() : "";

  if (!address) return res.status(400).json({ ok: false, error: "address is required" });
  if (!isMinimaAddress(address)) return res.status(400).json({ ok: false, error: "address must start with Mx or 0x" });
  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ ok: false, error: "amount must be a positive number" });
  }

  try {
    const result = await sendPayment({ address, amount, tokenId });
    const displayTokenName = tokenName || (tokenId === "0x00" ? "Minima" : tokenId);
    recordWalletSendHistory({
      toAddress: address,
      tokenId,
      tokenName: displayTokenName,
      amount,
      txpowId: result.txpowId,
      status: result.ok ? "submitted" : "failed"
    });
    recordAuditEvent("wallet.payment.send", {
      userId: req.user?.id,
      detail: JSON.stringify({ address, amount, tokenId, tokenName: displayTokenName, txpowId: result.txpowId })
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

walletRouter.get("/history", async (req, res) => {
  const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : 30;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 30;
  try {
    res.json({ sends: listWalletSendHistory(limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ ok: false, error: message });
  }
});

walletRouter.get("/payment-status/:txpowid", async (req, res) => {
  try {
    res.json(await getPaymentStatus(req.params.txpowid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

walletRouter.post("/import", requireRole("admin"), async (req, res) => {
  const phrase = typeof req.body?.phrase === "string" ? req.body.phrase.trim() : "";
  if (!phrase) return res.status(400).json({ ok: false, error: "phrase is required" });
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length < 12) return res.status(400).json({ ok: false, error: "phrase must be at least 12 words" });

  try {
    const result = await importWallet(phrase);
    // Audit event records only that an import occurred — never the phrase itself
    recordAuditEvent("wallet.import", { userId: req.user?.id });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

walletRouter.post("/debug/clear-wallet-history", requireRole("admin"), async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ ok: false, error: "Debug endpoint is disabled in production" });
  }
  try {
    const deleted = clearWalletSendHistoryForDebug();
    recordAuditEvent("wallet.debug.clear_history", {
      userId: req.user?.id,
      detail: JSON.stringify({ deleted, mode: process.env.NODE_ENV ?? "unknown", dbPath: env.databasePath })
    });
    res.json({ ok: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ ok: false, error: message });
  }
});

import { Router } from "express";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { getPaymentStatus, getReceiveAddress, getWalletStatus, sendPayment } from "./wallet.service.js";

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

  if (!address) return res.status(400).json({ ok: false, error: "address is required" });
  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ ok: false, error: "amount must be a positive number" });
  }

  try {
    const result = await sendPayment({ address, amount, tokenId });
    recordAuditEvent("wallet.payment.send", {
      userId: req.user?.id,
      detail: JSON.stringify({ address, amount, tokenId, txpowId: result.txpowId })
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
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

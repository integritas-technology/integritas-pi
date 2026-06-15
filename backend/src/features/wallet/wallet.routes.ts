import { Router } from "express";
import { getWalletStatus } from "./wallet.service.js";

export const walletRouter = Router();

walletRouter.get("/", async (_req, res) => {
  try {
    res.json(await getWalletStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

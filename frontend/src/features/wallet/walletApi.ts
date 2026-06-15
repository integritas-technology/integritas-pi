import { getJson } from "../../lib/api";
import type { WalletStatus } from "./walletTypes";

export function getWalletStatus() {
  return getJson<WalletStatus>("/api/wallet");
}

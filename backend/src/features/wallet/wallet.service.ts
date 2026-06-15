import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { parseBalanceResponse } from "./wallet.parse.js";
import type { WalletStatus } from "./wallet.types.js";

export async function getWalletStatus(): Promise<WalletStatus> {
  const result = await runMinimaPathCommand("balance");
  return parseBalanceResponse(result.body);
}

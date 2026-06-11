export function normalizeMinimaRpcError(message: string) {
  if (/fetch failed|econnrefused|enotfound|etimedout|socket hang up|network|abort/i.test(message)) {
    return "Minima RPC is temporarily unreachable";
  }
  return message;
}

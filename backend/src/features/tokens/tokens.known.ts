type KnownToken = { symbol: string; name: string };

const KNOWN_TOKENS_RAW: Record<string, KnownToken> = {
  "0x7d39745fbd29049be29850b55a18bf550e4d442f930f86266e34193d89042a90": {
    symbol: "USDT",
    name: "Tether USD",
  },
};

export function lookupKnownToken(tokenId: string): KnownToken | undefined {
  return KNOWN_TOKENS_RAW[tokenId.toLowerCase()];
}

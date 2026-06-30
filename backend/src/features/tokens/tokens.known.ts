export type KnownToken = {
  tokenId: string;
  symbol: string;
  name: string;
};

export const KNOWN_TOKENS: readonly KnownToken[] = [
  {
    tokenId: "0x7d39745fbd29049be29850b55a18bf550e4d442f930f86266e34193d89042a90",
    symbol: "USDT",
    name: "Tether USD",
  },
];

const byId = new Map(KNOWN_TOKENS.map((t) => [t.tokenId, t]));

export function lookupKnownToken(tokenId: string): KnownToken | undefined {
  return byId.get(tokenId.toLowerCase());
}

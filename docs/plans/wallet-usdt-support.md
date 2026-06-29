# Wallet USDT Support

**Branch:** TBD  
**Created:** 2026-06-29  
**Goal:** Surface USDT as a recognised asset in the wallet — proper label, icon, and balance visibility — without changing send/receive mechanics (those already work for any token).

---

## Background

Minima natively supports custom tokens (coloured coins). USDT circulates on the Minima chain as a native wrapped token bridged via MiniSwap, which converts USDT on Ethereum to a Minima-native token with a fixed `tokenId`. The wallet already reads, displays, and can send/receive any token the node holds using that `tokenId` — so the plumbing is complete. The gap is recognition: the UI currently shows a raw hex `tokenId` with a generic icon for any non-native token, including USDT.

**Pre-condition:** confirm the canonical USDT `tokenId` on Minima mainnet with the team before coding. It is assigned at minting time and fixed — check via MiniSwap docs or query a live node running MiniSwap.

---

## Part 1 — Backend: Known Token Registry

**Files to create/modify:**

| File | Change |
|------|--------|
| `backend/src/features/tokens/tokens.known.ts` | New — known token registry |
| `backend/src/features/tokens/tokens.types.ts` | Add optional `knownSymbol`, `knownName` to `TokenListItem` |
| `backend/src/features/tokens/tokens.service.ts` | Merge known-token metadata in `listWalletTokens` |

**`tokens.known.ts`:**

```ts
export const KNOWN_TOKENS: Record<string, { symbol: string; name: string }> = {
  "0x<USDT_TOKEN_ID>": { symbol: "USDT", name: "Tether USD" },
};
```

**Service change:** in `listWalletTokens`, look up each token's `tokenId` in `KNOWN_TOKENS` and attach `knownSymbol` / `knownName` to the response. The frontend gets the label without needing its own copy of the tokenId.

No new DB table — USDT is a received token, not one created on this node. The `custom_tokens` table is only for tokens minted here.

---

## Part 2 — Frontend: USDT Display

**Files to modify:**

| File | Change |
|------|--------|
| `frontend/src/features/tokens/tokensTypes.ts` | Add `knownSymbol?`, `knownName?` to token type |
| `frontend/src/pages/WalletPage.tsx` | Render USDT with tether icon + symbol |

**UI changes (WalletPage only):**

- In the Assets list: show `knownName` ("Tether USD") as the display name and a `$` or tether glyph when `knownSymbol === "USDT"`, falling back to the existing generic hex-token icon for unknown tokens.
- In the Asset detail modal: show both `knownSymbol` and the raw `tokenId` (for transparency).
- Send modal: the token selector already shows `token.name` — update to prefer `knownName` when present.

No changes to send, receive, or history flows.

---

## Part 3 — Cleanup

1. **Single source of truth for known tokens** — the registry lives only in `tokens.known.ts` on the backend; the frontend derives labels from the API response, never from a hardcoded tokenId.
2. **`TokenListItem.isNative` type** — currently typed as literal `false` on the non-native branch. Widen to `boolean` or use a discriminated union so `knownSymbol` fits cleanly without type gymnastics.
3. **Future tokens** — adding more known tokens (e.g. wMINIMA) later is a one-line addition to `KNOWN_TOKENS`; no schema or API changes needed.

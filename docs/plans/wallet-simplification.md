# Wallet simplification

**Status:** In progress  
**Branch:** `simple-wallet`  
**Goal:** Remove the custom "labeled account" layer. Use Minima's default single-wallet model — one wallet, total balances, send from the whole wallet. Proper multi-wallet deferred to post-MVP.

**Why:** The account architecture mapped user-defined labels onto Minima's address pool, tracked per-address UTXO balances via `coins relevant:true`, and tried to scope sends via `fromaddress:`. This added significant complexity for an MVP and the address-scoped sending was already noted as unreliable on some nodes. Minima's `balance` command already gives us exactly what we need.

---

## Part 1 — Wallet backend

Files: `wallet.service.ts`, `wallet.routes.ts`, `wallet.types.ts`, `wallet.parse.ts`

**Delete from `wallet.service.ts`:**
- `mapWalletAccount`, `resolveMiniAddressForHexAddress`
- `listWalletAccounts`, `getWalletAccountByAddress`
- `createWalletAccount`, `createWalletAccountFromAddress`
- `listWalletAccountsWithBalances`
- `clearWalletAccountsForDebug`

**Simplify in `wallet.service.ts`:**
- `sendPayment` — drop `fromAccountAddress` param; always send without `fromaddress:`
- `recordWalletSendHistory` — pass null for `fromAccountLabel` / `fromAccountAddress`

**Delete from `wallet.routes.ts`:**
- `GET /accounts`, `POST /accounts`, `POST /debug/clear-wallet-accounts`
- Remove `fromAccountAddress` extraction and `getWalletAccountByAddress` call from `POST /send-payment`

**Delete from `wallet.types.ts`:**
- `WalletAccount`, `WalletAccountCreateRequest`, `WalletAccountBalance`
- `WalletAccountWithBalance`, `WalletAccountTokenBalance`
- `UnlabeledFundedAddress`, `WalletAccountsOverview`
- Remove `fromAccountAddress` from `SendPaymentRequest`
- Remove `fromAccountLabel`, `fromAccountAddress` from `WalletSendHistoryItem`

**Delete from `wallet.parse.ts`:**
- `parseCoinsResponse`, `buildAccountTokenBalances`
- `addDecimalStrings`, `compareDecimalStrings`

**DB:** `wallet_accounts` table migration stays in `database.ts` for backward compat (table is unused; existing installs keep it empty).

---

## Part 2 — Token backend

Files: `tokens.types.ts`, `tokens.routes.ts`, `tokens.service.ts`

**`tokens.types.ts`:** Remove `fromAccountAddress` from `CreateTokenRequest`.

**`tokens.routes.ts`:** Remove `fromAccountAddress` extraction and validation from `POST /create`.

**`tokens.service.ts`:**
- Remove imports of `getWalletAccountByAddress`, `parseCoinsResponse`, `addDecimalStrings`, `compareDecimalStrings`
- Remove `sumNativeOnAddress` helper
- In `createCustomToken`: replace account check + per-address coin scan with a simple total-wallet balance check using `getWalletStatus()` — if native sendable < `TOKEN_CREATE_MIN_ACCOUNT_MINIMA`, return early with a clear message
- Remove `fromAccountAddress` from `CreateTokenRequest` param and `validateCreateInput`

---

## Part 3 — Frontend

Files: `walletTypes.ts`, `walletApi.ts`, `WalletPage.tsx`, `tokensTypes.ts`

**`walletTypes.ts`:** Remove all account types (mirror of backend Part 1).

**`walletApi.ts`:** Remove `listWalletAccounts`, `createWalletAccount`, `clearWalletAccountsForDebug`.

**`tokensTypes.ts`:** Remove `fromAccountAddress` from `CreateTokenRequest`.

**`WalletPage.tsx`** (largest change):
- Remove state: `accounts`, `createOpen`, `createFromAddress`, `selected`, `unlabeledFunded`
- Remove modals: `CreateAccountModal`, `AccountDetailModal`
- Remove "Unlabeled funded addresses" card
- Remove "Create account" button from hero actions
- Hero card: show total MINIMA balance from `getWalletStatus()` instead of aggregated account balance
- `SendPaymentModal`: remove "From account" selector; token list comes from `getWalletStatus().tokens`; amount validation uses `token.sendable` directly
- `CreateTokenModal`: remove account selector; disable submit if total wallet native sendable < minimum; show wallet MINIMA balance as context
- `HistoryDetailModal`: remove from-account fields (they'll always be null going forward)
- `formatHistoryFlow`: simplify — just show `to` address; no from-account label lookup
- Remove `addDecimalStrings` / `compareDecimalStrings` from the file if no longer needed for amount comparison (check — `SendPaymentModal` may still need `compareDecimalStrings` for the exceed-balance guardrail, using `token.sendable` from `getWalletStatus`)

---

## Part 4 — Cleanup

- `docs/qa/wallet-gaps.md`: remove items that reference labeled accounts; keep RPC verification and security items
- `docs/qa/tokens-gaps.md`: update `fromAccountAddress` references
- `CHANGELOG.md`: add `[Unreleased]` entry describing the simplification
- Memory: update `project-wallet-plan` memory to reflect the new simplified state

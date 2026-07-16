# Wallet And Token Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md#wallet) · [project-wallet-plan memory: single-wallet model, no labeled accounts]

Wallet uses Minima's default single-wallet model (no user-defined labeled accounts; no `fromAccountAddress`/UTXO scoping). Sends and receives operate on the whole node wallet.

## Seed Phrase Import (admin)

Risk: `POST /api/wallet/import` accepts a 24-word BIP-39 seed phrase in the JSON request body and calls the Minima `restore` RPC. The phrase travels over the existing HTTP connection.

Impact: If the LAN connection is observed (e.g., on an untrusted network), the seed phrase can be captured and the wallet compromised. A successful restore replaces the node's current wallet and cannot be undone without a separate backup.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Phrase is never logged — audit event `wallet.import` records only that an import occurred, with no phrase in the detail field.
- Phrase is not returned in the response body.
- Input is validated server-side (minimum 12 words) before calling Minima RPC.
- Minima RPC call uses a 30 s timeout to allow node processing time.

**Required before field deployment:** Use the default HTTPS deploy on any network where seed phrase import will be used. Understand that the self-signed certificate requires a browser warning; traffic is encrypted but server identity is not publicly attested. Never import a seed phrase over an untrusted or monitored network if you cannot verify you reached your Pi.

Status: HTTPS enabled by default on Docker deploy; self-signed trust limitations documented.

> **Megammr resync interaction:** The Minima `restore` command used by `/api/wallet/import` triggers a node restart, which may overlap with active or auto-triggered Megammr resyncs. If a malicious or misconfigured Megammr host is set at the time of a resync, the resulting chain state could force the node to re-derive keys in an unexpected state. Operators should verify the Megammr host URL before importing a wallet and before enabling `MINIMA_AUTO_RESYNC`. This is a known prototype risk — investigate before production use.

## Automated Wallet Transactions

Risk: Automation workflows can send wallet transactions without a human clicking the Wallet page send button at execution time.

Impact: A misconfigured or malicious workflow could spend native MINIMA when its trigger fires. Event-driven triggers such as GPIO, webhooks, or MQTT can be caused by external input.

Current Controls:

- Creating/editing transaction blocks requires admin role through the protected automation API.
- V1 transaction blocks can only send native MINIMA (`tokenid:0x00`); custom token IDs are rejected.
- Recipients must be selected from the saved address book and are resolved by address book entry id at execution time.
- The backend validates the amount and checks current sendable native MINIMA balance before calling Minima `send`.
- The block uses the existing narrow wallet send service, not a generic Minima command proxy.
- Sends are recorded in wallet send history and audit events with workflow/recipient/amount metadata.

Status: Accepted prototype risk. Use only on trusted local workflows and treat enabled event-triggered transaction workflows as funds-moving automation.

## Wallet Debug Clears (admin, non-production)

Risk: `POST /api/wallet/debug/clear-wallet-accounts` and `POST /api/wallet/debug/clear-wallet-history` delete legacy account-label mappings (unused since the single-wallet model) and SQLite send history. Misuse on a shared dev stack could remove local audit context (not on-chain funds).

Impact: Loss of send-history rows in SQLite. Does not delete Minima wallet keys or on-chain balances.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Endpoints return **403** when `NODE_ENV=production`.
- Frontend debug buttons render only when `import.meta.env.DEV` is true.
- Audit events `wallet.debug.clear_accounts` and `wallet.debug.clear_history` record deletions.

Status: Accepted for local/dev iteration only. Not available in production builds.

## Custom Token Creation (admin)

Risk: `POST /api/tokens/create` calls Minima `tokencreate` to mint a custom token on-chain. Creation consumes MINIMA (coloured coins) and cannot be undone from the Pi UI.

Impact: Irreversible on-chain token state; misuse could drain wallet MINIMA used for colouring or create unwanted tokens on the node.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Narrow allowlist — only `tokencreate` with validated `name`, `amount`, and `decimal`, checked against total wallet sendable MINIMA; no generic Minima command proxy.
- Audit event `tokens.create` records `tokenId`, `name`, `amount`, `decimal`, and `txpowId` — no secrets.
- SQLite `custom_tokens` stores operator metadata for tokens created through this API.

Status: Documented. Verify `tokencreate` RPC shape on a live Minima node before field use.

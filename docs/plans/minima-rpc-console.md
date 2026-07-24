# Minima RPC Console Plan

**Status:** Not started
**Created:** 2026-07-24
**Goal:** Add a Minima Core page feature that replicates the *feel* of Minima's official Terminal MiniDapp (type a command, see scrollback) without becoming the generic RPC proxy this project's rules explicitly forbid — via an admin-curated, closed-world checkbox whitelist.

## Context

The official Minima "Terminal" MiniDapp is a free-text RPC console: type any command, it's forwarded straight to the node's RPC and the raw response is dumped to screen. `.claude/rules/minima.md` explicitly forbids that shape ("Do not expose a generic Minima command proxy. Add narrow, allowlisted backend actions for each supported command"), and for good reason — commands like `vault` return the seed phrase/private keys directly in the response body, and `sendfrom`/`signfrom` take a raw private key as an argument.

Sources on the official Terminal MiniDapp / RPC surface used to scope this plan:
- [Interactive MiniDapp docs](https://github.com/minima-global/docs/blob/main/content/docs/development/interactive-minidapp.mdx)
- [Terminal Commands doc source](https://raw.githubusercontent.com/minima-global/docs/main/content/docs/development/terminal-commands.mdx)

Design discussion landed on: replicate the terminal feel, but constrain it with an admin-curated, closed-world checkbox whitelist — nothing runs unless it's both in our static catalog **and** checked on. Secret-exposing commands (`vault`, `sendfrom`, `signfrom`, `createfrom`, `postfrom`) and the one availability-risk command (`quit`, shuts the node down with no UI recovery) are excluded from the catalog entirely for v1 — not offered as a checkbox at all — to be revisited later "when we know we can handle the risk." Everything else defaults ON if read-only (no side effects) and OFF if it mutates anything (funds, chain, config, network, wallet), per the simple rule agreed: **ON = read, OFF = write**. Whitelist *edits* require re-entering the admin PIN/password (mirrors the existing `changePassword` re-auth pattern), which meaningfully raises the bar against a hijacked-but-not-credentialed session — the one threat step-up auth can actually stop; it does not help if the credential itself is compromised (accepted, user-level risk, out of scope for this design).

A related risk considered and deliberately left out of v1 scope by the exclusion list above rather than solved with output redaction: since `vault`/`sendfrom`/`signfrom`/`createfrom`/`postfrom` are never offered, there's no path for the console to ever surface seed/private-key material, so no separate audit-log redaction mechanism is needed for this feature as scoped. If any of those commands are ever added later, that redaction question (never persist their raw response, even if the command is allowed to run) needs to be revisited at that time.

The one extra requirement from this conversation: where a whitelisted command already has a dedicated, validated backend action (`megammrsync` → `resyncMegammr()`, `peers action:addpeers` → `addMinimaPeers()`), the console must call that *same* function — not re-implement the RPC call generically — so operation-tracking (`beginMinimaOperation`/`endMinimaOperation`, the `"restarting"` node state), audit logging, and error normalization stay a single source of truth instead of forking into two paths that could disagree.

## Backend changes

**New catalog** — `backend/src/features/minima/minima-console.catalog.ts`
Static, closed-world array:
```ts
type ConsoleDispatch = "passthrough" | "megammrsync-resync" | "peers-add";
type ConsoleCommandEntry = {
  key: string;            // stable id, e.g. "megammrsync.resync", "peers.add", "status"
  verb: string;           // leading RPC command word to match, e.g. "megammrsync", "peers", "status"
  label: string;
  kind: "read" | "write";
  defaultEnabled: boolean;
  dispatch: ConsoleDispatch;
  match?: (rawInput: string) => boolean; // disambiguates commands with multiple sub-actions (peers list vs peers add)
};
```
Representative entries, following ON=read/OFF=write:
- Read, default ON, `dispatch: "passthrough"`: `status`, `balance`, `block`, `history`, `sendview`, `peers` (bare/list), `network`, `ping`, `tokens`, `coins`, `txpow`, `checkaddress`, `coincheck`, `getaddress`, `printmmr`, `printtree`, `trace`, `maxima`, `maxverify`, `maxcontacts`, `scripts`, `tutorial`, `checkmode`, `checkpending`, `checkrestore`, `burn`, `txncheck`, `txnlist`, `txnexport`, `tokenvalidate`, `cointrack`.
- Write, default OFF, `dispatch: "passthrough"`: `send`, `sendpoll`, `sendnosign`, `sendsign`, `sendpost`, `multisig`, `txncreate`, `txninput`, `txnoutput`, `txnpost`, `txnsign`, `txndelete`, `txnimport`, `txnclear`, `txnbasics`, `txnstate`, `txnscript`, `newaddress`, `newscript`, `removescript`, `runscript`, `tokencreate`, `consolidate`, `coinexport`, `coinimport`, `archive`, `backup`, `megammr`, `reset`, `restore`, `restoresync`, `mysql`, `mysqlcoins`, `connect`, `disconnect`, `message`, `webhooks`, `rpc`, `maxcreate`, `maxextra`, `maxsign`, `sign`, `mds`, `logs`.
- Write, default OFF, **special dispatch** (routes through the existing narrow action instead of generic passthrough): `key: "megammrsync.resync"` (`verb: "megammrsync"`, `dispatch: "megammrsync-resync"`), `key: "peers.add"` (`verb: "peers"`, matches when the typed input contains `action:addpeers`, `dispatch: "peers-add"`).
- **Never in the catalog** (not a checkbox, no default, can't be enabled by any request body): `vault`, `sendfrom`, `signfrom`, `createfrom`, `postfrom`, `quit`, and `keys` pending a closer look at whether its response can ever include private key material.

The exact ~70-command list needs one pass against Minima's own `help` output while implementing to catch anything missed here — this gives the shape and the majority of entries, not a guaranteed-exhaustive final list.

**New service** — `backend/src/features/minima/minima-console.service.ts`
- Whitelist storage reuses the existing settings key/value store (`getSetting`/`saveSetting` in `backend/src/features/settings/settings.repository.ts`, same pattern as `minima_megammr_host`) under a new key `minima_console_whitelist`, storing a JSON array of enabled catalog `key`s. Unset → falls back to catalog `defaultEnabled` entries.
- `getConsoleWhitelist()` → `{ catalog, enabledKeys }`.
- `updateConsoleWhitelist(userId, { enabledKeys, currentPassword })`:
  - Re-auth: verify `currentPassword` against the admin user's stored hash via `verifyPassword` (from `backend/src/features/auth/password.service.ts`), same check `changePassword` does in `auth.service.ts:78` — throw a 401-style error (mirror `AuthSettingsError`) on mismatch.
  - Reject any `enabledKeys` entry not present in the catalog (this is what keeps it closed-world — no request body can ever whitelist something we didn't define).
  - Persist, then `recordAuditEvent("minima.console.whitelist_updated", { userId, detail: <diff of keys turned on/off> })`.
- `runConsoleCommand(userId, rawInput: string)`:
  - Parse the leading verb from `rawInput`; find the matching enabled catalog entry (using `match()` where present, e.g. to distinguish `peers` list vs `peers action:addpeers`).
  - Not found / not enabled → throw a clear 4xx: `"Command not permitted — enable '<verb>' in the console whitelist first."`
  - Dispatch:
    - `"megammrsync-resync"` → call `resyncMegammr()` directly (ignores any typed args beyond the verb match — same behavior as the existing Minima Core "Resync" button).
    - `"peers-add"` → parse the `peerslist:` value out of `rawInput` (same `key:value` convention Minima itself uses) and call `addMinimaPeers(peerslist)`.
    - `"passthrough"` → call `runMinimaPathCommand(rawInput)` (from `backend/src/features/minima/minima.rpc.ts`) with the exact typed string, preserving real terminal syntax for everything not special-cased.
  - `recordAuditEvent("minima.console.run", { userId, detail: verb })` — log which command ran, not the raw response body (matches how every other audit entry in this codebase stores derived summary fields, e.g. `minima.peers.add` logs the peer string, not a raw dump).
  - Return the RPC/action result to the caller for scrollback display.

**New routes** — add to `backend/src/features/minima/minima.routes.ts` (same file/router as the rest of the Minima feature):
- `GET /api/minima/console/whitelist` — `requireRole("admin")` → `getConsoleWhitelist()`.
- `POST /api/minima/console/whitelist` — `requireRole("admin")`, reuse `authRateLimiter` (from `backend/src/features/auth/rate-limit.middleware.ts`, same limiter `/api/auth/settings/password` uses) to bound PIN-guessing on the re-auth check → body `{ enabledKeys: string[], currentPassword: string }` → `updateConsoleWhitelist`.
- `POST /api/minima/console/run` — `requireRole("admin")` → body `{ command: string }` → `runConsoleCommand`.

All three admin-gated: this is a new capability surface, so it starts locked down like the rest of the mutating Minima routes (`/peers/add`, `/restart`) rather than being opened to non-admin sessions by default.

## Frontend changes

- `frontend/src/app/types.ts` — add `MinimaConsoleCatalogEntry`, `MinimaConsoleWhitelist`, `MinimaConsoleRunResult` types.
- `frontend/src/features/minima/minimaConsoleApi.ts` — `getConsoleWhitelist()`, `updateConsoleWhitelist(enabledKeys, currentPassword)`, `runConsoleCommand(command)`, following the existing `minimaApi.ts` pattern (`getJson`/`postJson`).
- `frontend/src/features/minima/MinimaConsolePanel.tsx` — terminal-style card: single-line command input + "Run" button, scrollback list of `{ command, result, ok, timestamp }` held in local React state only (never written to `localStorage`, cleared on unmount/reload — no reason to persist client-side). Disabled while `actionsBlocked` (reuse `MinimaPage.tsx`'s existing `actionsBlocked` derivation), matching how the rest of the page gates actions.
- `frontend/src/features/minima/MinimaConsoleWhitelistModal.tsx` — reuses the shared `Modal` component; checkbox list from `catalog`, grouped/labeled read vs write; a "Current PIN or password" field styled exactly like `AuthSettingsPage.tsx:174-187`'s re-auth input; "Save" disabled until that field is non-empty; calls `updateConsoleWhitelist`, surfaces the 401 "Invalid current credential" case inline.
- `frontend/src/pages/MinimaPage.tsx` — add a new `Card` section below the existing summary/health/container grid: "RPC console" with a settings/gear icon (opens the whitelist modal) and the console panel beneath it.

## Docs (required by `.claude/rules/documenting-work.md`, do once the build is verified)

- `.claude/rules/minima.md` (+ `.agents/rules/minima.md` + `.cursor/rules/minima.mdc`, kept in sync) — document the console as a deliberate, scoped exception to "no generic proxy": closed catalog only, hard-excluded commands, admin+re-auth-gated whitelist edits, `megammrsync`/`peers add` routed through the existing narrow actions rather than duplicated.
- `SECURITY.md` / `docs/security/*` — new risk-register entry: blast radius, mitigations, and the explicit list of never-offered commands.
- `CHANGELOG.md` `[Unreleased]` entry.
- `docs/TASKS.md` / `docs/SESSION.md` via the `session-notes` skill.

## Verification

- `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`, `docker compose config` (per `.claude/rules/verification.md`).
- `docker compose build backend frontend && docker compose up -d backend frontend` — container-impacting change.
- Manual click-through at `https://localhost:8080`: toggle a few whitelist entries with correct/incorrect PIN, run a whitelisted read command, confirm a non-whitelisted command is rejected with a clear message, run `megammrsync` via console and confirm it behaves identically to the existing "Resync" button (operation banner, audit log entry), run `peers action:addpeers` via console and confirm it lands in the same peer list as the Account Settings peers UI.

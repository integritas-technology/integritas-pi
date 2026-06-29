# Wallet Address Book

**Branch:** `wallet-address-book`  
**Created:** 2026-06-29  
**Goal:** Add an address book for saving and reusing external Mx/0x addresses when sending MINIMA or tokens.

---

## Part 1 — Backend: Address Book

**Files to create/modify:**

| File | Change |
|------|--------|
| `backend/src/db/database.ts` | Add `address_book` migration |
| `backend/src/features/address-book/address-book.types.ts` | New |
| `backend/src/features/address-book/address-book.repository.ts` | New |
| `backend/src/features/address-book/address-book.routes.ts` | New |
| `backend/src/app.ts` | Mount `/api/wallet/address-book` router |

**DB migration** — append to `runMigrations()`:

```sql
CREATE TABLE IF NOT EXISTS address_book (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  address    TEXT NOT NULL UNIQUE,  -- Mx… or 0x…
  notes      TEXT,
  created_at TEXT NOT NULL
)
```

No `mini_address` column — the wallet only needs one canonical address per contact (the one the sender pastes into `send`). Store whatever format the user provides (Mx or 0x).

**Routes** (`requireRole("admin")` on all mutations):

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/wallet/address-book` | List all entries (sorted by label) |
| `POST` | `/api/wallet/address-book` | Create entry `{ label, address, notes? }` |
| `PATCH` | `/api/wallet/address-book/:id` | Update label / notes (address is immutable) |
| `DELETE` | `/api/wallet/address-book/:id` | Delete entry |

**Validation:**
- `label` — non-empty, max 80 chars
- `address` — non-empty; basic pattern check: starts with `Mx` or `0x`
- Duplicate address → 409

---

## Part 2 — Frontend: Address Book

**Files to create/modify:**

| File | Change |
|------|--------|
| `frontend/src/features/address-book/addressBookTypes.ts` | New |
| `frontend/src/features/address-book/addressBookApi.ts` | New |
| `frontend/src/features/address-book/AddressBookPanel.tsx` | New — list + add/edit/delete |
| `frontend/src/pages/WalletPage.tsx` | Wire address book into send modal |

**`AddressBookPanel`** lives on `WalletPage` as a collapsible `<Card>` below the existing Assets and History cards. It shows:

- A flat list of saved contacts (label + shortened address)
- "Add contact" button → inline form (label, address, optional notes)
- Per-row: copy address, edit label/notes, delete (with confirmation)

**`SendPaymentModal` integration:**

Add a small "Address book" picker button next to the recipient address field. Clicking it opens a compact inline picker (not a new modal) listing saved contacts. Selecting one populates the address field. No change to the send flow itself.

---

## Part 3 — Cleanup

Small tidy-ups to do once the above lands:

1. **Remove `wallet_accounts` table** — the schema already has this table (from an earlier design), but the wallet was simplified to a single-wallet model and it is unused. Drop the migration or add a `DROP TABLE IF EXISTS wallet_accounts` in a follow-up migration. Verify no code references it first (`grep -r wallet_accounts`).

2. **`TokenListItem.isNative` type** — currently typed as `false` (literal) on the non-native case. Widen to `boolean` or use a discriminated union so `knownSymbol` can be added cleanly without type gymnastics.

3. **Address validation helper** — the Mx/0x prefix check duplicates logic that exists in `wallet.parse.ts`. Extract to `shared/minima-address.ts` and reuse across both wallet send validation and address book.

4. **Audit events** — add `address-book.create`, `address-book.update`, `address-book.delete` to the audit log, consistent with how `tokens.create` is audited.

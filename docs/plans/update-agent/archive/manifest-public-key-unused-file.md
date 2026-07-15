# Follow-up: update-agent doesn't read manifest-public-key.pem

**Status:** Done. `update-agent` now reads the key from `manifest-public-key.pem` directly; `MANIFEST_PUBLIC_KEY` env var removed.

`update-agent/manifest-public-key.pem` is committed in the repo but nothing reads it. `update-agent` actually verifies signatures using the `MANIFEST_PUBLIC_KEY` env var (`update-agent/src/config/env.ts:5`, wired through `docker-compose.yml:79`), which must be a PEM string pasted into `.env`.

Two copies of the same key exist today: the file (unused) and whatever string is in `.env` (actually used). Easy to drift if the key is ever rotated and only one copy gets updated.

Fix: make `update-agent` read the key from `update-agent/manifest-public-key.pem` directly, drop `MANIFEST_PUBLIC_KEY` env var. Single source of truth, no PEM-in-.env copy-paste step.

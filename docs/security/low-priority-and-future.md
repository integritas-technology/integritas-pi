# Low Priority Or Future Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md)

## Lack Of Rate Limiting

Risk: Endpoints can be called repeatedly.

Impact: Local DoS, Integritas quota consumption, log noise.

Plan: Login/setup rate limits implemented; broader per-IP limits on stamp and automation endpoints after.

Status: Partially mitigated — login/setup only.

## Error Response Detail

Risk: Backend may return upstream error bodies and detailed internal status.

Impact: Information disclosure.

Plan: Split developer diagnostics from user-facing errors. Hide sensitive upstream details by default.

Status: Open.

## Logging Sensitive Data

Risk: Request logging currently logs method and URL. Future changes could accidentally log secrets or proof payloads.

Impact: Secret leakage into Docker logs.

Plan: Keep logs metadata-only. Never log API keys, request bodies, canonical bytes, or proof payloads unless explicitly redacted.

Status: Partially mitigated.

## Missing Security Tests

Risk: Security-sensitive behavior is manually verified.

Impact: Regressions may go unnoticed.

Plan: Add automated tests for file traversal, auth once added, Integritas key storage, encryption/decryption, and API error handling.

Status: Open. Auth test cases and gaps: `docs/qa/gaps.md`.

# Integritas Rules

- Manual file stamps and automated data-source stamps share the same history table.
- Automation stamps the entire JSON response hash.
- Automation currently stamps every poll when enabled, not only changed data.
- Automated history rows should remain identifiable, e.g. `Automation: <source name>`.
- Proof status is initially `pending`; proof polling updates readiness/failure.
- Start `startIntegritasProofPoller()` from `backend/src/index.ts` after migrations (same pattern as the automation scheduler). The poller batches pending UIDs and reuses `refreshProofRecord` / `applyPollResultToRecord` from `integritas.service.ts`.

# Backend Work

Read these first:

- `backend/src/app.ts` for route registration.
- `backend/src/index.ts` for startup, migrations, and schedulers.
- `backend/src/db/database.ts` for SQLite schema/migrations.
- `backend/src/config/env.ts` for environment configuration.

Feature folders:

- Auth: `backend/src/features/auth/`
- Integritas (proof stamping): `backend/src/features/integritas/`
- Integritas Connect auth: `backend/src/features/integritas-auth/`
- Data sources: `backend/src/features/data-sources/`
- Automation: `backend/src/features/automation/`
- Minima: `backend/src/features/minima/`
- Status/Docker overview: `backend/src/features/status/`
- Settings/secrets: `backend/src/features/settings/`
- File browser: `backend/src/features/files/`

Backend rules:

- Add routes through feature routers and register them in `backend/src/app.ts`.
- Add schema changes in `backend/src/db/database.ts`.
- Keep Integritas API keys backend-only.
- When storing secrets, use existing settings/secrets services.
- When adding a scheduler, start it from `backend/src/index.ts` after migrations.
- Return useful error details from backend services, but never leak secrets.

Auth rules:

- Public routes: `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, `POST /api/auth/login`.
- All other `/api/*` routes require `requireAuth` in `backend/src/app.ts`.
- High-risk mutations also use `requireRole('admin')` (Integritas API key, files, automation/data-source mutations).
- Session cookies: HttpOnly, `SameSite=Strict`, `Secure` when `COOKIE_SECURE=true`.
- Never return password hashes, TOTP secrets, raw session tokens, or Integritas API keys.
- CLI has no session auth in V1; document `401` for protected API calls.

# AGENTS.md

Guidance for LLM-powered agents working in this repository.

## Project Overview

Moim is a federated events + places service (connpass + foursquare) built with:
- TanStack Start + React for the web app
- Drizzle ORM + PostgreSQL for persistence
- Fedify (`@fedify/fedify`) for ActivityPub federation

## Key Commands

```bash
pnpm dev           # run dev server
pnpm build         # build for production
pnpm start         # run production server
pnpm typecheck     # run tsc
pnpm lint          # lint src/
```

## Directory Map

- `src/routes/` — file-based routes (UI + API endpoints)
- `src/server/db/` — Drizzle client + schema
- `src/server/fediverse/` — Fedify federation setup + OTP helpers
- `src/server-entry.ts` — manual h3 route registration for non-file-based endpoints

## API Routing Rules

- All non-ActivityPub business endpoints registered in `src/server-entry.ts` must live under `/api`.
- Do not register h3 handlers on the same paths used by TanStack Start UI pages.
- Prefer resource-oriented paths and conventional HTTP methods for new endpoints.
- Keep Fedify/ActivityPub endpoints outside `/api`.

## ActivityPub (Fedify)

Federation is handled by Fedify (`src/server/fediverse/federation.ts`).
`@fedify/h3` middleware in `src/server-entry.ts` intercepts all federation
requests before TanStack Start routing — no route files needed for AP endpoints.

Endpoints:
- Actor: `/ap/actors/{identifier}` (content-negotiated)
- Inbox: `/ap/actors/{identifier}/inbox` (handles Follow → auto-Accept)
- Outbox: `/ap/actors/{identifier}/outbox`
- Notes: `/ap/notes/{noteId}`
- WebFinger: `/.well-known/webfinger` (automatic via Fedify `mapHandle`/`mapAlias`)
- NodeInfo: `/.well-known/nodeinfo` → `/nodeinfo/2.1`

Key pairs (RSA) are auto-generated and stored as JWK in the `actors` table.
Human-readable profiles: Groups at `/groups/@{identifier}`, Users at `/users/@{identifier}`.

## OTP Authentication (Outbox Polling)

- `POST /api/auth/otp-requests` generates a short-lived OTP challenge.
- User posts the OTP publicly on their Fediverse account.
- `POST /api/auth/otp-verifications` resolves the actor, polls the outbox, and verifies OTP.

Environment controls:
- `OTP_TTL_SECONDS`
- `OTP_POLL_INTERVAL_MS`
- `OTP_POLL_TIMEOUT_MS`

## Database Migration Workflow (Dual DB)

We use two PostgreSQL containers in `docker-compose.yml`:
- **App DB** (`postgres`, port 5432 internal): used by the running app
- **Migration DB** (`postgres-migration`, port 5432 internal / 5434 host): clean DB for schema diff and migration generation

The `app` container has both `DATABASE_URL` and `MIGRATION_DATABASE_URL` pre-configured
to point to the correct internal Docker hostnames. Always run migration commands
via `docker compose exec` to ensure correct environment variables:

### Schema change workflow

```bash
# 1. Edit src/server/db/schema.ts

# 2. Generate migration SQL from schema diff
docker compose exec app pnpm db:generate

# 3. Apply schema to migration DB (keeps it in sync for future diffs)
docker compose exec app pnpm db:push

# 4. Apply migrations to app DB
docker compose exec app pnpm db:migrate
```

### Running raw SQL against the app DB

For data-only migrations or ad-hoc queries:

```bash
docker compose exec postgres psql -U ${DB_USER:-postgres} -d ${DB_NAME:-moim}
```

### Running raw SQL against the migration DB

```bash
docker compose exec postgres-migration psql -U ${DB_USER:-postgres} -d ${DB_NAME:-moim}_migration
```

## Environment Variables

Required:
- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`

Optional:
- `BASE_URL` (default `http://localhost:3000`)
- `INSTANCE_HANDLE` (default `instance`)
- `OTP_TTL_SECONDS`, `OTP_POLL_INTERVAL_MS`, `OTP_POLL_TIMEOUT_MS`

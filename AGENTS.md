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

pnpm db:generate   # generate migrations from schema
pnpm db:push       # apply schema to migration DB
pnpm db:migrate    # apply migrations to app DB
```

## Directory Map

- `src/routes/` — file-based routes (UI + API endpoints)
- `src/server/db/` — Drizzle client + schema
- `src/server/fediverse/` — Fedify federation setup + OTP helpers

## ActivityPub (Fedify)

Federation is handled by Fedify (`src/server/fediverse/federation.ts`).
`@fedify/h3` middleware in `src/server-entry.ts` intercepts all federation
requests before TanStack Start routing — no route files needed for AP endpoints.

Endpoints:
- Actor: `/ap/actors/{identifier}` (content-negotiated; non-AP requests redirect to `/@/{identifier}`)
- Inbox: `/ap/actors/{identifier}/inbox` (handles Follow → auto-Accept)
- Outbox: `/ap/actors/{identifier}/outbox`
- Notes: `/ap/notes/{noteId}`
- WebFinger: `/.well-known/webfinger` (automatic via Fedify `mapHandle`/`mapAlias`)
- NodeInfo: `/.well-known/nodeinfo` → `/nodeinfo/2.1`

Key pairs (RSA) are auto-generated and stored as JWK in the `actors` table.
Human-readable profiles are served at `/@/{identifier}`.

## OTP Authentication (Outbox Polling)

- `POST /auth/request-otp` generates a short-lived OTP challenge.
- User posts the OTP publicly on their Fediverse account.
- `POST /auth/verify-otp` resolves the actor, polls the outbox, and verifies OTP.

Environment controls:
- `OTP_TTL_SECONDS`
- `OTP_POLL_INTERVAL_MS`
- `OTP_POLL_TIMEOUT_MS`

## Database Migration Workflow (Dual DB)

We use two PostgreSQL containers in `docker-compose.yml`:
- App DB (5432): used by the running app
- Migration DB (5433): clean DB for schema diff and migration generation

Workflow:
1. Edit `src/server/db/schema.ts`
2. `pnpm db:generate` (migration created in `drizzle/`)
3. `pnpm db:push` (apply schema to migration DB)
4. `pnpm db:migrate` (apply migrations to app DB)

## Environment Variables

Required:
- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`

Optional:
- `BASE_URL` (default `http://localhost:3000`)
- `INSTANCE_HANDLE` (default `instance`)
- `OTP_TTL_SECONDS`, `OTP_POLL_INTERVAL_MS`, `OTP_POLL_TIMEOUT_MS`

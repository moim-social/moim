# AGENTS.md

Guidance for LLM-powered agents working in this repository.

## Project Overview

Moim is a federated events + places service (connpass + foursquare) built with:
- TanStack Start + React for the web app
- Drizzle ORM + PostgreSQL for persistence
- Fedify (`@fedify/fedify`) for ActivityPub federation
- Lingui (`@lingui/core`) for i18n
- Tailwind CSS v4 for styling

## Key Commands

```bash
pnpm dev              # run dev server
pnpm build            # build for production
pnpm start            # run production server
pnpm typecheck        # run tsc --noEmit
pnpm lint             # eslint src/
pnpm db:generate      # generate migration SQL from schema diff
pnpm db:migrate       # apply migrations to app DB
pnpm db:push          # push schema to migration DB
pnpm generate-key     # generate RSA key pair for INSTANCE_ACTOR_KEY
```

## Directory Map

- `src/routes/` — file-based routes (TanStack Start UI pages + co-located API handlers)
  - `src/routes/admin/` — admin panel pages + API handlers
  - `src/routes/auth/` — authentication (OTP, Misskey MiAuth, Mastodon OAuth)
  - `src/routes/events/` — event CRUD, RSVP, dashboards, discussions
  - `src/routes/groups/` — group CRUD, member management, feed
  - `src/routes/places/` — place listing, detail, check-ins, nearby
  - `src/routes/polls/` — poll CRUD, voting
- `src/components/` — reusable React components
  - `src/components/ui/` — primitive UI kit (button, dialog, card, etc.)
  - `src/components/dashboard/` — dashboard layout primitives (StatCard, Pagination, etc.)
  - `src/components/event-form/` — multi-step event creation form
- `src/hooks/` — React hooks (geolocation, event categories, responsive)
- `src/lib/` — client-side utilities (calendar, markdown, place, timezone, utils)
- `src/shared/` — constants shared between client and server (categories, gradients, languages)
- `src/styles/` — global CSS (Tailwind v4)
- `src/scripts/` — CLI scripts (`keygen.ts`)
- `src/server/` — server-side code
  - `src/server/db/` — Drizzle client + schema
  - `src/server/repositories/` — typed query functions, one file per database table
  - `src/server/services/` — business logic, one file per domain (orchestrates repositories)
  - `src/server/fediverse/` — Fedify federation setup, actor cache, OTP, polls, handles, groups
  - `src/server/storage/` — S3/R2 client
  - `src/server/avatars/` — avatar image processing (sharp)
  - `src/server/events/` — event category helpers (migrating → repositories + services)
  - `src/server/places/` — place find-or-create, categories, audit log, map snapshots (migrating → repositories + services)
  - `src/server/geo/` — H3 hexagonal indexing, reverse geocoding
  - `src/server/i18n/` — Lingui i18n setup + locale catalogs
- `src/server-entry.ts` — h3 app bootstrap: federation middleware, API router, content negotiation

## Layered Architecture

The server codebase follows a layered architecture with strict separation of concerns.
This is an ongoing gradual migration — old patterns coexist with new ones, but all new
code must follow this structure.

### Layers

```
src/server/
  db/
    schema.ts            # Model — Drizzle table definitions
    client.ts            # DB connection
  repositories/          # Repository — typed query functions, one file per entity
  services/              # Service — business logic, orchestrates repositories
src/routes/              # Controller — thin HTTP handlers
```

### Repository Layer (`src/server/repositories/`)

- **One file per database table** (e.g., `events.ts`, `event-tiers.ts`, `actors.ts`)
- Pure data access — no business logic, no HTTP concepts, no `Response` objects
- Every function has explicit TypeScript input params and return types
- Use Drizzle's `InferSelectModel` / `InferInsertModel` for type definitions
- Import only `db` client and schema — nothing else

```typescript
// src/server/repositories/events.ts
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { db } from "../db/client";
import { events } from "../db/schema";

export type Event = InferSelectModel<typeof events>;
export type NewEvent = InferInsertModel<typeof events>;

export async function findById(id: string): Promise<Event | undefined> {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row;
}

export async function insert(values: NewEvent): Promise<Event> {
  const [row] = await db.insert(events).values(values).returning();
  return row;
}
```

### Service Layer (`src/server/services/`)

- **One file per domain** (can span multiple repositories)
- Contains business logic: validation, authorization, orchestration, federation side effects
- Calls repositories for data access — never uses `db` directly
- Defines typed input DTOs and result types for complex operations
- Returns typed results, throws `ServiceError` — never returns `Response`

```typescript
// src/server/services/events.ts
import * as EventRepo from "../repositories/events";
import * as ActorRepo from "../repositories/actors";
import { ServiceError } from "./errors";

export interface CreateEventParams {
  title: string;
  startsAt: string;
  groupActorId?: string;
  categoryId?: string;
  // ...
}

export async function createEvent(
  userId: string,
  params: CreateEventParams,
): Promise<EventRepo.Event> {
  const actor = await ActorRepo.findLocalPerson(userId);
  if (!actor) throw new ServiceError("NO_ACTOR", 403);
  // ... business logic, validation, orchestration
}
```

### Service Errors (`src/server/services/errors.ts`)

Services communicate failures via `ServiceError`, decoupled from HTTP:

```typescript
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}
```

### Route Handlers (Controllers)

- **Thin** — parse request, call service, return response
- Handle only HTTP concerns: auth check, body parsing, status codes, response serialization
- Catch `ServiceError` and map to HTTP responses

```typescript
// src/routes/events/-create.ts
import * as EventService from "~/server/services/events";
import { ServiceError } from "~/server/services/errors";

export const POST = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  try {
    const result = await EventService.createEvent(user.id, body);
    return Response.json(result);
  } catch (e) {
    if (e instanceof ServiceError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
};
```

### Migration Strategy

This is a **gradual migration**. Old and new patterns coexist.

- Migration order: Places → Groups → Polls → Events (increasing complexity)
- Each migration: create repository file(s) → create service file → slim route handler → dissolve old `src/server/{domain}/` module
- When touching existing code, migrate it to the new layers if feasible
- Do not refactor unrelated code just to match the new pattern

### What Gets Dissolved

| Current location | Target |
|---|---|
| `src/server/places/*.ts` | `repositories/places.ts` + `services/places.ts` |
| `src/server/events/*.ts` | `repositories/event-*.ts` + `services/events.ts` |
| `src/server/fediverse/group.ts` (createGroupActor) | `services/groups.ts` |
| Inline queries in route handlers | `repositories/*.ts` |
| Inline business logic in route handlers | `services/*.ts` |

## API Routing Rules

- All non-ActivityPub business endpoints registered in `src/server-entry.ts` must live under `/api`.
- Do not register h3 handlers on the same paths used by TanStack Start UI pages.
- Prefer resource-oriented paths and conventional HTTP methods for new endpoints.
- Keep Fedify/ActivityPub endpoints outside `/api`.

## Feature Areas

### Authentication
Three login methods: **Fediverse OTP** (original), **Misskey MiAuth**, and **Mastodon OAuth**.
Users can link multiple Fediverse accounts and set a primary.
- Route handlers: `src/routes/auth/`
- Session/cleanup: `src/server/auth.ts`, `src/server/miauth-sessions.ts`, `src/server/mastodon-oauth-sessions.ts`

### Events
Full event lifecycle: create (draft) → publish → RSVP → dashboard.
Events support tiers, custom registration questions, header images, categories, and venue details.
- Route handlers: `src/routes/events/`
- Dashboard: `src/routes/events/$eventId/dashboard/`
- Event form components: `src/components/event-form/`
- ICS feeds: `GET /groups/@{handle}/events.ics`, `GET /categories/{slug}/events.ics`

### Discussions (CRM)
Event attendees can submit inquiries; organizers can view and reply from the dashboard.
Both organizer-view (authenticated) and public-view endpoints exist.
- Route handlers: `src/routes/events/-discussions*.ts`, `src/routes/events/-discussion-*.ts`
- Dashboard UI: `src/routes/events/$eventId/dashboard/discussions.tsx`

### Groups
Federated Group actors with members, notes/posts, places, polls, and dashboards.
- Route handlers: `src/routes/groups/`
- Dashboard: `src/routes/groups/$identifier/dashboard/`
- RSS feed: `GET /groups/@{handle}/feed.xml`

### Places
Location entities with H3 geo indexing, categories, check-ins, nearby search, and map snapshots.
Groups can have assigned places. Places support AP content negotiation.
- Route handlers: `src/routes/places/`
- Server logic: `src/server/places/`
- Geo: `src/server/geo/`

### Polls
Group polls with federated Question/Vote support via ActivityPub.
- Route handlers: `src/routes/polls/`
- Federation: `src/server/fediverse/poll.ts`

### Admin Panel
Instance-wide admin for users, groups, events, places, banners, categories, and countries.
Access controlled by `INSTANCE_ADMIN_HANDLES` env var.
- Route handlers: `src/routes/admin/`
- Auth check: `src/server/admin.ts`

## ActivityPub (Fedify)

Federation is handled by Fedify (`src/server/fediverse/federation.ts`).
`@fedify/h3` middleware in `src/server-entry.ts` intercepts all federation
requests before TanStack Start routing — no route files needed for AP endpoints.

Endpoints:
- Actor: `/ap/actors/{identifier}` (content-negotiated)
- Inbox: `/ap/actors/{identifier}/inbox` (handles Follow → auto-Accept)
- Shared inbox: `/ap/inbox`
- Outbox: `/ap/actors/{identifier}/outbox`
- Notes: `/ap/notes/{noteId}`
- Questions: `/ap/questions/{questionId}` (OTP challenges + polls)
- Places: `/ap/places/{placeId}`
- WebFinger: `/.well-known/webfinger` (automatic via Fedify `mapHandle`/`mapAlias`)
- NodeInfo: `/.well-known/nodeinfo` → `/nodeinfo/2.1`

Content negotiation in `src/server-entry.ts`:
- `/notes/{uuid}` and `/places/{uuid}` — serves AP objects if Accept header requests it
- `/ap/notes/{noteId}` — redirects browsers to `/notes/{noteId}`
- `/ap/questions/{questionId}` ↔ `/polls/{pollId}` — bidirectional browser/AP redirect

Key pairs (RSA) are auto-generated and stored as JWK in the `actors` table.
Human-readable profiles: Groups at `/groups/@{identifier}`, Users at `/users/@{identifier}`.

## OTP Authentication (Outbox Polling)

- `POST /api/auth/otp-requests` generates a short-lived OTP challenge.
- User posts the OTP publicly on their Fediverse account.
- `POST /api/auth/otp-verifications` resolves the actor, polls the outbox, and verifies OTP.

Other auth methods (Misskey MiAuth, Mastodon OAuth) are described in the Feature Areas section above.

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

See `.env.example` for a template with defaults.

Required:
- `DATABASE_URL` — PostgreSQL connection for the app DB
- `MIGRATION_DATABASE_URL` — PostgreSQL connection for the migration DB

Federation:
- `FEDERATION_DOMAIN` (default `localhost:3000`) — public domain for ActivityPub
- `FEDERATION_HANDLE_DOMAIN` (default = `FEDERATION_DOMAIN`) — domain used in WebFinger handles
- `FEDERATION_PROTOCOL` (default `http`) — `http` or `https`
- `INSTANCE_ACTOR_KEY` — RSA JWK for the instance actor (generate via `pnpm generate-key`)
- `INSTANCE_HANDLE` (default `instance`) — handle for the instance-level actor

S3 / Object Storage:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — credentials
- `S3_BUCKET` — bucket name
- `S3_ENDPOINT` — endpoint URL (e.g. Cloudflare R2)
- `AWS_REGION` (default `auto`)

Auth:
- `OTP_TTL_SECONDS` (default `600`)
- `OTP_POLL_INTERVAL_MS` (default `3000`), `OTP_POLL_TIMEOUT_MS` (default `60000`)

Instance:
- `INSTANCE_ADMIN_HANDLES` — comma-separated `handle@domain` for admin access
- `DEFAULT_TIMEZONE` (default `UTC`) — IANA timezone
- `DEFAULT_LOCALE` (default `en`)
- `MAP_LINK_PROVIDERS` — comma-separated: `google`, `naver`, `kakao`
- `ENABLE_PLACE_AUDIT_LOG` — set to `1` or `true` to enable

Analytics (optional):
- `POSTHOG_KEY`, `POSTHOG_HOST`

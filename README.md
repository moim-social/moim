# Moim

Federated events and places (connpass + foursquare) built on TanStack Start, Drizzle, and ActivityPub.

## Quickstart

```bash
pnpm install
cp .env.example .env
docker-compose up
pnpm db:migrate
pnpm dev
```

## ActivityPub

- Webfinger: `/.well-known/webfinger`
- NodeInfo: `/.well-known/nodeinfo`, `/nodeinfo/2.0`
- Actor: `/ap/{identifier}`
- Inbox: `/ap/{identifier}/inbox`
- Outbox: `/ap/{identifier}/outbox`
- Human profile: `/@/{identifier}`

## OTP Auth

1. `POST /auth/request-otp` with `{ "handle": "alice@example.com" }`
2. Post the OTP on the fediverse.
3. `POST /auth/verify-otp` with `{ "handle": "alice@example.com" }`

<p align="center">
  <img src="moim-logo.png" alt="Moim" width="512" />
</p>

# Moim

Moim is a federated events & places service. In Korean, it is written as '모임', pronounced /mo-im/, like "mo-eem". It means "gathering" or "meetup".

Built on TanStack Start, Drizzle, and ActivityPub.

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


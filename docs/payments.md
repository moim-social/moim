# Payment Integration Self-Hosting Guide

Moim delegates paid ticket checkout and payment confirmation to a separate
payment service. The main Moim server remains the source of truth for events,
ticket tiers, capacity, registration questions, and final RSVPs.

This document describes the expected deployment shape, required environment
variables, setup steps, and common failure modes.

## Architecture

There are two services:

- `moim`: the main application.
- `moim-payment`: the ticket payment service.

Moim does not talk to PortOne directly. Moim creates a pending ticket
reservation, asks `moim-payment` to create a checkout, and creates the final RSVP
only after it receives a signed paid callback from `moim-payment`.

The payment service owns:

- checkout pages
- PortOne browser SDK configuration
- PortOne API secret
- PortOne webhook verification
- payment checkout ledger
- callback delivery to Moim

Moim owns:

- events
- ticket tiers
- registration questions
- capacity and waitlist rules
- pending ticket reservations
- final RSVP creation

## Environment Pairing

Each Moim deployment should be paired with one payment service deployment.

Recommended staging pair:

```text
Moim:    https://moim.kodingwarrior.dev
Payment: https://payment-staging.moim.live
```

Recommended production pair:

```text
Moim:    https://moim.live
Payment: https://payment.moim.live
```

Do not mix staging Moim with production payment credentials, or production Moim
with staging payment credentials.

## Request Flow

Paid registration starts from Moim:

1. User selects a paid ticket tier in Moim.
2. Moim creates a `ticket_reservations` row with `pending_payment`.
3. Moim calls `moim-payment`:

   ```text
   POST {TICKET_PAYMENT_SERVICE_URL}/v1/ticket-checkouts
   Authorization: Bearer {TICKET_PAYMENT_SERVICE_TOKEN}
   ```

4. `moim-payment` returns a checkout URL.
5. Browser redirects to the checkout URL.
6. User completes PortOne payment.
7. Browser returns to:

   ```text
   https://{moim-domain}/events/{eventId}/register?payment=success
   ```

8. `moim-payment` verifies the PortOne payment.
9. `moim-payment` sends a signed callback to Moim:

   ```text
   POST https://{moim-domain}/api/ticket-payment-callbacks
   ```

10. Moim validates the callback and creates the final RSVP.

The browser success page is not the source of truth. The paid callback is.

## Moim Environment Variables

Moim needs only payment-service integration settings. It should not receive
PortOne API secrets.

Staging example:

```env
TICKET_PAYMENT_SERVICE_URL=https://payment-staging.moim.live
TICKET_PAYMENT_SERVICE_TOKEN=replace-with-shared-api-token
TICKET_PAYMENT_CALLBACK_SECRET=replace-with-shared-callback-secret
DEFAULT_PORTONE_PROVIDER_ACCOUNT_ID=kakaopay
```

Production example:

```env
TICKET_PAYMENT_SERVICE_URL=https://payment.moim.live
TICKET_PAYMENT_SERVICE_TOKEN=replace-with-prod-shared-api-token
TICKET_PAYMENT_CALLBACK_SECRET=replace-with-prod-shared-callback-secret
DEFAULT_PORTONE_PROVIDER_ACCOUNT_ID=kakaopay
```

These values must match the payment service:

```text
Moim TICKET_PAYMENT_SERVICE_TOKEN
= moim-payment PAYMENT_SERVICE_API_TOKEN

Moim TICKET_PAYMENT_CALLBACK_SECRET
= moim-payment TICKET_PAYMENT_CALLBACK_SECRET
```

## moim-payment Environment Variables

The payment service needs its public URL, Moim allowlist, shared tokens, PortOne
credentials, and database connection.

Staging example:

```env
BASE_URL=https://payment-staging.moim.live
ALLOWED_ORIGINS=https://moim.kodingwarrior.dev
DATABASE_URL=postgresql://...

PAYMENT_SERVICE_API_TOKEN=replace-with-shared-api-token
TICKET_PAYMENT_CALLBACK_SECRET=replace-with-shared-callback-secret

PORTONE_API_SECRET=replace-with-portone-api-secret
PORTONE_WEBHOOK_SECRET=replace-with-portone-webhook-secret

DEFAULT_ENABLED_EASY_PAY_PROVIDERS=kakaopay
PORTONE_KAKAOPAY_STORE_ID=replace-with-portone-store-id
PORTONE_KAKAOPAY_CHANNEL_KEY=replace-with-portone-channel-key

PORTONE_TOSSPAY_STORE_ID=
PORTONE_TOSSPAY_CHANNEL_KEY=

PORTONE_NAVERPAY_ENABLED=false
PORTONE_NAVERPAY_STORE_ID=
PORTONE_NAVERPAY_CHANNEL_KEY=
```

Production example:

```env
BASE_URL=https://payment.moim.live
ALLOWED_ORIGINS=https://moim.live
DATABASE_URL=postgresql://...

PAYMENT_SERVICE_API_TOKEN=replace-with-prod-shared-api-token
TICKET_PAYMENT_CALLBACK_SECRET=replace-with-prod-shared-callback-secret

PORTONE_API_SECRET=replace-with-prod-portone-api-secret
PORTONE_WEBHOOK_SECRET=replace-with-prod-portone-webhook-secret

DEFAULT_ENABLED_EASY_PAY_PROVIDERS=kakaopay
PORTONE_KAKAOPAY_STORE_ID=replace-with-prod-portone-store-id
PORTONE_KAKAOPAY_CHANNEL_KEY=replace-with-prod-portone-channel-key

PORTONE_TOSSPAY_STORE_ID=
PORTONE_TOSSPAY_CHANNEL_KEY=

PORTONE_NAVERPAY_ENABLED=false
PORTONE_NAVERPAY_STORE_ID=
PORTONE_NAVERPAY_CHANNEL_KEY=
```

Do not use `PROVIDER_ACCOUNTS_JSON` for normal deployments. Provider accounts
are configured from individual `PORTONE_*` environment variables.

## PortOne Console Settings

For each environment, configure PortOne with the payment service webhook URL:

```text
https://payment-staging.moim.live/webhooks/portone
https://payment.moim.live/webhooks/portone
```

Use the corresponding `PORTONE_WEBHOOK_SECRET` from the PortOne webhook settings.

For KakaoPay, the payment service needs:

- Store ID
- Channel Key
- API Secret
- Webhook Secret

The KakaoPay CID/MID shown in the PortOne console is not the same as the channel
key used by the PortOne browser SDK.

## Database Setup

Moim and `moim-payment` use separate databases.

Moim migrations create:

- `event_ticketing_settings`
- `ticket_reservations`
- `ticket_payments`

The payment service migration creates:

- `ticket_checkouts`
- `callback_events`

For `moim-payment`, apply:

```text
moim-payment/migrations/001_init.sql
```

If using Kubernetes and the payment image does not include a database client,
use a temporary Postgres client pod:

```sh
DB_URL="$(kubectl -n payment-staging exec deploy/payment-staging -- sh -lc 'printf %s "$DATABASE_URL"')"

kubectl -n payment-staging run psql-client \
  --rm -i \
  --restart=Never \
  --image=postgres:16-alpine \
  --env="DATABASE_URL=$DB_URL" \
  -- sh -lc 'psql "$DATABASE_URL" -c "\dt"'
```

The expected payment tables are:

```text
ticket_checkouts
callback_events
```

## Kubernetes Notes

For staging, a minimal deployment should include:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: payment-staging-db-app
        key: uri

  - name: BASE_URL
    value: "https://payment-staging.moim.live"

  - name: ALLOWED_ORIGINS
    value: "https://moim.kodingwarrior.dev"

  - name: DEFAULT_ENABLED_EASY_PAY_PROVIDERS
    value: "kakaopay"

  - name: PORTONE_NAVERPAY_ENABLED
    value: "false"
```

Secrets should come from a Kubernetes Secret such as `payment-staging-env`:

```yaml
  - name: PAYMENT_SERVICE_API_TOKEN
    valueFrom:
      secretKeyRef:
        name: payment-staging-env
        key: PAYMENT_SERVICE_API_TOKEN

  - name: TICKET_PAYMENT_CALLBACK_SECRET
    valueFrom:
      secretKeyRef:
        name: payment-staging-env
        key: TICKET_PAYMENT_CALLBACK_SECRET

  - name: PORTONE_API_SECRET
    valueFrom:
      secretKeyRef:
        name: payment-staging-env
        key: PORTONE_API_SECRET

  - name: PORTONE_WEBHOOK_SECRET
    valueFrom:
      secretKeyRef:
        name: payment-staging-env
        key: PORTONE_WEBHOOK_SECRET

  - name: PORTONE_KAKAOPAY_STORE_ID
    valueFrom:
      secretKeyRef:
        name: payment-staging-env
        key: PORTONE_KAKAOPAY_STORE_ID

  - name: PORTONE_KAKAOPAY_CHANNEL_KEY
    valueFrom:
      secretKeyRef:
        name: payment-staging-env
        key: PORTONE_KAKAOPAY_CHANNEL_KEY
```

For production, use a separate namespace, database, secret, token pair, callback
secret, domain, and PortOne credentials.

## Verification

Check public health:

```sh
curl -i https://payment-staging.moim.live/healthz
curl -i https://payment.moim.live/healthz
```

Check payment service env:

```sh
kubectl -n payment-staging exec deploy/payment-staging -- sh -lc \
  'env | sort | grep -E "BASE_URL|ALLOWED_ORIGINS|DATABASE_URL|DEFAULT_ENABLED|PORTONE_KAKAOPAY|PORTONE_NAVERPAY"'
```

Check recent checkout and callback status:

```sh
DB_URL="$(kubectl -n payment-staging exec deploy/payment-staging -- sh -lc 'printf %s "$DATABASE_URL"')"

kubectl -n payment-staging run psql-client \
  --rm -i \
  --restart=Never \
  --image=postgres:16-alpine \
  --env="DATABASE_URL=$DB_URL" \
  -- sh -lc 'psql "$DATABASE_URL" -x \
    -c "select id, reservation_id, status, provider_payment_id, provider_tx_id, paid_at, created_at from ticket_checkouts order by created_at desc limit 3;" \
    -c "select checkout_id, payment_id, status, attempts, last_error, delivered_at, created_at from callback_events order by created_at desc limit 3;"'
```

Healthy final state:

```text
ticket_checkouts.status = paid
callback_events.status = delivered
```

Then confirm in Moim that an RSVP exists for the paid tier.

## Troubleshooting

### Checkout URL points to localhost

Symptom:

```text
http://localhost:8080/checkouts/...
```

Cause:

```text
moim-payment BASE_URL is missing
```

Fix:

```env
BASE_URL=https://payment-staging.moim.live
```

or:

```env
BASE_URL=https://payment.moim.live
```

### PortOne request uses test-store or test-kakaopay-channel

Symptom:

```json
{
  "storeId": "test-store",
  "channelKey": "test-kakaopay-channel"
}
```

Cause:

```text
moim-payment is not receiving or using PORTONE_KAKAOPAY_STORE_ID /
PORTONE_KAKAOPAY_CHANNEL_KEY
```

Fix:

```env
PORTONE_KAKAOPAY_STORE_ID=...
PORTONE_KAKAOPAY_CHANNEL_KEY=...
DEFAULT_ENABLED_EASY_PAY_PROVIDERS=kakaopay
```

Redeploy `moim-payment` after changing these values.

### Moim returns 502 when starting RSVP payment

Possible causes:

- `TICKET_PAYMENT_SERVICE_URL` points to the wrong payment service.
- `TICKET_PAYMENT_SERVICE_TOKEN` does not match
  `PAYMENT_SERVICE_API_TOKEN`.
- `moim-payment` is returning 500.
- payment DB tables are missing.

Check payment logs:

```sh
kubectl -n payment-staging logs -f deploy/payment-staging --tail 100
```

### relation "event_ticketing_settings" does not exist

Cause:

```text
Moim DB migrations were not applied
```

Fix: apply Moim migrations, including the migration that creates:

```text
event_ticketing_settings
ticket_reservations
ticket_payments
```

### relation "ticket_checkouts" does not exist

Cause:

```text
moim-payment DB migration was not applied
```

Fix: apply `moim-payment/migrations/001_init.sql`.

### Success page stays on "Payment is being confirmed"

This means the browser returned to Moim, but Moim has not created the final RSVP
yet.

Check:

```text
ticket_checkouts.status
callback_events.status
callback_events.last_error
```

Interpretation:

```text
ticket_checkouts.status != paid
=> PortOne complete/webhook confirmation did not finish

ticket_checkouts.status = paid and callback_events missing
=> moim-payment did not create callback event

callback_events.status = failed or retry_scheduled
=> Moim callback failed; inspect last_error

callback_events.status = delivered but Moim has no RSVP
=> inspect Moim callback handler logs and reservation/payment rows
```

### paid checkout is missing payment fields

Cause:

```text
moim-payment marked checkout paid but did not have a provider payment ID or paidAt
when creating the callback
```

Fix: deploy a `moim-payment` version that falls back to the requested PortOne
payment ID when the PortOne response omits `paymentId`.

### callback secret mismatch

Symptom:

```text
Payment service callback reaches Moim, but Moim rejects it
```

Cause:

```text
Moim TICKET_PAYMENT_CALLBACK_SECRET
!= moim-payment TICKET_PAYMENT_CALLBACK_SECRET
```

Fix: set the same callback secret on both services.

### PortOne webhook signature failure

Cause:

```text
PORTONE_WEBHOOK_SECRET does not match the secret configured in PortOne webhook settings
```

Fix: copy the exact webhook secret from the PortOne console into
`moim-payment`.

## Operational Notes

- Keep staging and production tokens separate.
- Do not place PortOne API secrets in the Moim app.
- Do not commit real secrets to Git.
- Rotate secrets that were exposed in logs, chat, screenshots, or terminal
  history.
- During payment feature development, deploy compatible versions of `moim` and
  `moim-payment` together.
- For payment review, test the exact production domain pair:

  ```text
  https://moim.live
  https://payment.moim.live
  ```


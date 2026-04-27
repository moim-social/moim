import { describe, expect, it, vi } from "vitest";
import { TicketPaymentClient, type CreateTicketCheckoutInput } from "./ticket-payment-client";

const input: CreateTicketCheckoutInput = {
  provider: "portone",
  paymentMethodFamily: "easy_pay",
  reservationId: "reservation-1",
  eventId: "event-1",
  tierId: "tier-1",
  orderName: "MoimConf - General",
  amount: 15000,
  currency: "KRW",
  customer: { moimUserId: "user-1", name: "Kim", email: "kim@example.com" },
  successUrl: "https://moim.example/events/event-1/register/success",
  cancelUrl: "https://moim.example/events/event-1/register",
  callbackUrl: "https://moim.example/api/ticket-payment-callbacks",
};

describe("TicketPaymentClient", () => {
  it("sends auth and idempotency headers when creating a checkout", async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      checkoutId: "checkout-1",
      checkoutUrl: "https://payment.example/checkouts/checkout-1",
      status: "requires_payment",
    }));
    const client = new TicketPaymentClient({
      baseUrl: "https://payment.example",
      token: "service-token",
      fetchImpl,
    });

    await expect(client.createCheckout(input)).resolves.toEqual({
      checkoutId: "checkout-1",
      checkoutUrl: "https://payment.example/checkouts/checkout-1",
      status: "requires_payment",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://payment.example/v1/ticket-checkouts"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer service-token",
          "Content-Type": "application/json",
          "Idempotency-Key": "reservation:reservation-1",
        }),
        body: JSON.stringify(input),
      }),
    );
  });

  it("throws a typed error on non-2xx responses", async () => {
    const client = new TicketPaymentClient({
      baseUrl: "https://payment.example",
      token: "service-token",
      fetchImpl: vi.fn(async () => new Response("nope", { status: 503 })),
    });

    await expect(client.createCheckout(input)).rejects.toMatchObject({
      code: "CHECKOUT_CREATE_FAILED",
    });
  });

  it("throws a typed error on malformed success responses", async () => {
    const client = new TicketPaymentClient({
      baseUrl: "https://payment.example",
      token: "service-token",
      fetchImpl: vi.fn(async () => Response.json({ checkoutId: "checkout-1" })),
    });

    await expect(client.createCheckout(input)).rejects.toMatchObject({
      code: "CHECKOUT_CREATE_INVALID_RESPONSE",
    });
  });
});

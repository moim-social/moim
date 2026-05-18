import { describe, expect, it } from "vitest";
import {
  parseTicketPaymentPaidCallback,
  signTicketPaymentCallback,
  verifyTicketPaymentCallbackSignature,
} from "./ticket-payment-callback";

describe("ticket payment callback signing", () => {
  it("creates deterministic HMAC signatures and verifies them", () => {
    const body = JSON.stringify({ type: "ticket_payment.paid", reservationId: "reservation-1" });
    const signature = signTicketPaymentCallback(body, "secret");

    expect(signature).toBe("cefa120975b3de92e7de589cd6a62f86bbb2b0d13b625ac1f235e4e95c3cdea8");
    expect(verifyTicketPaymentCallbackSignature(body, signature, "secret")).toBe(true);
    expect(verifyTicketPaymentCallbackSignature(body, signature, "other")).toBe(false);
    expect(verifyTicketPaymentCallbackSignature(body, null, "secret")).toBe(false);
  });
});

describe("parseTicketPaymentPaidCallback", () => {
  it("parses valid paid callbacks", () => {
    expect(parseTicketPaymentPaidCallback(JSON.stringify({
      type: "ticket_payment.paid",
      reservationId: "reservation-1",
      checkoutId: "checkout-1",
      paymentId: "payment-1",
      txId: "tx-1",
      provider: "portone",
      amount: 15000,
      currency: "KRW",
      paidAt: "2026-04-27T12:00:00.000Z",
    }))).toEqual({
      type: "ticket_payment.paid",
      reservationId: "reservation-1",
      checkoutId: "checkout-1",
      paymentId: "payment-1",
      txId: "tx-1",
      provider: "portone",
      amount: 15000,
      currency: "KRW",
      paidAt: "2026-04-27T12:00:00.000Z",
    });
  });

  it("rejects malformed callbacks", () => {
    expect(parseTicketPaymentPaidCallback(JSON.stringify({ type: "ticket_payment.paid" }))).toBeNull();
  });
});

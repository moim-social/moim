import { describe, expect, it } from "vitest";
import {
  deriveTicketingSettings,
  tierRequiresPayment,
  validatePaidCallbackForReservation,
  type PaidTicketCallbackPayload,
  type TicketReservationSnapshot,
} from "./ticketing-domain";

describe("tierRequiresPayment", () => {
  it("treats null, missing, and zero prices as free", () => {
    expect(tierRequiresPayment(null)).toBe(false);
    expect(tierRequiresPayment({})).toBe(false);
    expect(tierRequiresPayment({ priceAmount: null })).toBe(false);
    expect(tierRequiresPayment({ priceAmount: 0 })).toBe(false);
  });

  it("treats positive prices as paid", () => {
    expect(tierRequiresPayment({ priceAmount: 1 })).toBe(true);
  });
});

describe("deriveTicketingSettings", () => {
  it("uses free mode and no provider when all tiers are free", () => {
    expect(deriveTicketingSettings([{ priceAmount: null }, { priceAmount: 0 }])).toEqual({
      mode: "free",
      provider: null,
      providerAccountId: null,
      currency: null,
      enabled: true,
    });
  });

  it("uses PortOne paid settings when any tier is paid", () => {
    expect(
      deriveTicketingSettings(
        [{ priceAmount: 0 }, { priceAmount: 15000 }],
        { defaultProviderAccountId: "portone_kakaopay" },
      ),
    ).toEqual({
      mode: "paid",
      provider: "portone",
      providerAccountId: "portone_kakaopay",
      currency: "KRW",
      enabled: true,
    });
  });
});

describe("validatePaidCallbackForReservation", () => {
  const now = new Date("2026-04-27T12:00:00.000Z");
  const reservation: TicketReservationSnapshot = {
    id: "reservation-1",
    status: "pending_payment",
    checkoutId: "checkout-1",
    provider: "portone",
    amount: 15000,
    currency: "KRW",
    expiresAt: new Date("2026-04-27T12:10:00.000Z"),
  };
  const payload: PaidTicketCallbackPayload = {
    type: "ticket_payment.paid",
    reservationId: "reservation-1",
    checkoutId: "checkout-1",
    paymentId: "payment-1",
    txId: "tx-1",
    provider: "portone",
    amount: 15000,
    currency: "KRW",
    paidAt: "2026-04-27T12:01:00.000Z",
  };

  it("accepts a matching pending reservation", () => {
    expect(validatePaidCallbackForReservation(reservation, payload, now)).toEqual({ ok: true });
  });

  it("marks already confirmed reservations as idempotent", () => {
    expect(
      validatePaidCallbackForReservation(
        { ...reservation, status: "confirmed" },
        payload,
        now,
      ),
    ).toEqual({ ok: false, reason: "already_confirmed" });
  });

  it("rejects non-pending reservations", () => {
    expect(
      validatePaidCallbackForReservation(
        { ...reservation, status: "cancelled" },
        payload,
        now,
      ),
    ).toEqual({ ok: false, reason: "invalid_status" });
  });

  it("rejects expired reservations", () => {
    expect(
      validatePaidCallbackForReservation(
        { ...reservation, expiresAt: now },
        payload,
        now,
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects amount, currency, checkout, provider, or reservation mismatches", () => {
    expect(validatePaidCallbackForReservation(reservation, { ...payload, amount: 1000 }, now)).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(validatePaidCallbackForReservation(reservation, { ...payload, currency: "USD" }, now)).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(validatePaidCallbackForReservation(reservation, { ...payload, checkoutId: "other" }, now)).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(validatePaidCallbackForReservation(reservation, { ...payload, provider: "other" }, now)).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(validatePaidCallbackForReservation(reservation, { ...payload, reservationId: "other" }, now)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
});

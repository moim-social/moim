import { describe, expect, it, vi } from "vitest";
import {
  deriveNewEventTicketingSettings,
  startPaidRegistration,
  type StartPaidRegistrationDeps,
  type TicketPaymentRecord,
  type TicketReservationRecord,
} from "./ticketing";

function createDeps(overrides: Partial<StartPaidRegistrationDeps> = {}) {
  const reservations: TicketReservationRecord[] = [];
  const payments: TicketPaymentRecord[] = [];
  const deps: StartPaidRegistrationDeps = {
    getTicketingSetting: vi.fn(async (eventId) => ({
      eventId,
      mode: "paid" as const,
      provider: "portone" as const,
      providerAccountId: "portone_kakaopay",
      currency: "KRW",
      enabled: true,
    })),
    createReservation: vi.fn(async (values) => {
      const reservation: TicketReservationRecord = {
        ...values,
        id: `reservation-${reservations.length + 1}`,
        checkoutId: null,
      };
      reservations.push(reservation);
      return reservation;
    }),
    setReservationCheckoutId: vi.fn(async (reservationId, checkoutId) => {
      const reservation = reservations.find((row) => row.id === reservationId);
      if (reservation) reservation.checkoutId = checkoutId;
    }),
    createPayment: vi.fn(async (values) => {
      payments.push(values);
    }),
    createCheckout: vi.fn(async () => ({
      checkoutId: "checkout-1",
      checkoutUrl: "https://payment.example/checkouts/checkout-1",
      status: "requires_payment" as const,
    })),
    now: () => new Date("2026-04-27T12:00:00.000Z"),
    addMinutes: (date, minutes) => new Date(date.getTime() + minutes * 60_000),
    ...overrides,
  };

  return { deps, reservations, payments };
}

const paidInput = {
  event: { id: "event-1", title: "MoimConf" },
  tier: { id: "tier-1", name: "General", priceAmount: 15000 },
  userId: "user-1",
  customer: { name: "Kim", email: "kim@example.com" },
  answers: [{ questionId: "question-1", answer: "Yes" }],
  baseUrl: "https://moim.example",
  callbackUrl: "https://moim.example/api/ticket-payment-callbacks",
};

describe("deriveNewEventTicketingSettings", () => {
  it("keeps free-only events providerless", () => {
    expect(deriveNewEventTicketingSettings([{ priceAmount: null }, { priceAmount: 0 }])).toEqual({
      mode: "free",
      provider: null,
      providerAccountId: null,
      currency: null,
      enabled: true,
    });
  });

  it("defaults paid events to PortOne", () => {
    expect(deriveNewEventTicketingSettings([{ priceAmount: 15000 }], "portone_kakaopay")).toEqual({
      mode: "paid",
      provider: "portone",
      providerAccountId: "portone_kakaopay",
      currency: "KRW",
      enabled: true,
    });
  });
});

describe("startPaidRegistration", () => {
  it("does not enter payment flow for free tiers", async () => {
    const { deps } = createDeps();

    await expect(
      startPaidRegistration(
        { ...paidInput, tier: { ...paidInput.tier, priceAmount: 0 } },
        deps,
      ),
    ).resolves.toEqual({ requiresPayment: false });
    expect(deps.createReservation).not.toHaveBeenCalled();
    expect(deps.createCheckout).not.toHaveBeenCalled();
  });

  it("creates a reservation, checkout, and requires_payment record for paid tiers", async () => {
    const { deps, reservations, payments } = createDeps();

    await expect(startPaidRegistration(paidInput, deps)).resolves.toEqual({
      requiresPayment: true,
      reservationId: "reservation-1",
      checkoutId: "checkout-1",
      checkoutUrl: "https://payment.example/checkouts/checkout-1",
    });

    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      eventId: "event-1",
      tierId: "tier-1",
      userId: "user-1",
      provider: "portone",
      providerAccountId: "portone_kakaopay",
      amount: 15000,
      currency: "KRW",
      status: "pending_payment",
      checkoutId: "checkout-1",
      answersSnapshot: [{ questionId: "question-1", answer: "Yes" }],
    });
    expect(deps.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "portone",
        paymentMethodFamily: "easy_pay",
        reservationId: "reservation-1",
        amount: 15000,
        currency: "KRW",
        successUrl: "https://moim.example/events/event-1/register/success",
        cancelUrl: "https://moim.example/events/event-1/register",
      }),
      "reservation:reservation-1",
    );
    expect(payments).toEqual([
      {
        reservationId: "reservation-1",
        checkoutId: "checkout-1",
        provider: "portone",
        status: "requires_payment",
        amount: 15000,
        currency: "KRW",
      },
    ]);
  });

  it("rejects paid registration when paid ticketing is disabled", async () => {
    const { deps } = createDeps({
      getTicketingSetting: vi.fn(async (eventId) => ({
        eventId,
        mode: "paid" as const,
        provider: "portone" as const,
        providerAccountId: "portone_kakaopay",
        currency: "KRW",
        enabled: false,
      })),
    });

    await expect(startPaidRegistration(paidInput, deps)).rejects.toMatchObject({
      code: "PAID_TICKETING_NOT_ENABLED",
    });
    expect(deps.createReservation).not.toHaveBeenCalled();
  });

  it("does not create a payment record if checkout creation fails", async () => {
    const { deps, reservations, payments } = createDeps({
      createCheckout: vi.fn(async () => {
        throw new Error("payment service unavailable");
      }),
    });

    await expect(startPaidRegistration(paidInput, deps)).rejects.toThrow("payment service unavailable");
    expect(reservations).toHaveLength(1);
    expect(payments).toHaveLength(0);
    expect(deps.setReservationCheckoutId).not.toHaveBeenCalled();
  });
});

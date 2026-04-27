import { deriveTicketingSettings, tierRequiresPayment, type DerivedTicketingSettings } from "./ticketing-domain";

export interface RegistrationAnswerInput {
  questionId: string;
  answer: string;
}

export interface PaidRegistrationTier {
  id: string;
  name: string;
  priceAmount: number | null;
}

export interface PaidRegistrationEvent {
  id: string;
  title: string;
}

export interface TicketingSettingInput extends DerivedTicketingSettings {
  eventId: string;
}

export interface TicketReservationRecord {
  id: string;
  eventId: string;
  tierId: string;
  userId: string;
  provider: string;
  providerAccountId: string | null;
  amount: number;
  currency: string;
  status: "pending_payment";
  checkoutId: string | null;
  answersSnapshot: RegistrationAnswerInput[];
  expiresAt: Date;
}

export interface TicketPaymentRecord {
  reservationId: string;
  checkoutId: string;
  provider: string;
  status: "requires_payment";
  amount: number;
  currency: string;
}

export interface TicketCheckoutRequest {
  provider: "portone";
  paymentMethodFamily: "easy_pay";
  reservationId: string;
  eventId: string;
  tierId: string;
  orderName: string;
  amount: number;
  currency: string;
  customer: {
    moimUserId: string;
    name?: string;
    email?: string;
  };
  successUrl: string;
  cancelUrl: string;
  callbackUrl: string;
}

export interface TicketCheckoutResponse {
  checkoutId: string;
  checkoutUrl: string;
  status: "requires_payment";
}

export interface StartPaidRegistrationDeps {
  getTicketingSetting(eventId: string): Promise<TicketingSettingInput | null>;
  createReservation(values: Omit<TicketReservationRecord, "id" | "checkoutId">): Promise<TicketReservationRecord>;
  setReservationCheckoutId(reservationId: string, checkoutId: string): Promise<void>;
  createPayment(values: TicketPaymentRecord): Promise<void>;
  createCheckout(input: TicketCheckoutRequest, idempotencyKey: string): Promise<TicketCheckoutResponse>;
  now(): Date;
  addMinutes(date: Date, minutes: number): Date;
}

export interface StartPaidRegistrationInput {
  event: PaidRegistrationEvent;
  tier: PaidRegistrationTier;
  userId: string;
  customer: {
    name?: string;
    email?: string;
  };
  answers: RegistrationAnswerInput[];
  baseUrl: string;
  callbackUrl: string;
}

export type StartPaidRegistrationResult =
  | { requiresPayment: false }
  | {
      requiresPayment: true;
      reservationId: string;
      checkoutId: string;
      checkoutUrl: string;
    };

export class TicketingError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

export function deriveNewEventTicketingSettings(
  tiers: Array<{ priceAmount?: number | null }>,
  defaultProviderAccountId?: string | null,
): DerivedTicketingSettings {
  return deriveTicketingSettings(tiers, { defaultProviderAccountId });
}

export async function startPaidRegistration(
  input: StartPaidRegistrationInput,
  deps: StartPaidRegistrationDeps,
): Promise<StartPaidRegistrationResult> {
  if (!tierRequiresPayment(input.tier)) {
    return { requiresPayment: false };
  }

  const setting = await deps.getTicketingSetting(input.event.id);
  if (!setting || setting.mode !== "paid" || !setting.enabled || setting.provider !== "portone") {
    throw new TicketingError("PAID_TICKETING_NOT_ENABLED");
  }
  if (!setting.currency) {
    throw new TicketingError("PAID_TICKETING_CURRENCY_MISSING");
  }

  const amount = input.tier.priceAmount;
  if (amount == null || amount <= 0) {
    return { requiresPayment: false };
  }

  const reservation = await deps.createReservation({
    eventId: input.event.id,
    tierId: input.tier.id,
    userId: input.userId,
    provider: setting.provider,
    providerAccountId: setting.providerAccountId,
    amount,
    currency: setting.currency,
    status: "pending_payment",
    answersSnapshot: input.answers,
    expiresAt: deps.addMinutes(deps.now(), 10),
  });

  const checkout = await deps.createCheckout(
    {
      provider: "portone",
      paymentMethodFamily: "easy_pay",
      reservationId: reservation.id,
      eventId: input.event.id,
      tierId: input.tier.id,
      orderName: `${input.event.title} - ${input.tier.name}`,
      amount,
      currency: setting.currency,
      customer: {
        moimUserId: input.userId,
        ...input.customer,
      },
      successUrl: `${input.baseUrl}/events/${input.event.id}/register?payment=success`,
      cancelUrl: `${input.baseUrl}/events/${input.event.id}/register?payment=cancel`,
      callbackUrl: input.callbackUrl,
    },
    `reservation:${reservation.id}`,
  );

  await deps.setReservationCheckoutId(reservation.id, checkout.checkoutId);
  await deps.createPayment({
    reservationId: reservation.id,
    checkoutId: checkout.checkoutId,
    provider: setting.provider,
    status: "requires_payment",
    amount,
    currency: setting.currency,
  });

  return {
    requiresPayment: true,
    reservationId: reservation.id,
    checkoutId: checkout.checkoutId,
    checkoutUrl: checkout.checkoutUrl,
  };
}

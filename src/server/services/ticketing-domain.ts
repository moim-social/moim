export type TicketingMode = "free" | "paid" | "external";
export type TicketingProvider = "portone" | "opencollective";
export type ReservationStatus = "pending_payment" | "confirmed" | "expired" | "cancelled";

export interface TicketTierInput {
  priceAmount?: number | null;
}

export interface DerivedTicketingSettings {
  mode: TicketingMode;
  provider: TicketingProvider | null;
  providerAccountId: string | null;
  currency: string | null;
  enabled: boolean;
}

export interface DeriveTicketingSettingsOptions {
  defaultProviderAccountId?: string | null;
  currency?: string;
}

export function tierRequiresPayment(tier: TicketTierInput | null | undefined): boolean {
  return (tier?.priceAmount ?? 0) > 0;
}

export function deriveTicketingSettings(
  tiers: TicketTierInput[],
  options: DeriveTicketingSettingsOptions = {},
): DerivedTicketingSettings {
  const hasPaidTier = tiers.some(tierRequiresPayment);

  if (!hasPaidTier) {
    return {
      mode: "free",
      provider: null,
      providerAccountId: null,
      currency: null,
      enabled: true,
    };
  }

  return {
    mode: "paid",
    provider: "portone",
    providerAccountId: options.defaultProviderAccountId ?? null,
    currency: options.currency ?? "KRW",
    enabled: true,
  };
}

export interface TicketReservationSnapshot {
  id: string;
  status: ReservationStatus;
  checkoutId: string | null;
  provider: string;
  amount: number;
  currency: string;
  expiresAt: Date;
}

export interface PaidTicketCallbackPayload {
  type: "ticket_payment.paid";
  reservationId: string;
  checkoutId: string;
  paymentId: string;
  txId?: string | null;
  provider: string;
  amount: number;
  currency: string;
  paidAt: string;
}

export type CallbackValidationResult =
  | { ok: true }
  | { ok: false; reason: "already_confirmed" | "invalid_status" | "expired" | "mismatch" };

export function validatePaidCallbackForReservation(
  reservation: TicketReservationSnapshot,
  payload: PaidTicketCallbackPayload,
  now: Date,
): CallbackValidationResult {
  if (reservation.status === "confirmed") {
    return { ok: false, reason: "already_confirmed" };
  }

  if (reservation.status !== "pending_payment") {
    return { ok: false, reason: "invalid_status" };
  }

  if (reservation.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }

  if (
    reservation.id !== payload.reservationId ||
    reservation.checkoutId !== payload.checkoutId ||
    reservation.provider !== payload.provider ||
    reservation.amount !== payload.amount ||
    reservation.currency !== payload.currency
  ) {
    return { ok: false, reason: "mismatch" };
  }

  return { ok: true };
}

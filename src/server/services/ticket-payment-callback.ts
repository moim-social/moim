import { createHmac, timingSafeEqual } from "node:crypto";

export interface TicketPaymentPaidCallback {
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

export function signTicketPaymentCallback(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyTicketPaymentCallbackSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = signTicketPaymentCallback(body, secret);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseTicketPaymentPaidCallback(body: string): TicketPaymentPaidCallback | null {
  const value = JSON.parse(body) as Partial<TicketPaymentPaidCallback>;
  if (
    value.type !== "ticket_payment.paid" ||
    typeof value.reservationId !== "string" ||
    typeof value.checkoutId !== "string" ||
    typeof value.paymentId !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.amount !== "number" ||
    typeof value.currency !== "string" ||
    typeof value.paidAt !== "string"
  ) {
    return null;
  }
  return {
    type: value.type,
    reservationId: value.reservationId,
    checkoutId: value.checkoutId,
    paymentId: value.paymentId,
    txId: value.txId ?? null,
    provider: value.provider,
    amount: value.amount,
    currency: value.currency,
    paidAt: value.paidAt,
  };
}

export interface CreateTicketCheckoutInput {
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

export interface CreateTicketCheckoutOutput {
  checkoutId: string;
  checkoutUrl: string;
  status: "requires_payment";
}

export interface TicketPaymentClientConfig {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class TicketPaymentClientError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

export class TicketPaymentClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: TicketPaymentClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async createCheckout(input: CreateTicketCheckoutInput): Promise<CreateTicketCheckoutOutput> {
    const response = await this.fetchImpl(new URL("/v1/ticket-checkouts", this.config.baseUrl), {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `reservation:${input.reservationId}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new TicketPaymentClientError("CHECKOUT_CREATE_FAILED", `Payment service returned ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as Partial<CreateTicketCheckoutOutput> | null;
    if (
      !body ||
      typeof body.checkoutId !== "string" ||
      typeof body.checkoutUrl !== "string" ||
      body.status !== "requires_payment"
    ) {
      throw new TicketPaymentClientError("CHECKOUT_CREATE_INVALID_RESPONSE");
    }

    return {
      checkoutId: body.checkoutId,
      checkoutUrl: body.checkoutUrl,
      status: body.status,
    };
  }
}

export function createTicketPaymentClientFromEnv(): TicketPaymentClient {
  const baseUrl = process.env.TICKET_PAYMENT_SERVICE_URL;
  const token = process.env.TICKET_PAYMENT_SERVICE_TOKEN;

  if (!baseUrl || !token) {
    throw new TicketPaymentClientError("TICKET_PAYMENT_SERVICE_NOT_CONFIGURED");
  }

  return new TicketPaymentClient({ baseUrl, token });
}

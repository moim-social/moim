export const env = {
  // Federation
  federationDomain: process.env.FEDERATION_DOMAIN ?? "localhost:3000",
  federationHandleDomain:
    process.env.FEDERATION_HANDLE_DOMAIN ??
    process.env.FEDERATION_DOMAIN ??
    "localhost:3000",
  federationProtocol: process.env.FEDERATION_PROTOCOL ?? "http",
  instanceActorKey: process.env.INSTANCE_ACTOR_KEY || undefined,

  // Computed
  get federationOrigin(): string {
    return `${this.federationProtocol}://${this.federationDomain}`;
  },
  get baseUrl(): string {
    return this.federationOrigin;
  },

  // Existing
  otpTtlSeconds: Number.parseInt(process.env.OTP_TTL_SECONDS ?? "600", 10),
  otpPollIntervalMs: Number.parseInt(
    process.env.OTP_POLL_INTERVAL_MS ?? "3000",
    10,
  ),
  otpPollTimeoutMs: Number.parseInt(
    process.env.OTP_POLL_TIMEOUT_MS ?? "60000",
    10,
  ),
};

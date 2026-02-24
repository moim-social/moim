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

  // OTP
  otpTtlSeconds: Number.parseInt(process.env.OTP_TTL_SECONDS ?? "600", 10),
};

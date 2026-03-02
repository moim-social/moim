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

  // S3 / Cloudflare R2
  s3Endpoint: process.env.S3_ENDPOINT || undefined,
  s3Bucket: process.env.S3_BUCKET || undefined,
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined,
  s3Region: process.env.AWS_REGION ?? "auto",

  // Admin (comma-separated @handle@domain notation, e.g. @alice@mastodon.social)
  instanceAdminHandles: (process.env.INSTANCE_ADMIN_HANDLES ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),

  // Map link providers (comma-separated: kakao,naver,google)
  mapLinkProviders: (process.env.MAP_LINK_PROVIDERS ?? "").split(",").map(s => s.trim()).filter(Boolean),

  // PostHog (optional)
  posthogKey: process.env.POSTHOG_KEY || undefined,
  posthogHost: process.env.POSTHOG_HOST || undefined,
};

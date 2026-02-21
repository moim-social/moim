export const env = {
  baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  instanceHandle: process.env.INSTANCE_HANDLE ?? "instance",
  otpTtlSeconds: Number.parseInt(process.env.OTP_TTL_SECONDS ?? "600", 10),
  otpPollIntervalMs: Number.parseInt(process.env.OTP_POLL_INTERVAL_MS ?? "3000", 10),
  otpPollTimeoutMs: Number.parseInt(process.env.OTP_POLL_TIMEOUT_MS ?? "60000", 10),
};

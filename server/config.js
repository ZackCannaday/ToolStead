import { z } from "zod";

const booleanValue = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() === "true" : value),
  z.boolean(),
);

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: booleanValue.default(false),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://toolstead:toolstead@127.0.0.1:5432/toolstead"),
  DATABASE_SSL: booleanValue.default(false),
  JWT_SECRET: z
    .string()
    .min(32)
    .default("development-only-jwt-secret-change-before-production"),
  COOKIE_SECRET: z
    .string()
    .min(32)
    .default("development-only-cookie-secret-change-before-production"),
  ACCESS_TOKEN_TTL: z.string().min(2).default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  FEATURE_BILLING_ENFORCEMENT: booleanValue.default(false),
});

const developmentSecrets = new Set([
  "development-only-jwt-secret-change-before-production",
  "development-only-cookie-secret-change-before-production",
]);

export function loadConfig(environment = process.env) {
  const config = configSchema.parse(environment);

  if (
    config.NODE_ENV === "production" &&
    (developmentSecrets.has(config.JWT_SECRET) || developmentSecrets.has(config.COOKIE_SECRET))
  ) {
    throw new Error("Production requires unique JWT_SECRET and COOKIE_SECRET values.");
  }

  return {
    nodeEnv: config.NODE_ENV,
    host: config.HOST,
    port: config.PORT,
    logLevel: config.LOG_LEVEL,
    trustProxy: config.TRUST_PROXY,
    databaseUrl: config.DATABASE_URL,
    databaseSsl: config.DATABASE_SSL,
    jwtSecret: config.JWT_SECRET,
    cookieSecret: config.COOKIE_SECRET,
    accessTokenTtl: config.ACCESS_TOKEN_TTL,
    refreshTokenDays: config.REFRESH_TOKEN_DAYS,
    corsOrigin: config.CORS_ORIGIN,
    billingEnforcement: config.FEATURE_BILLING_ENFORCEMENT,
    isProduction: config.NODE_ENV === "production",
  };
}

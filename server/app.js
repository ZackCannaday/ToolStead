import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { AppError, errorEnvelope } from "./lib/errors.js";
import { securityPlugin } from "./plugins/security.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { moduleRoutes } from "./routes/modules.js";
import { contactRoutes } from "./routes/contacts.js";
import { workQueueRoutes } from "./routes/work-queue.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const openApiPath = path.resolve(currentDirectory, "../docs/openapi.yaml");

export async function buildApp(options = {}) {
  const config = options.config || loadConfig();
  const pool = options.pool || createPool(config);
  const ownsPool = !options.pool;
  const app = Fastify({
    logger: options.logger ?? {
      level: config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers.set-cookie",
          "password",
          "*.password",
          "*.token",
        ],
        censor: "[REDACTED]",
      },
    },
    trustProxy: config.trustProxy,
    requestIdHeader: "x-correlation-id",
    logController: new LogController({
      disableRequestLogging: config.nodeEnv === "test",
    }),
  });

  app.decorate("config", config);
  app.decorate("pg", pool);

  await app.register(cookie, {
    secret: config.cookieSecret,
    hook: "onRequest",
  });
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Correlation-ID"],
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: {
      cookieName: "toolstead_access",
      signed: false,
    },
  });
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
  });

  await securityPlugin(app, { config });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-correlation-id", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const appError = error instanceof AppError;
    const statusCode = appError ? error.statusCode : error.statusCode >= 400 ? error.statusCode : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, "request_failed");
    }

    const safeError = appError
      ? error
      : statusCode < 500
        ? new AppError(statusCode, "REQUEST_FAILED", error.message)
        : new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred.");

    reply.code(statusCode).send(errorEnvelope(safeError, request.id));
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send(errorEnvelope(
        new AppError(404, "NOT_FOUND", "The API route was not found."),
        request.id,
      ));
    }
    return reply.code(404).send("Not Found");
  });

  app.get("/api/v1/openapi.yaml", async (_request, reply) => {
    const contract = await readFile(openApiPath, "utf8");
    return reply.type("application/yaml; charset=utf-8").send(contract);
  });

  await healthRoutes(app);
  await authRoutes(app);
  await moduleRoutes(app);
  await contactRoutes(app);
  await workQueueRoutes(app);

  if (ownsPool) {
    app.addHook("onClose", async () => {
      await pool.end();
    });
  }

  await app.ready();
  return app;
}

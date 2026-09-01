import { checkDatabase } from "../db/pool.js";

export async function healthRoutes(app) {
  app.get("/api/health/live", async () => ({
    status: "ok",
    service: "toolstead-api",
  }));

  app.get("/api/health/ready", async (_request, reply) => {
    try {
      const databaseLatencyMs = await checkDatabase(app.pg);
      return {
        status: "ready",
        database: "connected",
        databaseLatencyMs,
      };
    } catch {
      return reply.code(503).send({
        status: "degraded",
        database: "unavailable",
      });
    }
  });
}


import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp({ config });

async function shutdown(signal) {
  app.log.info({ signal }, "shutdown_requested");
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exit(1);
}

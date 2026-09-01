import pg from "pg";

const { Pool } = pg;

export function createPool(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 8_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    application_name: "toolstead-api",
  });

  pool.on("error", (error) => {
    console.error(JSON.stringify({
      level: "error",
      event: "postgres_pool_error",
      message: error.message,
    }));
  });

  return pool;
}

export async function checkDatabase(pool) {
  const startedAt = performance.now();
  await pool.query("SELECT 1");
  return Math.round(performance.now() - startedAt);
}

export async function withWorkspaceTransaction(pool, workspaceId, callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { createPool } from "./pool.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(currentDirectory, "migrations");

export async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of migrationNames) {
    const applied = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (applied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.info(`Applied migration: ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const pool = createPool(config);

  runMigrations(pool)
    .then(() => pool.end())
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exitCode = 1;
    });
}


import bcrypt from "bcryptjs";
import { loadConfig } from "../config.js";
import { runMigrations } from "../db/migrate.js";
import { createPool } from "../db/pool.js";

const required = ["OWNER_EMAIL", "OWNER_PASSWORD", "OWNER_NAME", "WORKSPACE_NAME"];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  console.error(`Missing required environment values: ${missing.join(", ")}`);
  process.exit(1);
}

if (process.env.OWNER_PASSWORD.length < 12) {
  console.error("OWNER_PASSWORD must contain at least 12 characters.");
  process.exit(1);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const config = loadConfig();
const pool = createPool(config);

try {
  await runMigrations(pool);
  const passwordHash = await bcrypt.hash(process.env.OWNER_PASSWORD, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const workspace = await client.query(
      `
        INSERT INTO workspaces (name, slug)
        VALUES ($1, $2)
        ON CONFLICT (slug)
        DO UPDATE SET name = excluded.name
        RETURNING id, name, slug
      `,
      [process.env.WORKSPACE_NAME.trim(), slugify(process.env.WORKSPACE_NAME)],
    );

    const user = await client.query(
      `
        INSERT INTO users (email, password_hash, display_name, email_verified_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          status = 'active',
          deleted_at = NULL
        RETURNING id, email, display_name
      `,
      [
        process.env.OWNER_EMAIL.trim().toLowerCase(),
        passwordHash,
        process.env.OWNER_NAME.trim(),
      ],
    );

    await client.query(
      `
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES ($1, $2, 'owner', 'active')
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET role = 'owner', status = 'active'
      `,
      [workspace.rows[0].id, user.rows[0].id],
    );

    await client.query(
      `
        INSERT INTO workspace_module_entitlements (
          workspace_id,
          module_id,
          source,
          enabled
        )
        SELECT $1, id, 'core', true
        FROM modules
        WHERE module_key = 'crm-core'
        ON CONFLICT (workspace_id, module_id)
        DO UPDATE SET enabled = true, source = 'core', expires_at = NULL
      `,
      [workspace.rows[0].id],
    );

    await client.query(
      `
        INSERT INTO workspace_subscriptions (workspace_id, plan_id, status)
        SELECT $1, id, 'configured'
        FROM subscription_plans
        WHERE plan_key = 'starter'
        ON CONFLICT (workspace_id)
        DO UPDATE SET plan_id = excluded.plan_id, status = 'configured'
      `,
      [workspace.rows[0].id],
    );

    await client.query("COMMIT");
    console.info(`Owner workspace ready: ${workspace.rows[0].name} (${workspace.rows[0].slug})`);
    console.info(`Owner account ready: ${user.rows[0].email}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

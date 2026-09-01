import { errors } from "../lib/errors.js";
import { withWorkspaceTransaction } from "../db/pool.js";

export async function securityPlugin(app, { config }) {
  app.decorate("authenticate", async function authenticate(request) {
    try {
      await request.jwtVerify();
    } catch {
      throw errors.unauthorized();
    }
  });

  app.decorate("requireRole", function requireRole(...allowedRoles) {
    return async function roleGuard(request) {
      if (!allowedRoles.includes(request.user.role)) {
        throw errors.forbidden();
      }
    };
  });

  app.decorate("requireModule", function requireModule(moduleKey) {
    return async function moduleGuard(request) {
      const result = await withWorkspaceTransaction(
        app.pg,
        request.user.workspaceId,
        (client) => client.query(
          `
            SELECT wme.enabled, wme.expires_at
            FROM workspace_module_entitlements wme
            JOIN modules m ON m.id = wme.module_id
            WHERE wme.workspace_id = $1
              AND m.module_key = $2
              AND m.is_active = true
            LIMIT 1
          `,
          [request.user.workspaceId, moduleKey],
        ),
      );

      const entitlement = result.rows[0];
      const expired = entitlement?.expires_at && new Date(entitlement.expires_at) <= new Date();

      if (!entitlement?.enabled || (config.billingEnforcement && expired)) {
        throw errors.forbidden(`The ${moduleKey} module is not enabled for this workspace.`);
      }
    };
  });
}

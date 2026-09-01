import { withWorkspaceTransaction } from "../db/pool.js";

export async function moduleRoutes(app) {
  app.get("/api/v1/modules", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const result = await withWorkspaceTransaction(
      app.pg,
      request.user.workspaceId,
      (client) => client.query(
        `
          SELECT
            m.module_key,
            m.name,
            m.description,
            m.category,
            m.is_core,
            coalesce(e.enabled, false) AS enabled,
            e.source,
            e.limits,
            e.expires_at
          FROM modules m
          LEFT JOIN workspace_module_entitlements e
            ON e.module_id = m.id
           AND e.workspace_id = $1
          WHERE m.is_active = true
          ORDER BY m.is_core DESC, m.category, m.name
        `,
        [request.user.workspaceId],
      ),
    );

    return {
      billingEnforcement: app.config.billingEnforcement,
      modules: result.rows.map((module) => ({
        key: module.module_key,
        name: module.name,
        description: module.description,
        category: module.category,
        core: module.is_core,
        enabled: module.enabled,
        source: module.source,
        limits: module.limits || {},
        expiresAt: module.expires_at,
      })),
    };
  });
}

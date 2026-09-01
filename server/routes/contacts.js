import { z } from "zod";
import { withWorkspaceTransaction } from "../db/pool.js";
import { errors } from "../lib/errors.js";

// # Contact validation
const contactQuerySchema = z.object({
  q: z.string().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const contactBodySchema = z.object({
  displayName: z.string().trim().min(1).max(180),
  companyName: z.string().trim().max(180).optional().or(z.literal("")),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  source: z.string().trim().min(1).max(80).default("manual"),
  summary: z.string().trim().max(2_000).optional().or(z.literal("")),
});

const contactPatchSchema = contactBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one contact field is required.",
);

const noteSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
});

// # Contact mapping
export function formatContact(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    companyName: row.company_name || "",
    email: row.email || "",
    phone: row.phone || "",
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timeline: row.timeline || [],
  };
}

const contactSelect = `
  SELECT
    c.id,
    c.display_name,
    c.company_name,
    c.source,
    c.created_at,
    c.updated_at,
    channels.email,
    channels.phone,
    timeline.events AS timeline
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT
      max(value::text) FILTER (WHERE channel_type = 'email') AS email,
      max(value::text) FILTER (WHERE channel_type IN ('phone', 'sms')) AS phone
    FROM contact_channels
    WHERE workspace_id = c.workspace_id AND contact_id = c.id
  ) channels ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'eventType', event.event_type,
        'title', event.title,
        'text', event.body,
        'occurredAt', event.occurred_at
      ) ORDER BY event.occurred_at DESC
    ) AS events
    FROM (
      SELECT id, event_type, title, body, occurred_at
      FROM contact_timeline_events
      WHERE workspace_id = c.workspace_id AND contact_id = c.id
      ORDER BY occurred_at DESC
      LIMIT 20
    ) event
  ) timeline ON true
`;

async function upsertChannel(client, workspaceId, contactId, channelType, value) {
  await client.query(
    "DELETE FROM contact_channels WHERE workspace_id = $1 AND contact_id = $2 AND channel_type = $3",
    [workspaceId, contactId, channelType],
  );
  if (!value) return;
  await client.query(
    `INSERT INTO contact_channels (workspace_id, contact_id, channel_type, value, is_primary)
     VALUES ($1, $2, $3, $4, true)`,
    [workspaceId, contactId, channelType, value],
  );
}

// # Contact routes
export async function contactRoutes(app) {
  const guards = [app.authenticate, app.requireModule("crm-core")];

  app.get("/api/v1/contacts", { preHandler: guards }, async (request) => {
    const parsed = contactQuerySchema.safeParse(request.query);
    if (!parsed.success) throw errors.badRequest("The contact filters are invalid.");

    const result = await withWorkspaceTransaction(
      app.pg,
      request.user.workspaceId,
      (client) => client.query(
        `${contactSelect}
         WHERE c.workspace_id = $1
           AND c.archived_at IS NULL
           AND ($2::text = '' OR c.display_name ILIKE '%' || $2 || '%' OR c.company_name ILIKE '%' || $2 || '%' OR channels.email ILIKE '%' || $2 || '%' OR channels.phone ILIKE '%' || $2 || '%')
         ORDER BY c.updated_at DESC
         LIMIT $3`,
        [request.user.workspaceId, parsed.data.q.trim(), parsed.data.limit],
      ),
    );
    return { count: result.rowCount, contacts: result.rows.map(formatContact) };
  });

  app.post("/api/v1/contacts", { preHandler: guards }, async (request, reply) => {
    const parsed = contactBodySchema.safeParse(request.body);
    if (!parsed.success) throw errors.badRequest("The contact details are invalid.", parsed.error.flatten());

    const contact = await withWorkspaceTransaction(app.pg, request.user.workspaceId, async (client) => {
      const inserted = await client.query(
        `INSERT INTO contacts (workspace_id, display_name, company_name, source, owner_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [request.user.workspaceId, parsed.data.displayName, parsed.data.companyName || null, parsed.data.source, request.user.sub],
      );
      const contactId = inserted.rows[0].id;
      await upsertChannel(client, request.user.workspaceId, contactId, "email", parsed.data.email);
      await upsertChannel(client, request.user.workspaceId, contactId, "phone", parsed.data.phone);
      await client.query(
        `INSERT INTO contact_timeline_events (workspace_id, contact_id, event_type, title, body, actor_user_id)
         VALUES ($1, $2, 'lead_created', 'Lead created', $3, $4)`,
        [request.user.workspaceId, contactId, parsed.data.summary || `Added from ${parsed.data.source}.`, request.user.sub],
      );
      const selected = await client.query(`${contactSelect} WHERE c.workspace_id = $1 AND c.id = $2`, [request.user.workspaceId, contactId]);
      return formatContact(selected.rows[0]);
    });
    return reply.code(201).send({ contact });
  });

  app.patch("/api/v1/contacts/:contactId", { preHandler: guards }, async (request) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    const parsed = contactPatchSchema.safeParse(request.body);
    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");
    if (!parsed.success) throw errors.badRequest("The contact changes are invalid.", parsed.error.flatten());

    return withWorkspaceTransaction(app.pg, request.user.workspaceId, async (client) => {
      const current = await client.query("SELECT * FROM contacts WHERE workspace_id = $1 AND id = $2 AND archived_at IS NULL", [request.user.workspaceId, contactId.data]);
      if (!current.rowCount) throw errors.notFound("The contact was not found.");
      const value = parsed.data;
      await client.query(
        `UPDATE contacts SET display_name = $3, company_name = $4, source = $5 WHERE workspace_id = $1 AND id = $2`,
        [request.user.workspaceId, contactId.data, value.displayName ?? current.rows[0].display_name, value.companyName === undefined ? current.rows[0].company_name : value.companyName || null, value.source ?? current.rows[0].source],
      );
      if (value.email !== undefined) await upsertChannel(client, request.user.workspaceId, contactId.data, "email", value.email);
      if (value.phone !== undefined) await upsertChannel(client, request.user.workspaceId, contactId.data, "phone", value.phone);
      const selected = await client.query(`${contactSelect} WHERE c.workspace_id = $1 AND c.id = $2`, [request.user.workspaceId, contactId.data]);
      return { contact: formatContact(selected.rows[0]) };
    });
  });

  app.post("/api/v1/contacts/:contactId/notes", { preHandler: guards }, async (request, reply) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    const parsed = noteSchema.safeParse(request.body);
    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");
    if (!parsed.success) throw errors.badRequest("The note is invalid.", parsed.error.flatten());
    const result = await withWorkspaceTransaction(app.pg, request.user.workspaceId, (client) => client.query(
      `INSERT INTO contact_timeline_events (workspace_id, contact_id, event_type, title, body, actor_user_id)
       SELECT $1, c.id, 'note_added', 'Note added', $3, $4 FROM contacts c
       WHERE c.workspace_id = $1 AND c.id = $2 AND c.archived_at IS NULL
       RETURNING id, event_type, title, body, occurred_at`,
      [request.user.workspaceId, contactId.data, parsed.data.body, request.user.sub],
    ));
    if (!result.rowCount) throw errors.notFound("The contact was not found.");
    return reply.code(201).send({ event: result.rows[0] });
  });

  app.delete("/api/v1/contacts/:contactId", { preHandler: [...guards, app.requireRole("owner", "admin", "manager")] }, async (request, reply) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");
    const result = await withWorkspaceTransaction(app.pg, request.user.workspaceId, (client) => client.query(
      "UPDATE contacts SET archived_at = now() WHERE workspace_id = $1 AND id = $2 AND archived_at IS NULL RETURNING id",
      [request.user.workspaceId, contactId.data],
    ));
    if (!result.rowCount) throw errors.notFound("The contact was not found.");
    return reply.code(204).send();
  });
}

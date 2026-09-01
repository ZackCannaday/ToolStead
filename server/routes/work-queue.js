import { z } from "zod";
import { withWorkspaceTransaction } from "../db/pool.js";
import { errors } from "../lib/errors.js";

const queueQuerySchema = z.object({
  scope: z.enum(["attention", "today", "all"]).default("attention"),
  q: z.string().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const messageSchema = z.object({
  channel: z.enum(["email", "sms"]),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10_000),
});

const consentSchema = z.object({
  channels: z.array(z.object({
    channel: z.enum(["email", "sms", "voice", "facebook"]),
    status: z.enum(["granted", "revoked", "unknown"]),
    evidence: z.string().max(1_000).optional(),
  })).min(1).max(4),
});

const appointmentSchema = z.object({
  title: z.string().min(2).max(180),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(3).max(80),
  notes: z.string().max(2_000).optional(),
});

export function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function humanAge(value, now = new Date()) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function titleCase(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function formatWorkItem(row) {
  return {
    id: row.id,
    contactId: row.contact_id,
    name: row.display_name,
    initials: initialsFor(row.display_name),
    type: row.item_type,
    source: row.source_detail || row.source_label,
    createdAt: row.created_at,
    age: humanAge(row.created_at),
    urgency: titleCase(row.urgency),
    urgencyTone: row.urgency,
    nextStep: row.next_step,
    note: row.next_step_note,
    action: row.action_label,
    actionType: row.action_type,
    phone: row.phone,
    email: row.email,
    leadSource: row.source_label,
    consent: row.consent || "Not recorded",
    summary: row.summary || "No request summary has been recorded.",
    nextAction: row.next_action || row.next_step,
    timeline: (row.timeline || []).map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      title: event.title,
      text: event.text,
    })),
  };
}

const workQueueSql = `
  SELECT
    wi.id,
    wi.contact_id,
    wi.item_type,
    wi.source_label,
    wi.source_detail,
    wi.urgency,
    wi.next_step,
    wi.next_step_note,
    wi.action_label,
    wi.action_type,
    wi.summary,
    wi.next_action,
    wi.created_at,
    c.display_name,
    channels.email,
    channels.phone,
    consent.summary AS consent,
    timeline.events AS timeline
  FROM work_items wi
  JOIN contacts c
    ON c.id = wi.contact_id
   AND c.workspace_id = wi.workspace_id
   AND c.archived_at IS NULL
  LEFT JOIN LATERAL (
    SELECT
      max(value::text) FILTER (WHERE channel_type = 'email') AS email,
      max(value::text) FILTER (WHERE channel_type IN ('phone', 'sms')) AS phone
    FROM contact_channels
    WHERE workspace_id = wi.workspace_id
      AND contact_id = wi.contact_id
  ) channels ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(initcap(latest.channel_type), ' and ' ORDER BY latest.channel_type) AS summary
    FROM (
      SELECT DISTINCT ON (channel_type)
        channel_type,
        status
      FROM consent_records
      WHERE workspace_id = wi.workspace_id
        AND contact_id = wi.contact_id
      ORDER BY channel_type, recorded_at DESC
    ) latest
    WHERE latest.status = 'granted'
  ) consent ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'eventType', event.event_type,
        'occurredAt', event.occurred_at,
        'title', event.title,
        'text', event.body
      )
      ORDER BY event.occurred_at DESC
    ) AS events
    FROM (
      SELECT id, event_type, occurred_at, title, body
      FROM contact_timeline_events
      WHERE workspace_id = wi.workspace_id
        AND contact_id = wi.contact_id
      ORDER BY occurred_at DESC
      LIMIT 12
    ) event
  ) timeline ON true
  WHERE wi.workspace_id = $1
    AND wi.status = 'open'
    AND (
      $2::text = 'all'
      OR ($2::text = 'attention' AND wi.urgency IN ('high', 'medium'))
      OR (
        $2::text = 'today'
        AND coalesce(wi.due_at, wi.created_at) >= date_trunc('day', now())
        AND coalesce(wi.due_at, wi.created_at) < date_trunc('day', now()) + interval '1 day'
      )
    )
    AND (
      $3::text = ''
      OR c.display_name ILIKE '%' || $3 || '%'
      OR wi.item_type ILIKE '%' || $3 || '%'
      OR wi.source_label ILIKE '%' || $3 || '%'
      OR wi.next_step ILIKE '%' || $3 || '%'
    )
  ORDER BY
    CASE wi.urgency
      WHEN 'high' THEN 0
      WHEN 'medium' THEN 1
      WHEN 'normal' THEN 2
      ELSE 3
    END,
    coalesce(wi.due_at, wi.created_at),
    wi.created_at DESC
  LIMIT $4
`;

export async function workQueueRoutes(app) {
  const crmGuards = [app.authenticate, app.requireModule("crm-core")];

  app.get("/api/v1/work-queue", {
    preHandler: crmGuards,
  }, async (request) => {
    const parsed = queueQuerySchema.safeParse(request.query);
    if (!parsed.success) throw errors.badRequest("The work-queue filters are invalid.");

    const { scope, q, limit } = parsed.data;
    const result = await withWorkspaceTransaction(
      app.pg,
      request.user.workspaceId,
      (client) => client.query(workQueueSql, [
        request.user.workspaceId,
        scope,
        q.trim(),
        limit,
      ]),
    );

    return {
      scope,
      count: result.rowCount,
      items: result.rows.map(formatWorkItem),
    };
  });

  app.get("/api/v1/contacts/:contactId/timeline", {
    preHandler: crmGuards,
  }, async (request) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");

    const result = await withWorkspaceTransaction(
      app.pg,
      request.user.workspaceId,
      (client) => client.query(
        `
          SELECT id, event_type, title, body, occurred_at, metadata
          FROM contact_timeline_events
          WHERE workspace_id = $1
            AND contact_id = $2
          ORDER BY occurred_at DESC
          LIMIT 100
        `,
        [request.user.workspaceId, contactId.data],
      ),
    );

    return {
      contactId: contactId.data,
      events: result.rows.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        title: event.title,
        text: event.body,
        occurredAt: event.occurred_at,
        metadata: event.metadata,
      })),
    };
  });

  app.post("/api/v1/contacts/:contactId/messages", {
    preHandler: crmGuards,
  }, async (request, reply) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    const body = messageSchema.safeParse(request.body);
    const idempotencyKey = request.headers["idempotency-key"];

    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");
    if (!body.success) throw errors.badRequest("The message is invalid.", body.error.flatten());
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw errors.badRequest("A valid Idempotency-Key header is required.");
    }

    const queued = await withWorkspaceTransaction(
      app.pg,
      request.user.workspaceId,
      async (client) => {
        const contact = await client.query(
          `
            SELECT
              c.id,
              (
                SELECT value::text
                FROM contact_channels
                WHERE workspace_id = c.workspace_id
                  AND contact_id = c.id
                  AND channel_type = $3
                ORDER BY is_primary DESC, created_at
                LIMIT 1
              ) AS recipient,
              (
                SELECT status
                FROM consent_records
                WHERE workspace_id = c.workspace_id
                  AND contact_id = c.id
                  AND channel_type = $3
                ORDER BY recorded_at DESC
                LIMIT 1
              ) AS consent_status
            FROM contacts c
            WHERE c.workspace_id = $1
              AND c.id = $2
              AND c.archived_at IS NULL
            LIMIT 1
          `,
          [request.user.workspaceId, contactId.data, body.data.channel],
        );

        const target = contact.rows[0];
        if (!target) throw errors.notFound("The contact was not found.");
        if (!target.recipient) throw errors.conflict(`The contact has no ${body.data.channel} destination.`);
        if (target.consent_status !== "granted") {
          throw errors.conflict(`${titleCase(body.data.channel)} consent is not recorded as granted.`);
        }

        const inserted = await client.query(
          `
            INSERT INTO communication_outbox (
              workspace_id,
              contact_id,
              channel_type,
              recipient,
              subject,
              body,
              idempotency_key,
              created_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (workspace_id, idempotency_key)
            DO UPDATE SET idempotency_key = excluded.idempotency_key
            RETURNING id, status, created_at
          `,
          [
            request.user.workspaceId,
            contactId.data,
            body.data.channel,
            target.recipient,
            body.data.subject || null,
            body.data.body,
            idempotencyKey,
            request.user.sub,
          ],
        );

        const message = inserted.rows[0];
        await client.query(
          `
            INSERT INTO contact_timeline_events (
              workspace_id,
              contact_id,
              event_type,
              title,
              body,
              actor_user_id,
              metadata
            )
            VALUES ($1, $2, 'message_queued', $3, $4, $5, jsonb_build_object('outboxId', $6::text))
          `,
          [
            request.user.workspaceId,
            contactId.data,
            `${titleCase(body.data.channel)} reply queued`,
            body.data.subject || "Outbound reply",
            request.user.sub,
            message.id,
          ],
        );

        return message;
      },
    );

    return reply.code(202).send({
      id: queued.id,
      status: queued.status,
      createdAt: queued.created_at,
    });
  });

  app.post("/api/v1/contacts/:contactId/consents", {
    preHandler: [...crmGuards, app.requireRole("owner", "admin", "manager")],
  }, async (request, reply) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    const body = consentSchema.safeParse(request.body);
    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");
    if (!body.success) throw errors.badRequest("The consent record is invalid.", body.error.flatten());

    await withWorkspaceTransaction(app.pg, request.user.workspaceId, async (client) => {
      const contact = await client.query(
        "SELECT id FROM contacts WHERE workspace_id = $1 AND id = $2 AND archived_at IS NULL",
        [request.user.workspaceId, contactId.data],
      );
      if (!contact.rowCount) throw errors.notFound("The contact was not found.");

      for (const consent of body.data.channels) {
        await client.query(
          `
            INSERT INTO consent_records (
              workspace_id,
              contact_id,
              channel_type,
              status,
              evidence,
              recorded_by_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            request.user.workspaceId,
            contactId.data,
            consent.channel,
            consent.status,
            consent.evidence || null,
            request.user.sub,
          ],
        );
      }

      await client.query(
        `
          INSERT INTO audit_log (
            workspace_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            after_state,
            request_id,
            ip_address
          )
          VALUES ($1, $2, 'consent.recorded', 'contact', $3, $4, $5, $6)
        `,
        [
          request.user.workspaceId,
          request.user.sub,
          contactId.data,
          JSON.stringify(body.data),
          request.id,
          request.ip,
        ],
      );
    });

    return reply.code(201).send({ status: "recorded" });
  });

  app.post("/api/v1/contacts/:contactId/appointments", {
    preHandler: crmGuards,
  }, async (request, reply) => {
    const contactId = z.string().uuid().safeParse(request.params.contactId);
    const body = appointmentSchema.safeParse(request.body);
    if (!contactId.success) throw errors.badRequest("The contact ID is invalid.");
    if (!body.success) throw errors.badRequest("The appointment is invalid.", body.error.flatten());
    if (new Date(body.data.endsAt) <= new Date(body.data.startsAt)) {
      throw errors.badRequest("The appointment end must be after its start.");
    }

    const result = await withWorkspaceTransaction(
      app.pg,
      request.user.workspaceId,
      (client) => client.query(
        `
          INSERT INTO appointments (
            workspace_id,
            contact_id,
            title,
            starts_at,
            ends_at,
            timezone,
            notes,
            created_by_user_id
          )
          SELECT $1, c.id, $3, $4, $5, $6, $7, $8
          FROM contacts c
          WHERE c.workspace_id = $1
            AND c.id = $2
            AND c.archived_at IS NULL
          RETURNING id, status, starts_at, ends_at
        `,
        [
          request.user.workspaceId,
          contactId.data,
          body.data.title,
          body.data.startsAt,
          body.data.endsAt,
          body.data.timezone,
          body.data.notes || null,
          request.user.sub,
        ],
      ),
    );

    if (!result.rowCount) throw errors.notFound("The contact was not found.");
    return reply.code(201).send({
      id: result.rows[0].id,
      status: result.rows[0].status,
      startsAt: result.rows[0].starts_at,
      endsAt: result.rows[0].ends_at,
    });
  });
}

import bcrypt from "bcryptjs";
import { z } from "zod";
import { errors } from "../lib/errors.js";
import { createRefreshToken, hashToken, refreshExpiry } from "../lib/tokens.js";

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(200),
  workspaceSlug: z.string().min(2).max(120).optional(),
});

function cookieOptions(config, path) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path,
  };
}

async function issueSession(app, request, account) {
  const refreshToken = createRefreshToken();
  const expiresAt = refreshExpiry(app.config.refreshTokenDays);
  const result = await app.pg.query(
    `
      INSERT INTO auth_sessions (
        user_id,
        workspace_id,
        refresh_token_hash,
        user_agent,
        ip_address,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      account.user_id,
      account.workspace_id,
      hashToken(refreshToken),
      request.headers["user-agent"] || null,
      request.ip,
      expiresAt,
    ],
  );

  const sessionId = result.rows[0].id;
  const accessToken = await app.jwt.sign(
    {
      sub: account.user_id,
      workspaceId: account.workspace_id,
      workspaceSlug: account.workspace_slug,
      role: account.role,
      sessionId,
    },
    { expiresIn: app.config.accessTokenTtl },
  );

  return { accessToken, refreshToken, sessionId, expiresAt };
}

export async function authRoutes(app) {
  app.post("/api/v1/auth/login", {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: "15 minutes",
      },
    },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw errors.badRequest("Enter a valid email and a password of at least 12 characters.");
    }

    const { email, password, workspaceSlug } = parsed.data;
    const result = await app.pg.query(
      `
        SELECT
          u.id AS user_id,
          u.email,
          u.display_name,
          u.password_hash,
          w.id AS workspace_id,
          w.name AS workspace_name,
          w.slug AS workspace_slug,
          wm.role
        FROM users u
        JOIN workspace_memberships wm
          ON wm.user_id = u.id
         AND wm.status = 'active'
        JOIN workspaces w
          ON w.id = wm.workspace_id
         AND w.status = 'active'
         AND w.deleted_at IS NULL
        WHERE u.email = $1
          AND u.status = 'active'
          AND u.deleted_at IS NULL
          AND ($2::text IS NULL OR w.slug = $2)
        ORDER BY CASE WHEN wm.role = 'owner' THEN 0 ELSE 1 END, wm.created_at
        LIMIT 1
      `,
      [email.toLowerCase(), workspaceSlug || null],
    );

    const account = result.rows[0];
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      throw errors.unauthorized("The email or password is incorrect.");
    }

    const session = await issueSession(app, request, account);
    await app.pg.query("UPDATE users SET last_login_at = now() WHERE id = $1", [account.user_id]);

    reply
      .setCookie("toolstead_access", session.accessToken, cookieOptions(app.config, "/"))
      .setCookie(
        "toolstead_refresh",
        session.refreshToken,
        {
          ...cookieOptions(app.config, "/api/v1/auth"),
          expires: session.expiresAt,
        },
      );

    return {
      user: {
        id: account.user_id,
        email: account.email,
        displayName: account.display_name,
        role: account.role,
      },
      workspace: {
        id: account.workspace_id,
        name: account.workspace_name,
        slug: account.workspace_slug,
      },
    };
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const currentToken = request.cookies.toolstead_refresh;
    if (!currentToken) throw errors.unauthorized();

    const result = await app.pg.query(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          s.workspace_id,
          u.email,
          u.display_name,
          w.slug AS workspace_slug,
          wm.role
        FROM auth_sessions s
        JOIN users u
          ON u.id = s.user_id
         AND u.status = 'active'
         AND u.deleted_at IS NULL
        JOIN workspaces w
          ON w.id = s.workspace_id
         AND w.status = 'active'
         AND w.deleted_at IS NULL
        JOIN workspace_memberships wm
          ON wm.user_id = s.user_id
         AND wm.workspace_id = s.workspace_id
         AND wm.status = 'active'
        WHERE s.refresh_token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
        LIMIT 1
      `,
      [hashToken(currentToken)],
    );

    const session = result.rows[0];
    if (!session) throw errors.unauthorized("The session has expired.");

    const nextRefreshToken = createRefreshToken();
    const nextExpiry = refreshExpiry(app.config.refreshTokenDays);
    await app.pg.query(
      `
        UPDATE auth_sessions
        SET refresh_token_hash = $1,
            expires_at = $2,
            last_used_at = now()
        WHERE id = $3
      `,
      [hashToken(nextRefreshToken), nextExpiry, session.session_id],
    );

    const accessToken = await app.jwt.sign(
      {
        sub: session.user_id,
        workspaceId: session.workspace_id,
        workspaceSlug: session.workspace_slug,
        role: session.role,
        sessionId: session.session_id,
      },
      { expiresIn: app.config.accessTokenTtl },
    );

    reply
      .setCookie("toolstead_access", accessToken, cookieOptions(app.config, "/"))
      .setCookie(
        "toolstead_refresh",
        nextRefreshToken,
        {
          ...cookieOptions(app.config, "/api/v1/auth"),
          expires: nextExpiry,
        },
      );

    return { status: "refreshed" };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const refreshToken = request.cookies.toolstead_refresh;
    if (refreshToken) {
      await app.pg.query(
        "UPDATE auth_sessions SET revoked_at = now() WHERE refresh_token_hash = $1",
        [hashToken(refreshToken)],
      );
    }

    reply
      .clearCookie("toolstead_access", cookieOptions(app.config, "/"))
      .clearCookie("toolstead_refresh", cookieOptions(app.config, "/api/v1/auth"));

    return { status: "signed_out" };
  });

  app.get("/api/v1/auth/me", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const result = await app.pg.query(
      `
        SELECT
          u.id,
          u.email,
          u.display_name,
          w.id AS workspace_id,
          w.name AS workspace_name,
          w.slug AS workspace_slug,
          wm.role,
          wm.permissions
        FROM users u
        JOIN workspace_memberships wm
          ON wm.user_id = u.id
         AND wm.workspace_id = $2
         AND wm.status = 'active'
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [request.user.sub, request.user.workspaceId],
    );

    const account = result.rows[0];
    if (!account) throw errors.notFound("The account membership is no longer available.");

    return {
      user: {
        id: account.id,
        email: account.email,
        displayName: account.display_name,
        role: account.role,
        permissions: account.permissions,
      },
      workspace: {
        id: account.workspace_id,
        name: account.workspace_name,
        slug: account.workspace_slug,
      },
    };
  });
}


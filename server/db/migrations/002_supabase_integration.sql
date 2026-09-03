-- # Supabase auth bridge
CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx
  ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'New lead';
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_lifecycle_stage_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('New lead', 'Contacted', 'Qualified', 'Won', 'Lost'));

ALTER TABLE public.contact_channels DROP CONSTRAINT IF EXISTS contact_channels_value_length_check;
ALTER TABLE public.contact_channels ADD CONSTRAINT contact_channels_value_length_check
  CHECK (char_length(value) BETWEEN 1 AND 320);

ALTER TABLE public.contact_timeline_events DROP CONSTRAINT IF EXISTS contact_timeline_body_length_check;
ALTER TABLE public.contact_timeline_events ADD CONSTRAINT contact_timeline_body_length_check
  CHECK (body IS NULL OR char_length(body) <= 2000);

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_no_workspace_overlap'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_workspace_overlap
      EXCLUDE USING gist (
        workspace_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status IN ('requested', 'confirmed'));
  END IF;
END;
$$;

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS release_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS readiness jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.modules DROP CONSTRAINT IF EXISTS modules_release_status_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_release_status_check
  CHECK (release_status IN ('implemented', 'foundation', 'not_started'));

UPDATE public.modules
SET release_status = CASE module_key::text
  WHEN 'crm-core' THEN 'implemented'
  WHEN 'booking' THEN 'foundation'
  WHEN 'messaging' THEN 'foundation'
  ELSE 'not_started'
END;

-- # Workspace authorization
CREATE OR REPLACE FUNCTION private.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = (SELECT auth.uid())
    AND u.status = 'active'
    AND u.deleted_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT wm.workspace_id
  FROM public.workspace_memberships wm
  JOIN public.users u ON u.id = wm.user_id
  JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE u.auth_user_id = (SELECT auth.uid())
    AND u.status = 'active'
    AND u.deleted_at IS NULL
    AND wm.status = 'active'
    AND w.status = 'active'
    AND w.deleted_at IS NULL
  ORDER BY CASE wm.role WHEN 'owner' THEN 0 ELSE 1 END, wm.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_workspace_member(target_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wm
    JOIN public.users u ON u.id = wm.user_id
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND wm.workspace_id = target_workspace_id
      AND wm.status = 'active'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
      AND w.status = 'active'
      AND w.deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION private.current_app_user_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_workspace_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_workspace_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_workspace_member(uuid) TO authenticated;

-- # Owner onboarding
CREATE OR REPLACE FUNCTION private.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  app_user_id uuid;
  new_workspace_id uuid;
  owner_name text;
  workspace_name text;
BEGIN
  owner_name := left(coalesce(
    nullif(btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(NEW.email, '@', 1), ''),
    'Owner'
  ), 120);
  IF char_length(owner_name) < 2 THEN owner_name := owner_name || ' Owner'; END IF;

  workspace_name := left(coalesce(
    nullif(btrim(NEW.raw_user_meta_data ->> 'workspace_name'), ''),
    owner_name || '''s Workspace'
  ), 120);

  SELECT id INTO app_user_id
  FROM public.users
  WHERE auth_user_id = NEW.id
  LIMIT 1;

  IF app_user_id IS NOT NULL THEN
    UPDATE public.users
    SET email = NEW.email,
        display_name = owner_name,
        email_verified_at = NEW.email_confirmed_at
    WHERE id = app_user_id;
  ELSE
    INSERT INTO public.users (
      auth_user_id, email, password_hash, display_name, email_verified_at
    )
    VALUES (NEW.id, NEW.email, NULL, owner_name, NEW.email_confirmed_at)
    ON CONFLICT (email) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      display_name = EXCLUDED.display_name,
      email_verified_at = EXCLUDED.email_verified_at
    RETURNING id INTO app_user_id;
  END IF;

  SELECT wm.workspace_id INTO new_workspace_id
  FROM public.workspace_memberships wm
  WHERE wm.user_id = app_user_id AND wm.status = 'active'
  LIMIT 1;

  IF new_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, slug)
    VALUES (workspace_name, 'toolstead-' || left(NEW.id::text, 8))
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_memberships (workspace_id, user_id, role, status)
    VALUES (new_workspace_id, app_user_id, 'owner', 'active');

    INSERT INTO public.workspace_module_entitlements (
      workspace_id, module_id, source, enabled
    )
    SELECT new_workspace_id, m.id, 'core', true
    FROM public.modules m
    WHERE m.module_key = 'crm-core'
    ON CONFLICT (workspace_id, module_id)
    DO UPDATE SET enabled = true, source = 'core', expires_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_auth_user_created() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS toolstead_auth_user_created ON auth.users;
CREATE TRIGGER toolstead_auth_user_created
AFTER INSERT OR UPDATE OF email, email_confirmed_at, raw_user_meta_data
ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_auth_user_created();

-- # Public schema RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_self ON public.users;
CREATE POLICY users_read_self ON public.users FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users FOR UPDATE TO authenticated
USING (auth_user_id = (SELECT auth.uid()))
WITH CHECK (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS workspaces_member_read ON public.workspaces;
CREATE POLICY workspaces_member_read ON public.workspaces FOR SELECT TO authenticated
USING ((SELECT private.is_workspace_member(id)));
DROP POLICY IF EXISTS memberships_self_read ON public.workspace_memberships;
CREATE POLICY memberships_self_read ON public.workspace_memberships FOR SELECT TO authenticated
USING (user_id = (SELECT private.current_app_user_id()));

DROP POLICY IF EXISTS modules_authenticated_read ON public.modules;
CREATE POLICY modules_authenticated_read ON public.modules FOR SELECT TO authenticated
USING (is_active = true);
DROP POLICY IF EXISTS plans_authenticated_read ON public.subscription_plans;
CREATE POLICY plans_authenticated_read ON public.subscription_plans FOR SELECT TO authenticated
USING (is_active = true);
DROP POLICY IF EXISTS plan_modules_authenticated_read ON public.plan_modules;
CREATE POLICY plan_modules_authenticated_read ON public.plan_modules FOR SELECT TO authenticated
USING (true);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'workspace_subscriptions', 'workspace_module_entitlements', 'contacts',
    'contact_channels', 'consent_records', 'work_items',
    'contact_timeline_events', 'communication_outbox', 'appointments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_workspace_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY authenticated_workspace_access ON public.%I FOR ALL TO authenticated USING ((SELECT private.is_workspace_member(workspace_id))) WITH CHECK ((SELECT private.is_workspace_member(workspace_id)))',
      table_name
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS audit_log_member_read ON public.audit_log;
CREATE POLICY audit_log_member_read ON public.audit_log FOR SELECT TO authenticated
USING ((SELECT private.is_workspace_member(workspace_id)));

-- # Project hardening compatibility
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'workspaces', 'users', 'workspace_memberships', 'auth_sessions', 'modules',
    'subscription_plans', 'plan_modules', 'workspace_subscriptions',
    'workspace_module_entitlements', 'contacts', 'contact_channels',
    'consent_records', 'work_items', 'contact_timeline_events',
    'communication_outbox', 'appointments', 'audit_log'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Deny direct Data API access', table_name
    );
  END LOOP;
END;
$$;

GRANT SELECT ON public.modules, public.subscription_plans, public.plan_modules TO authenticated;
GRANT SELECT ON public.users, public.workspaces, public.workspace_memberships TO authenticated;
GRANT UPDATE (display_name) ON public.users TO authenticated;
GRANT SELECT ON public.workspace_module_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.contact_channels TO authenticated;
GRANT SELECT, INSERT ON public.contact_timeline_events TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

-- # Supabase RPC facade
CREATE OR REPLACE FUNCTION public.toolstead_get_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id', u.id, 'email', u.email, 'displayName', u.display_name, 'role', wm.role
    ),
    'workspace', jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug)
  )
  FROM public.users u
  JOIN public.workspace_memberships wm ON wm.user_id = u.id AND wm.status = 'active'
  JOIN public.workspaces w ON w.id = wm.workspace_id AND w.status = 'active'
  WHERE u.auth_user_id = (SELECT auth.uid())
    AND u.status = 'active'
    AND u.deleted_at IS NULL
    AND w.deleted_at IS NULL
  ORDER BY CASE wm.role WHEN 'owner' THEN 0 ELSE 1 END, wm.created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.toolstead_list_modules()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'key', m.module_key, 'name', m.name, 'description', m.description,
      'category', m.category, 'core', m.is_core,
      'enabled', coalesce(e.enabled, false), 'source', e.source,
      'limits', coalesce(e.limits, '{}'::jsonb),
      'maturity', m.release_status, 'readiness', m.readiness
    ) ORDER BY m.is_core DESC, m.category, m.name
  ), '[]'::jsonb)
  FROM public.modules m
  LEFT JOIN public.workspace_module_entitlements e
    ON e.module_id = m.id
   AND e.workspace_id = (SELECT private.current_workspace_id())
  WHERE m.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.toolstead_list_contacts(p_query text DEFAULT '')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id, 'displayName', c.display_name,
      'companyName', coalesce(c.company_name, ''),
      'email', coalesce(channels.email, ''), 'phone', coalesce(channels.phone, ''),
      'source', c.source, 'stage', c.lifecycle_stage,
      'createdAt', c.created_at, 'updatedAt', c.updated_at,
      'timeline', coalesce(timeline.events, '[]'::jsonb)
    ) ORDER BY c.updated_at DESC
  ), '[]'::jsonb)
  FROM public.contacts c
  LEFT JOIN LATERAL (
    SELECT
      max(cc.value::text) FILTER (WHERE cc.channel_type = 'email') AS email,
      max(cc.value::text) FILTER (WHERE cc.channel_type IN ('phone', 'sms')) AS phone
    FROM public.contact_channels cc
    WHERE cc.workspace_id = c.workspace_id AND cc.contact_id = c.id
  ) channels ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'id', event.id, 'eventType', event.event_type, 'title', event.title,
      'text', event.body, 'occurredAt', event.occurred_at
    ) ORDER BY event.occurred_at DESC) AS events
    FROM (
      SELECT cte.id, cte.event_type, cte.title, cte.body, cte.occurred_at
      FROM public.contact_timeline_events cte
      WHERE cte.workspace_id = c.workspace_id AND cte.contact_id = c.id
      ORDER BY cte.occurred_at DESC LIMIT 50
    ) event
  ) timeline ON true
  WHERE c.workspace_id = (SELECT private.current_workspace_id())
    AND c.archived_at IS NULL
    AND (
      btrim(coalesce(p_query, '')) = ''
      OR c.display_name ILIKE '%' || btrim(p_query) || '%'
      OR coalesce(c.company_name, '') ILIKE '%' || btrim(p_query) || '%'
      OR coalesce(channels.email, '') ILIKE '%' || btrim(p_query) || '%'
      OR coalesce(channels.phone, '') ILIKE '%' || btrim(p_query) || '%'
    )
$$;

CREATE OR REPLACE FUNCTION public.toolstead_create_contact(
  p_display_name text, p_company_name text DEFAULT NULL,
  p_email text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_source text DEFAULT 'Manual entry', p_summary text DEFAULT NULL,
  p_lifecycle_stage text DEFAULT 'New lead'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  active_workspace_id uuid := private.current_workspace_id();
  app_user_id uuid := private.current_app_user_id();
  new_contact_id uuid;
BEGIN
  IF active_workspace_id IS NULL THEN RAISE EXCEPTION 'No active Toolstead workspace is available.'; END IF;
  IF char_length(btrim(coalesce(p_display_name, ''))) NOT BETWEEN 1 AND 180 THEN
    RAISE EXCEPTION 'Display name must contain 1 to 180 characters.';
  END IF;
  IF char_length(coalesce(p_company_name, '')) > 180 THEN RAISE EXCEPTION 'Company name is too long.'; END IF;
  IF char_length(coalesce(p_email, '')) > 320 THEN RAISE EXCEPTION 'Email is too long.'; END IF;
  IF char_length(coalesce(p_phone, '')) > 40 THEN RAISE EXCEPTION 'Phone number is too long.'; END IF;
  IF char_length(coalesce(p_source, '')) > 80 THEN RAISE EXCEPTION 'Source is too long.'; END IF;
  IF char_length(coalesce(p_summary, '')) > 2000 THEN RAISE EXCEPTION 'Summary is too long.'; END IF;
  INSERT INTO public.contacts (
    workspace_id, display_name, company_name, source, lifecycle_stage, owner_user_id
  ) VALUES (
    active_workspace_id, btrim(p_display_name), nullif(btrim(p_company_name), ''),
    coalesce(nullif(btrim(p_source), ''), 'Manual entry'), p_lifecycle_stage, app_user_id
  ) RETURNING id INTO new_contact_id;

  IF nullif(btrim(p_email), '') IS NOT NULL THEN
    INSERT INTO public.contact_channels (workspace_id, contact_id, channel_type, value, is_primary)
    VALUES (active_workspace_id, new_contact_id, 'email', btrim(p_email), true);
  END IF;
  IF nullif(btrim(p_phone), '') IS NOT NULL THEN
    INSERT INTO public.contact_channels (workspace_id, contact_id, channel_type, value, is_primary)
    VALUES (active_workspace_id, new_contact_id, 'phone', btrim(p_phone), true);
  END IF;
  INSERT INTO public.contact_timeline_events (
    workspace_id, contact_id, event_type, title, body, actor_user_id
  ) VALUES (
    active_workspace_id, new_contact_id, 'lead_created', 'Lead created',
    coalesce(nullif(btrim(p_summary), ''), 'Added from ' || coalesce(nullif(btrim(p_source), ''), 'Manual entry') || '.'),
    app_user_id
  );
  RETURN new_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toolstead_update_contact(
  p_contact_id uuid, p_display_name text, p_company_name text DEFAULT NULL,
  p_email text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_source text DEFAULT 'Manual entry', p_lifecycle_stage text DEFAULT 'New lead'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE active_workspace_id uuid := private.current_workspace_id();
BEGIN
  IF char_length(btrim(coalesce(p_display_name, ''))) NOT BETWEEN 1 AND 180 THEN
    RAISE EXCEPTION 'Display name must contain 1 to 180 characters.';
  END IF;
  IF char_length(coalesce(p_company_name, '')) > 180 THEN RAISE EXCEPTION 'Company name is too long.'; END IF;
  IF char_length(coalesce(p_email, '')) > 320 THEN RAISE EXCEPTION 'Email is too long.'; END IF;
  IF char_length(coalesce(p_phone, '')) > 40 THEN RAISE EXCEPTION 'Phone number is too long.'; END IF;
  IF char_length(coalesce(p_source, '')) > 80 THEN RAISE EXCEPTION 'Source is too long.'; END IF;
  UPDATE public.contacts
  SET display_name = btrim(p_display_name),
      company_name = nullif(btrim(p_company_name), ''),
      source = coalesce(nullif(btrim(p_source), ''), 'Manual entry'),
      lifecycle_stage = p_lifecycle_stage
  WHERE id = p_contact_id AND workspace_id = active_workspace_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'The contact was not found.'; END IF;

  DELETE FROM public.contact_channels
  WHERE contact_id = p_contact_id AND workspace_id = active_workspace_id
    AND channel_type IN ('email', 'phone');
  IF nullif(btrim(p_email), '') IS NOT NULL THEN
    INSERT INTO public.contact_channels (workspace_id, contact_id, channel_type, value, is_primary)
    VALUES (active_workspace_id, p_contact_id, 'email', btrim(p_email), true);
  END IF;
  IF nullif(btrim(p_phone), '') IS NOT NULL THEN
    INSERT INTO public.contact_channels (workspace_id, contact_id, channel_type, value, is_primary)
    VALUES (active_workspace_id, p_contact_id, 'phone', btrim(p_phone), true);
  END IF;
  RETURN p_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toolstead_add_contact_note(p_contact_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  active_workspace_id uuid := private.current_workspace_id();
  new_event_id uuid;
BEGIN
  IF char_length(btrim(coalesce(p_body, ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Note must contain 1 to 2000 characters.';
  END IF;
  INSERT INTO public.contact_timeline_events (
    workspace_id, contact_id, event_type, title, body, actor_user_id
  )
  SELECT active_workspace_id, c.id, 'note_added', 'Note added',
    btrim(p_body), private.current_app_user_id()
  FROM public.contacts c
  WHERE c.workspace_id = active_workspace_id
    AND c.id = p_contact_id
    AND c.archived_at IS NULL
  RETURNING id INTO new_event_id;
  IF new_event_id IS NULL THEN RAISE EXCEPTION 'The contact was not found.'; END IF;
  RETURN new_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toolstead_archive_contact(p_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE active_workspace_id uuid := private.current_workspace_id();
BEGIN
  UPDATE public.contacts SET archived_at = now()
  WHERE id = p_contact_id AND workspace_id = active_workspace_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'The contact was not found.'; END IF;
  RETURN p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.toolstead_get_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toolstead_list_modules() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toolstead_list_contacts(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toolstead_create_contact(text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toolstead_update_contact(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toolstead_add_contact_note(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toolstead_archive_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toolstead_get_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toolstead_list_modules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toolstead_list_contacts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toolstead_create_contact(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toolstead_update_contact(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toolstead_add_contact_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toolstead_archive_contact(uuid) TO authenticated;

ALTER FUNCTION public.set_updated_at() SET search_path = '';
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

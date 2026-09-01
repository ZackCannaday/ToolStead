CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug citext NOT NULL UNIQUE,
  account_type text NOT NULL DEFAULT 'direct_business'
    CHECK (account_type IN ('direct_business', 'agency')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  timezone text NOT NULL DEFAULT 'America/New_York',
  currency char(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TRIGGER workspaces_set_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'disabled')),
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX users_active_email_idx
ON users (email)
WHERE deleted_at IS NULL;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'disabled')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX workspace_memberships_user_idx
ON workspace_memberships (user_id, status);

CREATE TRIGGER workspace_memberships_set_updated_at
BEFORE UPDATE ON workspace_memberships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  refresh_token_hash char(64) NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_active_idx
ON auth_sessions (user_id, workspace_id, expires_at)
WHERE revoked_at IS NULL;

CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key citext NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key citext NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  monthly_price_cents integer NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  annual_price_cents integer NOT NULL DEFAULT 0 CHECK (annual_price_cents >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER subscription_plans_set_updated_at
BEFORE UPDATE ON subscription_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE plan_modules (
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (plan_id, module_id)
);

CREATE TABLE workspace_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'configured'
    CHECK (status IN ('configured', 'trialing', 'active', 'past_due', 'paused', 'cancelled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE TRIGGER workspace_subscriptions_set_updated_at
BEFORE UPDATE ON workspace_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workspace_module_entitlements (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('core', 'plan', 'addon', 'manual', 'trial')),
  enabled boolean NOT NULL DEFAULT true,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, module_id)
);

CREATE INDEX workspace_entitlements_enabled_idx
ON workspace_module_entitlements (workspace_id, enabled);

CREATE TRIGGER workspace_module_entitlements_set_updated_at
BEFORE UPDATE ON workspace_module_entitlements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 180),
  given_name text,
  family_name text,
  company_name text,
  source text NOT NULL DEFAULT 'manual',
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX contacts_workspace_name_idx
ON contacts (workspace_id, lower(display_name))
WHERE archived_at IS NULL;

CREATE INDEX contacts_workspace_created_idx
ON contacts (workspace_id, created_at DESC)
WHERE archived_at IS NULL;

CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contact_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'phone', 'sms', 'facebook')),
  value citext NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, channel_type, value)
);

CREATE INDEX contact_channels_contact_idx
ON contact_channels (workspace_id, contact_id);

CREATE TRIGGER contact_channels_set_updated_at
BEFORE UPDATE ON contact_channels
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'voice', 'facebook')),
  status text NOT NULL CHECK (status IN ('granted', 'revoked', 'unknown')),
  legal_basis text,
  evidence text,
  recorded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consent_records_latest_idx
ON consent_records (workspace_id, contact_id, channel_type, recorded_at DESC);

CREATE TABLE work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  source_label text NOT NULL,
  source_detail text,
  urgency text NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('high', 'medium', 'normal', 'low')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'snoozed', 'completed', 'cancelled')),
  next_step text NOT NULL,
  next_step_note text,
  action_label text NOT NULL DEFAULT 'Review',
  action_type text NOT NULL DEFAULT 'review'
    CHECK (action_type IN ('respond', 'consent', 'schedule', 'review')),
  summary text,
  next_action text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_items_queue_idx
ON work_items (workspace_id, status, urgency, due_at, created_at DESC);

CREATE INDEX work_items_contact_idx
ON work_items (workspace_id, contact_id, created_at DESC);

CREATE TRIGGER work_items_set_updated_at
BEFORE UPDATE ON work_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contact_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX timeline_contact_occurred_idx
ON contact_timeline_events (workspace_id, contact_id, occurred_at DESC);

CREATE TABLE communication_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'voice', 'facebook')),
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  idempotency_key text NOT NULL,
  provider text,
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX communication_outbox_dispatch_idx
ON communication_outbox (status, next_attempt_at)
WHERE status IN ('queued', 'failed');

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX appointments_workspace_start_idx
ON appointments (workspace_id, starts_at, status);

CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_workspace_created_idx
ON audit_log (workspace_id, created_at DESC);

INSERT INTO modules (module_key, name, description, category, is_core)
VALUES
  ('crm-core', 'CRM & Priority Flow', 'Contacts, unified timeline, consent, and work queue.', 'operations', true),
  ('smart-intake', 'Smart Intake & Quotes', 'Lead intake, quoting, margin, and gross-profit tools.', 'sales', false),
  ('booking', 'Booking & Calendar', 'Online scheduling, availability, and appointment management.', 'operations', false),
  ('messaging', 'Messaging Hub', 'Email, SMS, voice, and social conversation workflows.', 'communication', false),
  ('payments', 'Payments', 'Payment links, invoice follow-up, and collection workflows.', 'finance', false),
  ('analytics', 'Analytics', 'Workspace performance and conversion reporting.', 'reporting', false),
  ('media-kit', 'Before & After Media Kit', 'Brand, compress, and publish service photos.', 'marketing', false),
  ('site-builder', 'Sites, Funnels & Forms', 'Page builder, forms, surveys, and lead capture.', 'marketing', false)
ON CONFLICT (module_key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  is_core = excluded.is_core,
  is_active = true;

INSERT INTO subscription_plans (
  plan_key,
  name,
  description,
  monthly_price_cents,
  annual_price_cents
)
VALUES
  ('starter', 'Starter', 'Core CRM plus a focused starter module bundle.', 0, 0),
  ('growth', 'Growth', 'Operations, communication, and conversion modules.', 0, 0),
  ('agency', 'Agency', 'Multiple workspaces and future employee controls.', 0, 0)
ON CONFLICT (plan_key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  annual_price_cents = excluded.annual_price_cents,
  is_active = true;

INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id
FROM subscription_plans p
JOIN modules m ON
  m.module_key = 'crm-core'
  OR (p.plan_key = 'growth' AND m.module_key IN ('smart-intake', 'booking', 'messaging', 'analytics'))
  OR (p.plan_key = 'agency')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'workspace_subscriptions',
    'workspace_module_entitlements',
    'contacts',
    'contact_channels',
    'consent_records',
    'work_items',
    'contact_timeline_events',
    'communication_outbox',
    'appointments',
    'audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY workspace_isolation ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END;
$$;

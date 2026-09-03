-- # Supabase policy cleanup
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'workspace_subscriptions', 'workspace_module_entitlements', 'contacts',
    'contact_channels', 'consent_records', 'work_items',
    'contact_timeline_events', 'communication_outbox', 'appointments',
    'audit_log'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS workspace_isolation ON public.%I',
      table_name
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS auth_sessions_server_only ON public.auth_sessions;
CREATE POLICY auth_sessions_server_only
ON public.auth_sessions
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- # Foreign-key indexes
CREATE INDEX IF NOT EXISTS auth_sessions_workspace_idx
  ON public.auth_sessions (workspace_id);
CREATE INDEX IF NOT EXISTS plan_modules_module_idx
  ON public.plan_modules (module_id);
CREATE INDEX IF NOT EXISTS workspace_subscriptions_plan_idx
  ON public.workspace_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS workspace_entitlements_module_idx
  ON public.workspace_module_entitlements (module_id);
CREATE INDEX IF NOT EXISTS contacts_owner_user_idx
  ON public.contacts (owner_user_id);
CREATE INDEX IF NOT EXISTS contact_channels_contact_only_idx
  ON public.contact_channels (contact_id);
CREATE INDEX IF NOT EXISTS consent_records_contact_idx
  ON public.consent_records (contact_id);
CREATE INDEX IF NOT EXISTS consent_records_recorded_by_idx
  ON public.consent_records (recorded_by_user_id);
CREATE INDEX IF NOT EXISTS work_items_contact_only_idx
  ON public.work_items (contact_id);
CREATE INDEX IF NOT EXISTS timeline_contact_only_idx
  ON public.contact_timeline_events (contact_id);
CREATE INDEX IF NOT EXISTS timeline_actor_user_idx
  ON public.contact_timeline_events (actor_user_id);
CREATE INDEX IF NOT EXISTS outbox_contact_idx
  ON public.communication_outbox (contact_id);
CREATE INDEX IF NOT EXISTS outbox_created_by_idx
  ON public.communication_outbox (created_by_user_id);
CREATE INDEX IF NOT EXISTS appointments_contact_idx
  ON public.appointments (contact_id);
CREATE INDEX IF NOT EXISTS appointments_created_by_idx
  ON public.appointments (created_by_user_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_user_idx
  ON public.audit_log (actor_user_id);

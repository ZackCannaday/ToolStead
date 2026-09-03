-- # Existing project hardening compatibility
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

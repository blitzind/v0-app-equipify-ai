-- PostgREST exposure / service_role repair for native dialer (20270315120000).
--
-- The original native dialer migration created RLS policies for service_role but did not
-- grant table privileges. PostgREST uses the service role JWT; without explicit GRANTs
-- tables may exist while dial CRUD still fails (schema health v2 can report probeUncertain
-- when the PostgREST schema cache is stale).
--
-- Idempotent: GRANT is safe to re-run. Does not loosen anon/authenticated access.

grant usage on schema growth to service_role;

grant select, insert, update, delete on table growth.native_dialer_settings to service_role;
grant select, insert, update, delete on table growth.native_dialer_queue_items to service_role;
grant select, insert, update, delete on table growth.native_call_workspace_sessions to service_role;
grant select, insert, update, delete on table growth.native_call_wrapups to service_role;

-- Native dialer tables use gen_random_uuid(); grant is harmless when no sequences exist.
grant usage, select on all sequences in schema growth to service_role;

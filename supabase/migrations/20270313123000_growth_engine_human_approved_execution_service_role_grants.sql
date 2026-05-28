-- PostgREST exposure / service_role repair for human-approved execution (20270313120000).
--
-- The original human execution migration created RLS policies for service_role but did not
-- grant table privileges. PostgREST uses the service role JWT; without explicit GRANTs
-- tables may exist while readiness probes and CRUD still fail.
--
-- Idempotent: GRANT is safe to re-run. Does not loosen anon/authenticated access.

grant usage on schema growth to service_role;

grant select, insert, update, delete on table growth.human_execution_plans to service_role;
grant select, insert, update, delete on table growth.human_execution_plan_steps to service_role;
grant select, insert, update, delete on table growth.human_execution_approvals to service_role;

grant usage, select on all sequences in schema growth to service_role;

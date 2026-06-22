-- GE-v1-6 — Fix missing service_role grants on demo_assistant_sessions (production defect).
-- Root cause: 20270924120000 created the table without RLS/grants; API returns session_create_failed.

do $$
begin
  if to_regclass('growth.demo_assistant_sessions') is null then
    raise exception 'Missing dependency: growth.demo_assistant_sessions';
  end if;
end;
$$;

revoke all on table growth.demo_assistant_sessions from public, anon, authenticated;
grant select, insert, update, delete on table growth.demo_assistant_sessions to service_role;

alter table growth.demo_assistant_sessions enable row level security;
alter table growth.demo_assistant_sessions force row level security;

drop policy if exists growth_demo_assistant_sessions_service_role on growth.demo_assistant_sessions;
create policy growth_demo_assistant_sessions_service_role
  on growth.demo_assistant_sessions for all to service_role using (true) with check (true);

comment on table growth.demo_assistant_sessions is
  'GE-v1-4 demo assistant sessions — service_role access restored (GE-v1-6 cert fix).';

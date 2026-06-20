-- GS-SENDR-2D — Sequence bridge + page link registry (operator-initiated only).

create table if not exists growth.growth_sendr_sequence_page_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  landing_page_id uuid not null references growth.growth_landing_pages (id) on delete cascade,
  sequence_pattern_id uuid not null,
  sequence_pattern_step_id uuid,
  enrollment_run_id uuid,
  link_status text not null default 'approved'
    check (link_status in ('draft', 'approved', 'removed')),
  metadata jsonb not null default '{}'::jsonb,
  attached_by uuid,
  qa_marker text not null default 'growth-sendr-sequence-bridge-gs-sendr-2d-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sendr_sequence_page_links_org
  on growth.growth_sendr_sequence_page_links (organization_id, updated_at desc);

create index if not exists idx_growth_sendr_sequence_page_links_pattern
  on growth.growth_sendr_sequence_page_links (sequence_pattern_id, link_status)
  where link_status = 'approved';

create index if not exists idx_growth_sendr_sequence_page_links_page
  on growth.growth_sendr_sequence_page_links (landing_page_id, link_status)
  where link_status = 'approved';

create unique index if not exists idx_growth_sendr_sequence_page_links_step_page
  on growth.growth_sendr_sequence_page_links (sequence_pattern_step_id, landing_page_id)
  where sequence_pattern_step_id is not null and link_status = 'approved';

insert into growth.runtime_guardrail_settings (key, enabled, qa_marker)
values
  ('sendr_sequence_bridge_enabled', true, 'growth-sendr-sequence-bridge-gs-sendr-2d-v1'),
  ('sendr_timeline_enabled', true, 'growth-sendr-sequence-bridge-gs-sendr-2d-v1')
on conflict (key) do nothing;

alter table growth.growth_sendr_sequence_page_links enable row level security;
alter table growth.growth_sendr_sequence_page_links force row level security;
revoke all on table growth.growth_sendr_sequence_page_links from public, anon, authenticated;
grant select, insert, update, delete on growth.growth_sendr_sequence_page_links to service_role;

drop policy if exists growth_sendr_sequence_page_links_service_role on growth.growth_sendr_sequence_page_links;
create policy growth_sendr_sequence_page_links_service_role
  on growth.growth_sendr_sequence_page_links for all to service_role using (true) with check (true);

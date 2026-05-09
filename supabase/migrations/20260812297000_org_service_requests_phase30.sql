-- Phase 30 — Customer service request intake (org-scoped, RLS, communications link).

-- -----------------------------------------------------------------------------
-- Widen communication_events polymorphic link
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'communication_events_related_entity_type_check'
  ) then
    alter table public.communication_events
      drop constraint communication_events_related_entity_type_check;
  end if;
end $$;

alter table public.communication_events
  add constraint communication_events_related_entity_type_check
  check (
    related_entity_type is null
    or related_entity_type in (
      'work_order',
      'quote',
      'invoice',
      'maintenance_plan',
      'customer',
      'equipment',
      'organization',
      'prospect',
      'service_request'
    )
  );

-- -----------------------------------------------------------------------------
-- org_service_requests
-- -----------------------------------------------------------------------------

create table if not exists public.org_service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid,
  customer_location_id uuid,
  equipment_id uuid,
  portal_user_id uuid references public.portal_users (id) on delete set null,
  requester_name text,
  requester_email text,
  requester_phone text,
  issue_summary text not null check (char_length(trim(issue_summary)) > 0),
  description text,
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'critical')),
  preferred_service_window text,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new'
    check (
      status in (
        'new',
        'reviewing',
        'needs_info',
        'approved',
        'converted',
        'declined',
        'archived'
      )
    ),
  source text not null default 'internal'
    check (source in ('internal', 'portal', 'public_link')),
  assigned_to_user_id uuid references auth.users (id) on delete set null,
  converted_work_order_id uuid,
  converted_customer_id uuid,
  converted_equipment_id uuid,
  internal_notes_log jsonb not null default '[]'::jsonb,
  created_by_user_id uuid references auth.users (id) on delete set null,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_service_requests_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete set null
);

-- Optional FKs (location / equipment / converted WO) validated in application
-- layer — avoids brittle composite uniqueness drift across environments.

create index if not exists idx_org_service_requests_org_status_created
  on public.org_service_requests (organization_id, status, created_at desc);

create index if not exists idx_org_service_requests_org_customer
  on public.org_service_requests (organization_id, customer_id);

create index if not exists idx_org_service_requests_org_assigned
  on public.org_service_requests (organization_id, assigned_to_user_id);

create index if not exists idx_org_service_requests_org_portal_user
  on public.org_service_requests (organization_id, portal_user_id);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_service_requests_set_updated_at on public.org_service_requests;
    create trigger trg_org_service_requests_set_updated_at
    before update on public.org_service_requests
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.org_service_requests is
  'Inbound service / repair requests for triage before work order creation.';

alter table public.org_service_requests enable row level security;
alter table public.org_service_requests force row level security;

revoke all on table public.org_service_requests from public, anon;

grant select, insert, update, delete on table public.org_service_requests to authenticated;
grant select, insert, update, delete on table public.org_service_requests to service_role;

drop policy if exists "org_service_requests_select_member" on public.org_service_requests;
create policy "org_service_requests_select_member"
on public.org_service_requests
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_service_requests_insert_dispatch" on public.org_service_requests;
create policy "org_service_requests_insert_dispatch"
on public.org_service_requests
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "org_service_requests_update_dispatch" on public.org_service_requests;
create policy "org_service_requests_update_dispatch"
on public.org_service_requests
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "org_service_requests_delete_dispatch" on public.org_service_requests;
create policy "org_service_requests_delete_dispatch"
on public.org_service_requests
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

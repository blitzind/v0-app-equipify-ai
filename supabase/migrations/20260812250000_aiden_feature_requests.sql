create table if not exists public.product_feature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  submitted_by uuid null references auth.users (id) on delete set null,
  source text not null default 'aiden',
  title text not null,
  original_question text not null,
  module text null,
  current_path text null,
  current_limitation text null,
  suggested_improvement text null,
  business_value text null,
  chat_context jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  priority text not null default 'unreviewed',
  internal_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_feature_requests_source_check
    check (source in ('aiden', 'platform_admin', 'manual')),
  constraint product_feature_requests_status_check
    check (status in ('new', 'reviewed', 'planned', 'in_progress', 'released', 'declined')),
  constraint product_feature_requests_priority_check
    check (priority in ('unreviewed', 'low', 'medium', 'high', 'urgent'))
);

create index if not exists idx_product_feature_requests_org_created
  on public.product_feature_requests (organization_id, created_at desc);

create index if not exists idx_product_feature_requests_status_created
  on public.product_feature_requests (status, created_at desc);

create index if not exists idx_product_feature_requests_submitted_by
  on public.product_feature_requests (submitted_by, created_at desc);

alter table public.product_feature_requests enable row level security;

drop policy if exists "product_feature_requests_insert_org_member" on public.product_feature_requests;
create policy "product_feature_requests_insert_org_member"
on public.product_feature_requests
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and submitted_by = auth.uid()
  and source = 'aiden'
);

drop policy if exists "product_feature_requests_select_own" on public.product_feature_requests;
create policy "product_feature_requests_select_own"
on public.product_feature_requests
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and submitted_by = auth.uid()
);

drop policy if exists "product_feature_requests_update_own_none" on public.product_feature_requests;
create policy "product_feature_requests_update_own_none"
on public.product_feature_requests
for update
to authenticated
using (false)
with check (false);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_product_feature_requests_set_updated_at on public.product_feature_requests;
    create trigger trg_product_feature_requests_set_updated_at
    before update on public.product_feature_requests
    for each row execute function public.set_updated_at();
  end if;
end $$;

revoke all on table public.product_feature_requests from public, anon;
grant select, insert on table public.product_feature_requests to authenticated;

comment on table public.product_feature_requests is
  'Lightweight AIden product feature requests. Platform admin review is performed through service-role-backed admin APIs.';

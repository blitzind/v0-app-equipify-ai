-- Org-scoped communication templates for quotes, invoices, maintenance, thank-you, and review flows.

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_key text not null,
  name text not null,
  category text not null,
  subject text,
  body text not null default '',
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'in_app')),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint communication_templates_org_key_unique unique (organization_id, template_key),
  constraint communication_templates_category_check check (
    category in (
      'quote_follow_up',
      'invoice_reminder',
      'maintenance_reminder',
      'thank_you',
      'review_request'
    )
  )
);

create index if not exists idx_communication_templates_org_updated
  on public.communication_templates (organization_id, updated_at desc);

comment on table public.communication_templates is
  'Editable message templates for operational outreach (not a full campaign builder).';

revoke all on table public.communication_templates from public, anon;
grant select, insert, update, delete on table public.communication_templates to authenticated;

alter table public.communication_templates enable row level security;
alter table public.communication_templates force row level security;

drop policy if exists "communication_templates_select_member" on public.communication_templates;
create policy "communication_templates_select_member"
on public.communication_templates for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "communication_templates_write_member" on public.communication_templates;
create policy "communication_templates_write_member"
on public.communication_templates for all to authenticated
using (public.is_org_member (organization_id))
with check (public.is_org_member (organization_id));

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_communication_templates_set_updated_at on public.communication_templates;
    create trigger trg_communication_templates_set_updated_at
      before update on public.communication_templates
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

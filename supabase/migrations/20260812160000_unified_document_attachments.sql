-- Invoices + Certificates + Work Orders + Portal — Phase 7 unified document attachments.
--
-- This table is a provider-neutral attachment registry layered on top of the
-- existing private `work-order-attachments` storage bucket. It does not replace
-- `work_order_attachments` or `certificate_attachments`; existing workflows can
-- continue while invoices, equipment, customers, and future document surfaces use
-- one shared metadata shape.

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid,text[])';
  end if;
end;
$$;

create table if not exists public.org_document_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  attachment_type text not null default 'document',
  storage_bucket text not null default 'work-order-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  visibility_scope text not null default 'internal',
  related_entity_type text not null,
  related_entity_id uuid not null,
  portal_visible boolean not null default false,
  portal_release_status text not null default 'internal',
  source_system text,
  metadata_json jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  constraint org_document_attachments_type_check check (
    attachment_type in (
      'external_certificate',
      'generated_certificate',
      'invoice_pdf',
      'service_report',
      'photo',
      'manual',
      'compliance_document',
      'signed_paperwork',
      'document',
      'other'
    )
  ),
  constraint org_document_attachments_visibility_check check (
    visibility_scope in ('internal', 'portal_visible', 'pending_release', 'released_after_payment', 'released_manual')
  ),
  constraint org_document_attachments_release_check check (
    portal_release_status in ('internal', 'pending_release', 'released', 'released_after_payment', 'manual_hold')
  ),
  constraint org_document_attachments_entity_check check (
    related_entity_type in ('work_order', 'invoice', 'calibration_record', 'equipment', 'customer', 'quote')
  )
);

create unique index if not exists idx_org_document_attachments_storage_path
  on public.org_document_attachments (storage_bucket, storage_path)
  where deleted_at is null;

create index if not exists idx_org_document_attachments_entity
  on public.org_document_attachments (organization_id, related_entity_type, related_entity_id, uploaded_at desc)
  where deleted_at is null;

create index if not exists idx_org_document_attachments_portal
  on public.org_document_attachments (organization_id, portal_visible, portal_release_status, related_entity_type)
  where deleted_at is null;

revoke all on table public.org_document_attachments from public, anon;
grant select, insert, update, delete on table public.org_document_attachments to authenticated;

alter table public.org_document_attachments enable row level security;
alter table public.org_document_attachments force row level security;

drop policy if exists "org_document_attachments_select_member" on public.org_document_attachments;
create policy "org_document_attachments_select_member"
on public.org_document_attachments for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_document_attachments_write_roles" on public.org_document_attachments;
create policy "org_document_attachments_write_roles"
on public.org_document_attachments for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'tech']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager', 'tech']));

comment on table public.org_document_attachments is
  'Unified org-scoped attachment registry for invoices, certificates, work orders, equipment, customers, and quotes.';
comment on column public.org_document_attachments.portal_visible is
  'Marks a document as intended for portal exposure. Portal routes still re-check customer scope and release status.';
comment on column public.org_document_attachments.portal_release_status is
  'Release gate metadata only; storage routes remain responsible for enforcing portal access.';

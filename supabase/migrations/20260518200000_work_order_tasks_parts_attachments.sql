-- Work order detail tabs: tasks, parts/materials line items, file attachments + storage bucket.
-- Depends on: work_orders, is_org_member, has_org_role, org_vendors, org_purchase_orders (optional FKs).

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

-- ─── Tasks ───────────────────────────────────────────────────────────────────

create table if not exists public.work_order_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  completed boolean not null default false,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_order_tasks_completed_at_consistency check (
    (completed = true and completed_at is not null) or
    (completed = false and completed_at is null)
  )
);

create index if not exists idx_work_order_tasks_org_wo_sort
  on public.work_order_tasks (organization_id, work_order_id, sort_order, created_at);

drop trigger if exists trg_work_order_tasks_set_updated_at on public.work_order_tasks;
create trigger trg_work_order_tasks_set_updated_at
before update on public.work_order_tasks
for each row execute function public.set_updated_at();

create or replace function public.work_order_tasks_sync_completed_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  elsif tg_op = 'UPDATE' and new.completed is distinct from old.completed then
    if new.completed then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_order_tasks_completed_at on public.work_order_tasks;
create trigger trg_work_order_tasks_completed_at
before insert or update on public.work_order_tasks
for each row execute function public.work_order_tasks_sync_completed_at();

revoke all on table public.work_order_tasks from public, anon;
grant select, insert, update, delete on table public.work_order_tasks to authenticated;

alter table public.work_order_tasks enable row level security;
alter table public.work_order_tasks force row level security;

drop policy if exists "work_order_tasks_select_member" on public.work_order_tasks;
create policy "work_order_tasks_select_member"
on public.work_order_tasks for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "work_order_tasks_write_roles" on public.work_order_tasks;
create policy "work_order_tasks_write_roles"
on public.work_order_tasks for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- ─── Parts / materials line items ─────────────────────────────────────────────

create table if not exists public.work_order_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  description text not null check (char_length(trim(description)) > 0),
  quantity numeric(14, 4) not null default 1 check (quantity > 0),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  line_total_cents bigint not null default 0 check (line_total_cents >= 0),
  vendor_id uuid references public.org_vendors (id) on delete set null,
  purchase_order_id uuid references public.org_purchase_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_order_line_items_org_wo
  on public.work_order_line_items (organization_id, work_order_id);

create index if not exists idx_work_order_line_items_vendor
  on public.work_order_line_items (organization_id, vendor_id)
  where vendor_id is not null;

drop trigger if exists trg_work_order_line_items_set_updated_at on public.work_order_line_items;
create trigger trg_work_order_line_items_set_updated_at
before update on public.work_order_line_items
for each row execute function public.set_updated_at();

create or replace function public.work_order_line_items_fill_line_total()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.line_total_cents := round(new.quantity * new.unit_cost_cents::numeric)::bigint;
  return new;
end;
$$;

drop trigger if exists trg_work_order_line_items_line_total on public.work_order_line_items;
create trigger trg_work_order_line_items_line_total
before insert or update on public.work_order_line_items
for each row execute function public.work_order_line_items_fill_line_total();

create or replace function public.work_order_line_items_recalc_parts_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  wo uuid;
  org uuid;
  sum_cents bigint;
begin
  wo := coalesce(new.work_order_id, old.work_order_id);
  org := coalesce(new.organization_id, old.organization_id);

  select coalesce(sum(li.line_total_cents), 0)::bigint into sum_cents
  from public.work_order_line_items li
  where li.work_order_id = wo and li.organization_id = org;

  update public.work_orders w
  set total_parts_cents = sum_cents
  where w.id = wo and w.organization_id = org;

  return coalesce(new, old);
end;
$$;

revoke all on function public.work_order_line_items_recalc_parts_total() from public, anon, authenticated;
alter function public.work_order_line_items_recalc_parts_total() owner to postgres;

drop trigger if exists trg_work_order_line_items_sync_wo_total on public.work_order_line_items;
create trigger trg_work_order_line_items_sync_wo_total
after insert or update or delete on public.work_order_line_items
for each row execute function public.work_order_line_items_recalc_parts_total();

revoke all on table public.work_order_line_items from public, anon;
grant select, insert, update, delete on table public.work_order_line_items to authenticated;

alter table public.work_order_line_items enable row level security;
alter table public.work_order_line_items force row level security;

drop policy if exists "work_order_line_items_select_member" on public.work_order_line_items;
create policy "work_order_line_items_select_member"
on public.work_order_line_items for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "work_order_line_items_write_roles" on public.work_order_line_items;
create policy "work_order_line_items_write_roles"
on public.work_order_line_items for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- ─── Attachments metadata ─────────────────────────────────────────────────────

create table if not exists public.work_order_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  category text not null check (category in ('photo', 'document'))
);

create unique index if not exists idx_work_order_attachments_storage_path
  on public.work_order_attachments (storage_path);

create index if not exists idx_work_order_attachments_org_wo
  on public.work_order_attachments (organization_id, work_order_id, uploaded_at);

revoke all on table public.work_order_attachments from public, anon;
grant select, insert, update, delete on table public.work_order_attachments to authenticated;

alter table public.work_order_attachments enable row level security;
alter table public.work_order_attachments force row level security;

drop policy if exists "work_order_attachments_select_member" on public.work_order_attachments;
create policy "work_order_attachments_select_member"
on public.work_order_attachments for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "work_order_attachments_write_roles" on public.work_order_attachments;
create policy "work_order_attachments_write_roles"
on public.work_order_attachments for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- ─── Storage bucket (private; app uses signed URLs) ───────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-order-attachments',
  'work-order-attachments',
  false,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {organization_id}/{work_order_id}/{uuid}-{filename}

drop policy if exists "wo_attachments_select_member" on storage.objects;
create policy "wo_attachments_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.is_org_member(split_part(name, '/', 1)::uuid)
);

drop policy if exists "wo_attachments_insert_roles" on storage.objects;
create policy "wo_attachments_insert_roles"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

drop policy if exists "wo_attachments_update_roles" on storage.objects;
create policy "wo_attachments_update_roles"
on storage.objects for update to authenticated
using (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
)
with check (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

drop policy if exists "wo_attachments_delete_roles" on storage.objects;
create policy "wo_attachments_delete_roles"
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

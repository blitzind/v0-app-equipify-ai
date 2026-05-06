-- Operational technicians (field resources) vs team members (login / organization_members).
-- Adds stable membership_id on organization_members, technicians table, assignment columns,
-- sync logic for work_orders + maintenance_plans, and technician_id on cert/note tables.

-- 1) Stable surrogate id on organization_members (for FK from technicians)
alter table public.organization_members
  add column if not exists membership_id uuid;

update public.organization_members
set membership_id = gen_random_uuid()
where membership_id is null;

alter table public.organization_members
  alter column membership_id set default gen_random_uuid(),
  alter column membership_id set not null;

create unique index if not exists idx_organization_members_membership_id
  on public.organization_members (membership_id);

comment on column public.organization_members.membership_id is
  'Stable public id for this membership row; used to link operational technicians without duplicating composite PK.';

-- 2) Technicians (operational profiles; optional link to one organization_members row)
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid references public.organization_members (membership_id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) > 0),
  email text,
  phone text,
  avatar_url text,
  job_title text,
  region text,
  skills text[] not null default '{}',
  availability_status text,
  start_date date,
  labor_rate_cents bigint check (labor_rate_cents is null or labor_rate_cents >= 0),
  operational_status text not null default 'active'
    check (operational_status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technicians_availability_status_check
    check (
      availability_status is null
      or availability_status in ('Available', 'On Job', 'Off', 'Vacation')
    )
);

create unique index if not exists idx_technicians_org_membership_unique
  on public.technicians (organization_id, membership_id)
  where membership_id is not null;

create index if not exists idx_technicians_org_operational_status
  on public.technicians (organization_id, operational_status);

comment on table public.technicians is
  'Operational field/service technician profile; may exist without login. Optionally linked to organization_members.membership_id.';

-- RLS
alter table public.technicians enable row level security;

grant select, insert, update, delete on public.technicians to authenticated;

drop policy if exists "technicians_select_member" on public.technicians;
create policy "technicians_select_member"
on public.technicians
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "technicians_insert_mgr" on public.technicians;
create policy "technicians_insert_mgr"
on public.technicians
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "technicians_update_mgr" on public.technicians;
create policy "technicians_update_mgr"
on public.technicians
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
)
with check (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "technicians_delete_mgr" on public.technicians;
create policy "technicians_delete_mgr"
on public.technicians
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_technicians_updated_at on public.technicians;
    create trigger trg_technicians_updated_at
    before update on public.technicians
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 3) Backfill technicians from existing roster-capable members (idempotent)
insert into public.technicians (
  organization_id,
  membership_id,
  full_name,
  email,
  phone,
  avatar_url,
  job_title,
  region,
  skills,
  availability_status,
  start_date,
  operational_status
)
select
  om.organization_id,
  om.membership_id,
  coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(p.email::text), ''),
    'Team member'
  ),
  p.email::text,
  p.phone,
  p.avatar_url,
  om.job_title,
  om.region,
  coalesce(om.skills, '{}'),
  om.availability_status,
  om.start_date,
  'active'
from public.organization_members om
inner join public.profiles p on p.id = om.user_id
where om.role in ('owner', 'admin', 'manager', 'tech')
  and om.status in ('active', 'invited')
  and not exists (
    select 1
    from public.technicians t0
    where t0.organization_id = om.organization_id
      and t0.membership_id = om.membership_id
  );

-- 4) Work orders: assigned_technician_id
alter table public.work_orders
  add column if not exists assigned_technician_id uuid references public.technicians (id) on delete set null;

create index if not exists idx_work_orders_org_assigned_technician
  on public.work_orders (organization_id, assigned_technician_id)
  where assigned_technician_id is not null;

comment on column public.work_orders.assigned_technician_id is
  'Operational technician assignment; may be set without login. Synced with assigned_user_id when linked.';

-- 5) Normalize assignments on work_orders (before member validation)
create or replace function public.work_orders_normalize_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.assigned_technician_id is null and new.assigned_user_id is not null then
    select t.id
    into new.assigned_technician_id
    from public.technicians t
    inner join public.organization_members om
      on om.membership_id = t.membership_id
     and om.organization_id = t.organization_id
    where t.organization_id = new.organization_id
      and om.user_id = new.assigned_user_id
    limit 1;
  end if;

  if new.assigned_technician_id is not null then
    select om.user_id
    into new.assigned_user_id
    from public.technicians t
    left join public.organization_members om
      on om.membership_id = t.membership_id
     and om.organization_id = t.organization_id
     and om.status = 'active'
    where t.id = new.assigned_technician_id
      and t.organization_id = new.organization_id;
  end if;

  return new;
end;
$$;

revoke all on function public.work_orders_normalize_assignment() from public, anon, authenticated;
alter function public.work_orders_normalize_assignment() owner to postgres;

drop trigger if exists trg_work_orders_normalize_assignment on public.work_orders;
create trigger trg_work_orders_normalize_assignment
before insert or update of assigned_user_id, assigned_technician_id on public.work_orders
for each row execute function public.work_orders_normalize_assignment();

-- Backfill work order technician links
update public.work_orders wo
set assigned_technician_id = t.id
from public.technicians t
inner join public.organization_members om
  on om.membership_id = t.membership_id
 and om.organization_id = t.organization_id
where wo.organization_id = t.organization_id
  and wo.assigned_user_id = om.user_id
  and wo.assigned_technician_id is null;

-- 6) Maintenance plans
alter table public.maintenance_plans
  add column if not exists assigned_technician_id uuid references public.technicians (id) on delete set null;

create index if not exists idx_maintenance_plans_org_assigned_technician
  on public.maintenance_plans (organization_id, assigned_technician_id)
  where assigned_technician_id is not null;

create or replace function public.maintenance_plans_normalize_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.assigned_technician_id is null and new.assigned_user_id is not null then
    select t.id
    into new.assigned_technician_id
    from public.technicians t
    inner join public.organization_members om
      on om.membership_id = t.membership_id
     and om.organization_id = t.organization_id
    where t.organization_id = new.organization_id
      and om.user_id = new.assigned_user_id
    limit 1;
  end if;

  if new.assigned_technician_id is not null then
    select om.user_id
    into new.assigned_user_id
    from public.technicians t
    left join public.organization_members om
      on om.membership_id = t.membership_id
     and om.organization_id = t.organization_id
     and om.status = 'active'
    where t.id = new.assigned_technician_id
      and t.organization_id = new.organization_id;
  end if;

  return new;
end;
$$;

revoke all on function public.maintenance_plans_normalize_assignment() from public, anon, authenticated;
alter function public.maintenance_plans_normalize_assignment() owner to postgres;

drop trigger if exists trg_maintenance_plans_normalize_assignment on public.maintenance_plans;
create trigger trg_maintenance_plans_normalize_assignment
before insert or update of assigned_user_id, assigned_technician_id on public.maintenance_plans
for each row execute function public.maintenance_plans_normalize_assignment();

update public.maintenance_plans mp
set assigned_technician_id = t.id
from public.technicians t
inner join public.organization_members om
  on om.membership_id = t.membership_id
 and om.organization_id = t.organization_id
where mp.organization_id = t.organization_id
  and mp.assigned_user_id = om.user_id
  and mp.assigned_technician_id is null;

-- 7) Certifications / notes: technician_id + backfill
alter table public.technician_certifications
  add column if not exists technician_id uuid references public.technicians (id) on delete cascade;

alter table public.technician_certifications
  alter column technician_user_id drop not null;

create index if not exists idx_technician_certifications_org_technician_row
  on public.technician_certifications (organization_id, technician_id);

update public.technician_certifications tc
set technician_id = t.id
from public.technicians t
inner join public.organization_members om
  on om.membership_id = t.membership_id
 and om.organization_id = t.organization_id
where tc.organization_id = t.organization_id
  and tc.technician_user_id = om.user_id
  and tc.technician_id is null;

alter table public.technician_notes
  add column if not exists technician_id uuid references public.technicians (id) on delete cascade;

alter table public.technician_notes
  alter column technician_user_id drop not null;

create index if not exists idx_technician_notes_org_technician_row
  on public.technician_notes (organization_id, technician_id);

update public.technician_notes tn
set technician_id = t.id
from public.technicians t
inner join public.organization_members om
  on om.membership_id = t.membership_id
 and om.organization_id = t.organization_id
where tn.organization_id = t.organization_id
  and tn.technician_user_id = om.user_id
  and tn.technician_id is null;

-- Relaxed validation: technician row in org OR legacy auth user member
create or replace function public.technician_certifications_validate_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.technician_id is not null then
    if not exists (
      select 1 from public.technicians t
      where t.id = new.technician_id
        and t.organization_id = new.organization_id
    ) then
      raise exception 'technician_certifications: technician not in organization';
    end if;
    return new;
  end if;

  if new.technician_user_id is not null then
    if not exists (
      select 1
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.user_id = new.technician_user_id
        and om.status = 'active'
    ) then
      raise exception 'technician_certifications: technician must be an active organization member';
    end if;
    return new;
  end if;

  raise exception 'technician_certifications: technician_id or technician_user_id required';
end;
$$;

drop trigger if exists trg_technician_certifications_validate_member on public.technician_certifications;
create trigger trg_technician_certifications_validate_target
before insert or update of organization_id, technician_user_id, technician_id on public.technician_certifications
for each row execute function public.technician_certifications_validate_target();

create or replace function public.technician_notes_validate_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.technician_id is not null then
    if not exists (
      select 1 from public.technicians t
      where t.id = new.technician_id
        and t.organization_id = new.organization_id
    ) then
      raise exception 'technician_notes: technician not in organization';
    end if;
    return new;
  end if;

  if new.technician_user_id is not null then
    if not exists (
      select 1
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.user_id = new.technician_user_id
        and om.status = 'active'
    ) then
      raise exception 'technician_notes: technician must be an active organization member';
    end if;
    return new;
  end if;

  raise exception 'technician_notes: technician_id or technician_user_id required';
end;
$$;

drop trigger if exists trg_technician_notes_validate_member on public.technician_notes;
create trigger trg_technician_notes_validate_target
before insert or update of organization_id, technician_user_id, technician_id on public.technician_notes
for each row execute function public.technician_notes_validate_target();

-- Policies: allow managers to manage certs/notes by technician_id (same org)
drop policy if exists "technician_certifications_insert" on public.technician_certifications;
create policy "technician_certifications_insert"
on public.technician_certifications
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
    or exists (
      select 1 from public.technicians t
      where t.id = technician_id
        and t.organization_id = organization_id
        and t.membership_id is not null
        and exists (
          select 1 from public.organization_members om
          where om.membership_id = t.membership_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
    )
  )
);

drop policy if exists "technician_certifications_update" on public.technician_certifications;
create policy "technician_certifications_update"
on public.technician_certifications
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
    or exists (
      select 1 from public.technicians t
      where t.id = technician_id
        and t.organization_id = organization_id
        and t.membership_id is not null
        and exists (
          select 1 from public.organization_members om
          where om.membership_id = t.membership_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
    )
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
    or exists (
      select 1 from public.technicians t
      where t.id = technician_id
        and t.organization_id = organization_id
        and t.membership_id is not null
        and exists (
          select 1 from public.organization_members om
          where om.membership_id = t.membership_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
    )
  )
);

drop policy if exists "technician_certifications_delete" on public.technician_certifications;
create policy "technician_certifications_delete"
on public.technician_certifications
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

drop policy if exists "technician_notes_insert" on public.technician_notes;
create policy "technician_notes_insert"
on public.technician_notes
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
    or exists (
      select 1 from public.technicians t
      where t.id = technician_id
        and t.organization_id = organization_id
        and t.membership_id is not null
        and exists (
          select 1 from public.organization_members om
          where om.membership_id = t.membership_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
    )
  )
);

drop policy if exists "technician_notes_update" on public.technician_notes;
create policy "technician_notes_update"
on public.technician_notes
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
    or exists (
      select 1 from public.technicians t
      where t.id = technician_id
        and t.organization_id = organization_id
        and t.membership_id is not null
        and exists (
          select 1 from public.organization_members om
          where om.membership_id = t.membership_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
    )
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
    or exists (
      select 1 from public.technicians t
      where t.id = technician_id
        and t.organization_id = organization_id
        and t.membership_id is not null
        and exists (
          select 1 from public.organization_members om
          where om.membership_id = t.membership_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
    )
  )
);

drop policy if exists "technician_notes_delete" on public.technician_notes;
create policy "technician_notes_delete"
on public.technician_notes
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

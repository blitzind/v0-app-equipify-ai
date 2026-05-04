-- Repair / ensure technician roster columns (runs after 20260505190000_*).
-- Idempotent: safe if 20260503120000_technician_roster_fields.sql already ran.

alter table public.profiles
  add column if not exists phone text;

alter table public.organization_members
  add column if not exists job_title text;

alter table public.organization_members
  add column if not exists region text;

alter table public.organization_members
  add column if not exists skills text[] not null default '{}';

alter table public.organization_members
  add column if not exists availability_status text;

alter table public.organization_members
  add column if not exists start_date date;

alter table public.organization_members
  drop constraint if exists organization_members_availability_status_check;

alter table public.organization_members
  add constraint organization_members_availability_status_check
  check (
    availability_status is null
    or availability_status in ('Available', 'On Job', 'Off', 'Vacation')
  );

create or replace function public.patch_member_roster_details(
  p_organization_id uuid,
  p_user_id uuid,
  p_job_title text,
  p_region text,
  p_skills text[],
  p_availability_status text,
  p_start_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.status in ('active', 'invited')
  ) then
    raise exception 'membership not found';
  end if;

  if v_actor = p_user_id then
    update public.organization_members
    set
      job_title = nullif(trim(p_job_title), ''),
      region = nullif(trim(p_region), ''),
      skills = coalesce(p_skills, '{}'),
      availability_status = p_availability_status,
      start_date = p_start_date,
      updated_at = now()
    where organization_id = p_organization_id
      and user_id = p_user_id;
    return;
  end if;

  if public.has_org_role(p_organization_id, array['owner', 'admin']::text[]) then
    update public.organization_members
    set
      job_title = nullif(trim(p_job_title), ''),
      region = nullif(trim(p_region), ''),
      skills = coalesce(p_skills, '{}'),
      availability_status = p_availability_status,
      start_date = p_start_date,
      updated_at = now()
    where organization_id = p_organization_id
      and user_id = p_user_id;
    return;
  end if;

  raise exception 'forbidden';
end;
$$;

revoke all on function public.patch_member_roster_details(
  uuid, uuid, text, text, text[], text, date
) from public;

grant execute on function public.patch_member_roster_details(
  uuid, uuid, text, text, text[], text, date
) to authenticated;

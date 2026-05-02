-- Automation metadata for maintenance plans + allow explicit created_by on system WO inserts.

alter table public.maintenance_plans
  add column if not exists last_auto_wo_at timestamptz;

comment on column public.maintenance_plans.last_auto_wo_at is
  'Last time an auto work order was generated from this plan (automation engine).';

-- Work order trigger: keep auth.uid() for normal users; allow explicit created_by when no JWT (service role automation).
create or replace function public.set_work_orders_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is not null then
      -- Automation / service-role inserts supply organization owner or system user id.
      null;
    else
      raise exception 'created_by cannot be determined';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable once created';
    end if;
  end if;

  return new;
end;
$$;

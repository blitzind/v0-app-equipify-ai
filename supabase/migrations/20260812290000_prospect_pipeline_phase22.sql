-- Phase 22 — Prospect pipeline stages + operational ownership fields.
-- Idempotent: additive columns, constraint replacement with backfill.

-- -----------------------------------------------------------------------------
-- Ownership (nullable FKs — clearing assignment is valid ops state).
-- -----------------------------------------------------------------------------

alter table public.prospects
  add column if not exists assigned_to_user_id uuid references auth.users (id) on delete set null;

alter table public.prospects
  add column if not exists last_contacted_by_user_id uuid references auth.users (id) on delete set null;

alter table public.prospects
  add column if not exists next_action_owner_user_id uuid references auth.users (id) on delete set null;

create index if not exists idx_prospects_org_assigned
  on public.prospects (organization_id, assigned_to_user_id)
  where assigned_to_user_id is not null;

comment on column public.prospects.assigned_to_user_id is
  'Primary owner / rep responsible for this prospect in the pipeline.';
comment on column public.prospects.last_contacted_by_user_id is
  'Staff member who last logged a touch (follow-up route stamps this).';
comment on column public.prospects.next_action_owner_user_id is
  'Who owns the next follow-up action when different from assigned_to.';

-- -----------------------------------------------------------------------------
-- Expand pipeline status vocabulary (replace legacy follow_up / quoted).
-- -----------------------------------------------------------------------------

alter table public.prospects drop constraint if exists prospects_status_check;

update public.prospects
set status = 'proposal_sent'
where status = 'quoted';

update public.prospects
set status = 'qualified'
where status = 'follow_up';

alter table public.prospects
  add constraint prospects_status_check
  check (
    status in (
      'new',
      'attempting_contact',
      'contacted',
      'qualified',
      'proposal_sent',
      'won',
      'lost',
      'nurture'
    )
  );

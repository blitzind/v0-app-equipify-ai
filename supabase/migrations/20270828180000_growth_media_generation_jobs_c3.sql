-- Growth Engine C3 — Persistent media generation runs linked to public.ai_jobs.
-- Infrastructure only — no provider execution, media output, or automation triggers.

do $$
begin
  if to_regclass('public.ai_jobs') is null then
    raise exception 'Missing dependency: public.ai_jobs';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.media_generation_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.media_generation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ai_job_id uuid not null references public.ai_jobs (id) on delete cascade,
  generation_type text not null
    check (generation_type in (
      'voice_generation',
      'avatar_generation',
      'text_to_video',
      'image_generation',
      'video_render',
      'media_transformation'
    )),
  provider text not null,
  status text not null default 'queued'
    check (status in ('queued', 'preparing', 'processing', 'completed', 'failed', 'cancelled')),
  progress_percent integer not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  error_json jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0 check (retry_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  qa_marker text not null default 'growth-media-generation-jobs-c3-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, ai_job_id)
);

create index if not exists idx_growth_media_generation_runs_org_updated
  on growth.media_generation_runs (organization_id, updated_at desc);

create index if not exists idx_growth_media_generation_runs_org_status
  on growth.media_generation_runs (organization_id, status, updated_at desc);

create index if not exists idx_growth_media_generation_runs_org_type
  on growth.media_generation_runs (organization_id, generation_type, updated_at desc);

create index if not exists idx_growth_media_generation_runs_ai_job
  on growth.media_generation_runs (ai_job_id);

comment on table growth.media_generation_runs is
  'Durable Growth media generation runs linked to public.ai_jobs — provider execution deferred to C1/C2 workers.';

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_media_generation_runs_updated_at on growth.media_generation_runs;
create trigger trg_growth_media_generation_runs_updated_at
  before update on growth.media_generation_runs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + grants (Growth Engine service-role pattern)
-- -----------------------------------------------------------------------------

alter table growth.media_generation_runs enable row level security;
alter table growth.media_generation_runs force row level security;

revoke all on table growth.media_generation_runs from public, anon, authenticated;
grant select, insert, update, delete on growth.media_generation_runs to service_role;

drop policy if exists growth_media_generation_runs_service_role on growth.media_generation_runs;
create policy growth_media_generation_runs_service_role
  on growth.media_generation_runs for all to service_role using (true) with check (true);

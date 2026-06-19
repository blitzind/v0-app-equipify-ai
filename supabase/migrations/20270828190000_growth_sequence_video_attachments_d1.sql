-- Growth Engine D1 — Sequence video attachment orchestration (metadata only; no send execution).

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

create table if not exists growth.sequence_video_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automation_flow_id uuid,
  automation_node_id uuid,
  sequence_pattern_step_id uuid references growth.sequence_pattern_steps (id) on delete set null,
  attachment_type text not null
    check (attachment_type in ('email', 'sms', 'voice_drop')),
  attachment_status text not null default 'draft'
    check (attachment_status in ('draft', 'pending_approval', 'approved', 'removed')),
  video_asset_id uuid references growth.video_assets (id) on delete set null,
  video_page_id uuid references growth.video_pages (id) on delete set null,
  voice_media_asset_id uuid references growth.media_assets (id) on delete set null,
  avatar_media_asset_id uuid references growth.media_assets (id) on delete set null,
  thumbnail_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  ai_payload jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  qa_marker text not null default 'growth-sequence-video-attachments-d1-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_video_attachments_org_status
  on growth.sequence_video_attachments (organization_id, attachment_status, updated_at desc);

create index if not exists idx_growth_sequence_video_attachments_node
  on growth.sequence_video_attachments (automation_node_id)
  where automation_node_id is not null;

create index if not exists idx_growth_sequence_video_attachments_pattern_step
  on growth.sequence_video_attachments (sequence_pattern_step_id)
  where sequence_pattern_step_id is not null;

comment on table growth.sequence_video_attachments is
  'Human-supervised video asset attachments for sequence/automation steps — orchestration metadata only; no outbound send.';

drop trigger if exists trg_growth_sequence_video_attachments_updated_at on growth.sequence_video_attachments;
create trigger trg_growth_sequence_video_attachments_updated_at
  before update on growth.sequence_video_attachments
  for each row execute function public.set_updated_at();

alter table growth.sequence_video_attachments enable row level security;
alter table growth.sequence_video_attachments force row level security;

revoke all on table growth.sequence_video_attachments from public, anon, authenticated;
grant select, insert, update, delete on growth.sequence_video_attachments to service_role;

drop policy if exists growth_sequence_video_attachments_service_role on growth.sequence_video_attachments;
create policy growth_sequence_video_attachments_service_role
  on growth.sequence_video_attachments for all to service_role using (true) with check (true);

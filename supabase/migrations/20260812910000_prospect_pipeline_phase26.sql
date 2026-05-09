-- Phase 26 — Prospect pipeline polish: optional capture when marking lost.

alter table public.prospects
  add column if not exists lost_reason text;

comment on column public.prospects.lost_reason is
  'Optional operator-entered reason when status is lost; surfaced on timeline via status change metadata.';

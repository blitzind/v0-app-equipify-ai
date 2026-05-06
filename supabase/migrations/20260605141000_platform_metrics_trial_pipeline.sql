-- Trial pipeline MRR (estimated if trials converted) stored separately from paid MRR.

alter table public.platform_metrics_daily
  add column if not exists trial_pipeline_mrr numeric not null default 0;

comment on column public.platform_metrics_daily.total_mrr is
  'Paid MRR only (active subscriptions), cents — excludes trialing, past_due, canceled.';

comment on column public.platform_metrics_daily.trial_pipeline_mrr is
  'Estimated monthly-equivalent MRR for active trials (cents); not part of paid total_mrr.';

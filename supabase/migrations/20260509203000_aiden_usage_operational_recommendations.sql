-- AIden Phase 5: operational recommendations usage key (Scale).

alter table public.aiden_usage_events drop constraint if exists aiden_usage_events_feature_key_check;

alter table public.aiden_usage_events add constraint aiden_usage_events_feature_key_check check (
  feature_key in (
    'support_chat',
    'feature_request',
    'customer_summary',
    'work_order_summary',
    'draft_generation',
    'operational_recommendations'
  )
);

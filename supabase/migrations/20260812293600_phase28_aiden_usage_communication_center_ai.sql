-- Phase 28 — allow communication_center_ai on aiden_usage_events (summarize / draft / tone from Communications Center).

alter table public.aiden_usage_events drop constraint if exists aiden_usage_events_feature_key_check;

alter table public.aiden_usage_events add constraint aiden_usage_events_feature_key_check check (
  feature_key in (
    'support_chat',
    'feature_request',
    'customer_summary',
    'work_order_summary',
    'draft_generation',
    'operational_recommendations',
    'operational_insight_interaction',
    'action_prepare',
    'action_confirm',
    'communication_center_ai'
  )
);

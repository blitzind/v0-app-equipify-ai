-- GS-SENDR-2E — Engagement intelligence kill switches (reuse existing event/timeline tables).

insert into growth.runtime_guardrail_settings (key, enabled, qa_marker)
values
  ('sendr_intelligence_enabled', true, 'growth-sendr-intelligence-gs-sendr-2e-v1'),
  ('sendr_recommendations_enabled', true, 'growth-sendr-intelligence-gs-sendr-2e-v1')
on conflict (key) do nothing;

-- Growth reset dry-run repair: 25 growth tables lacked service_role table grants.
--
-- PostgREST uses the service_role JWT. RLS policies alone are insufficient;
-- without GRANT SELECT the reset count phase returns HTTP 403 with an empty body.
-- GRANT DELETE is required for the confirm-path reset (not applied here).
--
-- Idempotent: GRANT is safe to re-run; skipped when the relation is absent.

do $$
declare
  t text;
begin
  foreach t in array array[
    'growth.buying_stage_assessments',
    'growth.campaign_engagement_metrics',
    'growth.campaign_launch_checks',
    'growth.company_enrichments',
    'growth.company_identification_matches',
    'growth.company_signal_runs',
    'growth.company_signals',
    'growth.contact_verifications',
    'growth.deliverability_protection_events',
    'growth.deliverability_trend_snapshots',
    'growth.delivery_event_timeline',
    'growth.domain_health_snapshots',
    'growth.enrichment_runs',
    'growth.execution_sprints',
    'growth.inbox_lifecycle_events',
    'growth.infrastructure_fit_assessments',
    'growth.mailbox_health_snapshots',
    'growth.maintenance_tasks',
    'growth.meeting_outcome_intelligence_scores',
    'growth.operational_alerts',
    'growth.operational_analytics_snapshots',
    'growth.outbound_scheduler_decisions',
    'growth.search_intent_signals',
    'growth.sequence_execution_diagnostics',
    'growth.throughput_snapshots'
  ]
  loop
    if to_regclass(t) is not null then
      execute format('grant select, delete on table %s to service_role', t);
    end if;
  end loop;
end $$;

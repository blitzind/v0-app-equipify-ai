/**
 * GS-GROWTH-OPS-7B — Growth schema table inventory, classifications, deletion order.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type {
  GrowthResetGoldenEntityKey,
  GrowthResetTableClassification,
} from "./growth-test-data-reset-constants"
import {
  GROWTH_RESET_DELETE_FK_BY_TABLE,
  GROWTH_RESET_DELETE_FK_SKIP_NOTES,
  resolveGrowthResetDeleteFkColumn,
} from "./growth-test-data-reset-fk-mapping"

export type GrowthResetTableCatalogEntry = {
  table: string
  classification: GrowthResetTableClassification
  reset_order: number | null
  dependencies: string[]
  golden_entity: GrowthResetGoldenEntityKey | null
  delete_fk_column: string | null
  notes: string | null
}

const EXPLICIT_KEEP = new Set<string>([
  "account_playbooks",
  "account_playbook_members",
  "ai_copilot_playbook_approved_rules",
  "ai_copilot_playbook_draft_rules",
  "ai_copilot_playbook_effectiveness",
  "ai_copilot_playbook_extractions",
  "ai_copilot_playbook_rule_attributions",
  "ai_copilot_playbook_rule_categories",
  "ai_copilot_playbook_rule_versions",
  "ai_copilot_playbook_sources",
  "ai_copilot_rules",
  "assignment_settings",
  "automation_edges",
  "automation_flow_versions",
  "automation_flows",
  "automation_nodes",
  "booking_pages",
  "calendar_provider_connections",
  "calendar_routing_rules",
  "channel_routing_rules",
  "communication_settings",
  "content_snippets",
  "content_snippet_versions",
  "content_templates",
  "content_template_versions",
  "content_variable_registry",
  "copilot_settings",
  "customer_lifecycle_settings",
  "delivery_providers",
  "delivery_routes",
  "delivery_suppressions",
  "email_provider_connections",
  "growth_audiences",
  "growth_audience_members",
  "growth_event_retention_config",
  "growth_landing_pages",
  "growth_landing_page_sections",
  "growth_landing_page_publications",
  "growth_media_assets",
  "growth_media_asset_versions",
  "growth_conversation_agents",
  "growth_conversation_agent_versions",
  "growth_booking_assets",
  "growth_sendr_sequence_page_links",
  "growth_video_assets",
  "governance_policies",
  "governance_policy_rules",
  "governance_retention_policies",
  "inbox_assignment_rules",
  "inbox_assignment_settings",
  "mailbox_connections",
  "mailbox_send_policies",
  "native_dialer_settings",
  "operator_assist_preferences",
  "operator_notification_preferences",
  "operator_notification_push_subscriptions",
  "operator_workspace_preferences",
  "organization_ai_teammate_identity",
  "opportunity_pipeline_settings",
  "outreach_settings",
  "provider_connection_settings",
  "provider_webhook_endpoints",
  "prospect_search_saved_searches",
  "prospect_search_lists",
  "realtime_provider_connections",
  "rep_roster",
  "revenue_forecast_settings",
  "runtime_budgets",
  "runtime_cascade_budgets",
  "runtime_guardrail_settings",
  "runtime_user_budgets",
  "runtime_wake_batch_state",
  "runtime_retention_batch_state",
  "sender_accounts",
  "sender_domains",
  "sender_pools",
  "sender_pool_members",
  "sequence_patterns",
  "sequence_pattern_steps",
  "sequence_pattern_step_conditions",
  "sequence_pattern_step_edges",
  "sequence_templates",
  "sequence_template_steps",
  "share_page_templates",
  "share_page_template_versions",
  "share_pages",
  "signal_providers",
  "signal_watchlists",
  "signal_trigger_rules",
  "sms_workspace_settings",
  "suppression_entries",
  "territories",
  "unsubscribe_registry",
  "user_communication_preferences",
  "video_pages",
  "video_templates",
  "video_assets",
  "warmup_profiles",
  "warmup_schedule",
])

const EXPLICIT_MANUAL_REVIEW = new Set<string>([
  "apollo_pilot_cohorts",
  "apollo_pilot_cohort_companies",
  "apollo_replacement_benchmark_cohorts",
  "apollo_replacement_benchmark_snapshots",
  "dogfood_issues",
  "dogfood_validation_runs",
  "governance_activity_exports",
  "governance_approval_audit",
  "governance_compliance_exports",
  "governance_policy_events",
  "human_execution_approvals",
  "human_execution_plans",
  "human_execution_plan_steps",
])

const GOLDEN_ENTITY_TABLES: Record<string, GrowthResetGoldenEntityKey> = {
  leads: "lead",
  companies: "company",
  company_contacts: "contact",
  persons: "person",
  person_emails: "person",
  person_phones: "person",
  person_profiles: "person",
  person_company_roles: "person",
  person_source_lineage: "person",
  opportunities: "opportunity",
  meetings: "meeting",
  personalization_generations: "generation",
  sequence_enrollments: "sequence_enrollment",
  inbox_threads: "inbox_thread",
  lead_call_sessions: "call_session",
  native_call_workspace_sessions: "call_session",
  lead_timeline_events: "timeline",
}

const DELETE_FK_BY_TABLE: Record<string, string> = Object.fromEntries(
  Object.entries(GROWTH_RESET_DELETE_FK_BY_TABLE).map(([table, mapping]) => [table, mapping.column]),
)

function inferDependencies(table: string): string[] {
  const deps: string[] = []
  const fk = DELETE_FK_BY_TABLE[table]
  if (fk === "lead_id") deps.push("leads")
  if (fk === "company_id") deps.push("companies")
  if (fk === "opportunity_id") deps.push("opportunities")
  if (fk === "meeting_id") deps.push("meetings")
  if (fk === "thread_id" || fk === "inbox_thread_id") deps.push("inbox_threads")
  if (fk === "enrollment_id") deps.push("sequence_enrollments")
  if (fk === "generation_id") deps.push("personalization_generations")
  if (table.includes("enrollment")) deps.push("sequence_enrollments", "leads")
  if (table.includes("personalization")) deps.push("personalization_generations", "leads")
  if (table.includes("inbox")) deps.push("inbox_threads", "leads")
  if (table.includes("meeting")) deps.push("meetings", "leads")
  if (table.includes("opportunity")) deps.push("opportunities", "leads")
  if (table.includes("company")) deps.push("companies")
  if (table.includes("lead")) deps.push("leads")
  if (table.includes("person")) deps.push("persons")
  if (table.includes("discovery") || table.includes("import")) deps.push("leads", "companies")
  if (table.includes("analytics") || table.includes("snapshot")) deps.push("leads")
  return [...new Set(deps)]
}

/** Dependency-safe deletion order (children before parents). */
export const GROWTH_RESET_DELETE_ORDER: string[] = [
  "growth_engagement_events",
  "growth_engagement_event_rollups",
  "share_page_events",
  "share_page_views",
  "video_views",
  "video_engagement_summaries",
  "video_page_events",
  "video_page_rollups",
  "media_asset_events",
  "media_asset_event_rollups",
  "growth_video_asset_events",
  "growth_booking_events",
  "growth_media_asset_access_logs",
  "email_opens",
  "email_clicks",
  "engagement_scores",
  "message_events",
  "delivery_events",
  "delivery_attempts",
  "delivery_event_timeline",
  "provider_delivery_events",
  "sms_messages",
  "sms_delivery_attempts",
  "sms_provider_events",
  "sms_conversations",
  "outbound_messages",
  "outbound_replies",
  "outreach_queue_events",
  "outreach_queue",
  "operator_notifications",
  "notifications",
  "operator_notification_push_deliveries",
  "platform_timeline_events",
  "multi_channel_activity_timeline_events",
  "conversation_timeline_events",
  "lead_timeline_events",
  "signal_events",
  "signal_watchlist_matches",
  "signal_raw_payloads",
  "signal_ingestion_queue",
  "reply_intelligence_events",
  "reply_ingestion_events",
  "reply_workflow_actions",
  "inbox_lifecycle_events",
  "inbox_messages",
  "inbox_reply_draft_events",
  "inbox_reply_drafts",
  "inbox_provider_message_map",
  "inbox_thread_links",
  "inbox_thread_owner_history",
  "inbox_sync_runs",
  "inbox_threads",
  "sequence_execution_job_events",
  "sequence_execution_jobs",
  "sequence_execution_events",
  "sequence_execution_diagnostics",
  "sequence_branch_decisions",
  "sequence_enrollment_channel_events",
  "sequence_enrollment_step_waits",
  "sequence_enrollment_steps",
  "sequence_channel_task_events",
  "sequence_channel_tasks",
  "sequence_enrollments",
  "personalization_evidence",
  "personalization_feedback",
  "personalization_risk_events",
  "personalization_performance_snapshots",
  "personalization_generations",
  "personalization_profiles",
  "native_call_wrapups",
  "native_call_workspace_sessions",
  "realtime_call_transcript_events",
  "realtime_call_session_insights",
  "realtime_call_session_timeline_events",
  "realtime_call_sessions",
  "call_copilot_sessions",
  "call_brief_effectiveness",
  "call_intelligence_scorecards",
  "lead_call_events",
  "lead_call_sessions",
  "live_guidance_events",
  "meeting_conversion_events",
  "meeting_outcome_intelligence_scores",
  "booking_attribution_events",
  "booking_intent_signals",
  "booking_recommendations",
  "booking_page_bookings",
  "meetings",
  "meeting_candidates",
  "meeting_candidate_runs",
  "cadence_tasks",
  "maintenance_tasks",
  "customer_onboarding_tasks",
  "opportunity_approval_runs",
  "opportunity_draft_runs",
  "opportunity_drafts",
  "opportunity_stage_history",
  "opportunity_signal_timeline_events",
  "opportunity_recommendations",
  "opportunity_signals",
  "opportunities",
  "lead_decision_makers",
  "lead_memory_events",
  "lead_memory_profiles",
  "lead_objection_memory",
  "lead_preference_memory",
  "lead_research_notes",
  "lead_research_runs",
  "lead_inbox",
  "company_contact_identity_reviews",
  "company_contact_refresh_queue",
  "company_contacts",
  "contact_candidates",
  "contact_verifications",
  "person_merge_events",
  "person_company_roles",
  "person_source_lineage",
  "person_profiles",
  "person_phones",
  "person_emails",
  "persons",
  "company_merge_events",
  "company_relationships",
  "company_intelligence_evidence",
  "company_intelligence_snapshots",
  "company_identification_matches",
  "company_growth_signals",
  "company_growth_signal_scores",
  "company_growth_signal_refresh_queue",
  "company_evidence_sources",
  "company_enrichments",
  "company_domains",
  "company_signals",
  "company_signal_runs",
  "company_confidence_scores",
  "company_profiles",
  "companies",
  "leads",
  "lead_import_batch_events",
  "lead_import_batch_rows",
  "lead_import_batches",
  "lead_import_mapping_profiles",
  "prospect_search_list_members",
  "prospect_search_index",
  "discovery_candidates",
  "discovery_runs",
  "discovery_sources",
  "discovery_outcome_patterns",
  "discovery_refresh_queue",
  "discovery_statistics",
  "external_company_candidates",
  "external_company_discovery_runs",
  "real_world_company_candidates",
  "real_world_discovery_runs",
  "enrichment_runs",
  "email_discovery_evidence",
  "email_discovery_candidates",
  "email_discovery_runs",
  "email_discovery_jobs",
  "phone_discovery_evidence",
  "phone_discovery_candidates",
  "phone_discovery_runs",
  "phone_discovery_jobs",
  "social_profile_discovery_evidence",
  "social_profile_discovery_candidates",
  "social_profile_discovery_runs",
  "social_profile_discovery_jobs",
  "company_intelligence_jobs",
  "company_intelligence_runs",
  "buying_committee_evidence",
  "buying_committee_intelligence_members",
  "buying_committee_members",
  "buying_committee_maps",
  "buying_committee_runs",
  "buying_committee_jobs",
  "buying_committee_signals",
  "buying_stage_assessments",
  "search_intent_signals",
  "research_runs",
  "ai_copilot_generations",
  "ai_copilot_effectiveness",
  "ai_copilot_generation_playbook_rules",
  "ai_meeting_preparations",
  "media_generation_runs",
  "growth_audience_snapshot_diffs",
  "growth_audience_member_diffs",
  "growth_audience_snapshots",
  "growth_audience_refresh_runs",
  "growth_audience_lead_creation_runs",
  "growth_audience_enrollment_preview_members",
  "growth_audience_enrollment_previews",
  "growth_audience_enrollment_runs",
  "growth_sendr_launch_runs",
  "operational_analytics_snapshots",
  "operational_alerts",
  "sales_execution_insight_snapshots",
  "relationship_summary_snapshots",
  "relationship_context",
  "committee_relationship_context",
  "campaign_engagement_metrics",
  "campaign_launch_checks",
  "campaign_reply_learning_snapshots",
  "campaign_revenue_attribution_snapshots",
  "channel_effectiveness_snapshots",
  "channel_performance_snapshots",
  "outreach_performance_attributions",
  "outbound_scheduler_decisions",
  "throughput_snapshots",
  "deliverability_trend_snapshots",
  "deliverability_ops_snapshots",
  "deliverability_recommendations",
  "deliverability_risk_events",
  "deliverability_remediation_tasks",
  "deliverability_protection_events",
  "deliverability_domain_reputation_history",
  "deliverability_events",
  "deliverability_governance_events",
  "deliverability_snapshots",
  "domain_health_snapshots",
  "mailbox_health_snapshots",
  "mailbox_reputation_snapshots",
  "mailbox_connection_events",
  "sender_health_events",
  "sender_reputation_snapshots",
  "sender_fatigue_events",
  "sender_rotation_decisions",
  "sender_performance_snapshots",
  "sender_pool_performance_snapshots",
  "provider_route_performance_snapshots",
  "sequence_performance_snapshots",
  "sequence_pattern_outcomes",
  "sequence_scheduler_runs",
  "sequence_pause_candidates",
  "sequence_experiment_events",
  "sequence_experiment_results",
  "sequence_experiment_assignments",
  "sequence_experiments",
  "sequence_experiment_variants",
  "revenue_attribution_events",
  "revenue_forecast_movements",
  "revenue_forecast_snapshots",
  "performance_intelligence_events",
  "attribution_paths",
  "attribution_touches",
  "intent_conversion_events",
  "intent_identified_contacts",
  "intent_pageview_events",
  "intent_visitor_sessions",
  "intent_pixel_sites",
  "market_coverage_scores",
  "market_health_refresh_queue",
  "territory_scores",
  "territory_companies",
  "territory_refresh_queue",
  "buying_momentum_snapshots",
  "deal_intelligence_scores",
  "crm_intelligence_events",
  "account_playbook_runs",
  "assignment_runs",
  "execution_sprints",
  "automation_validation_results",
  "apollo_enrollment_automation_runs",
  "apollo_enrollment_candidates",
  "apollo_multichannel_orchestration_runs",
  "apollo_multichannel_sequence_candidates",
  "apollo_primary_contact_enrollment_drafts",
  "apollo_primary_contact_enrollment_handoffs",
  "apollo_primary_contact_enrollment_queue",
  "apollo_primary_contact_operator_reviews",
  "apollo_sequence_execution_automation_runs",
  "apollo_sequence_execution_candidates",
  "apollo_voice_drop_automation_runs",
  "apollo_voice_drop_candidates",
  "contact_discovery_runs",
  "provider_query_cache",
  "provider_capability_history",
  "provider_rate_limits",
  "provider_connection_checks",
  "provider_oauth_states",
  "provider_secret_audit_events",
  "provider_setup_readiness",
  "provider_webhooks",
  "realtime_provider_lifecycle_events",
  "runtime_guardrail_audit_log",
  "runtime_search_audit_log",
  "runtime_health_counters",
  "cron_execution_runs",
  "calendar_sync_runs",
  "native_dialer_queue_items",
  "warmup_events",
  "email_bounces",
  "email_complaints",
  "internal_outbound_audit_events",
  "content_approval_events",
  "growth_media_asset_versions",
]

const KEEP_PREFIXES = [
  "sequence_pattern_",
  "sequence_template_",
  "ai_copilot_playbook_",
] as const

const KEEP_SUFFIXES = ["_settings", "_rules", "_preferences"] as const

function classifyTable(table: string): GrowthResetTableClassification {
  if (EXPLICIT_KEEP.has(table)) return "KEEP"
  if (EXPLICIT_MANUAL_REVIEW.has(table)) return "MANUAL_REVIEW"
  if (GOLDEN_ENTITY_TABLES[table]) return "DELETE"
  for (const prefix of KEEP_PREFIXES) {
    if (table.startsWith(prefix) && table !== "sequence_pattern_outcomes") return "KEEP"
  }
  for (const suffix of KEEP_SUFFIXES) {
    if (table.endsWith(suffix) && !table.includes("snapshot")) return "KEEP"
  }
  if (table.endsWith("_templates") && !table.includes("_template_versions")) return "KEEP"
  if (table.endsWith("_template_versions")) return "KEEP"
  return "DELETE"
}

export function extractGrowthTablesFromMigrations(cwd = process.cwd()): string[] {
  const dir = join(cwd, "supabase/migrations")
  const re = /create table if not exists growth\.([a-z0-9_]+)/gi
  const tables = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue
    const sql = readFileSync(join(dir, file), "utf8")
    let match: RegExpExecArray | null
    while ((match = re.exec(sql)) !== null) {
      tables.add(match[1]!)
    }
  }
  return [...tables].sort()
}

export function buildGrowthResetTableCatalog(cwd = process.cwd()): GrowthResetTableCatalogEntry[] {
  const tables = extractGrowthTablesFromMigrations(cwd)
  const orderIndex = new Map(GROWTH_RESET_DELETE_ORDER.map((name, idx) => [name, idx]))

  return tables.map((table) => {
    const classification = classifyTable(table)
    const golden_entity = GOLDEN_ENTITY_TABLES[table] ?? null
    const reset_order =
      classification === "DELETE"
        ? (orderIndex.get(table) ?? 900 + tables.indexOf(table))
        : null

    return {
      table,
      classification,
      reset_order,
      dependencies: inferDependencies(table),
      golden_entity,
      delete_fk_column: resolveGrowthResetDeleteFkColumn({
        table,
        classification,
        golden_entity,
      }),
      notes:
        GROWTH_RESET_DELETE_FK_SKIP_NOTES[table] ??
        (golden_entity ? "Golden fixture rows preserved by entity allowlist." : null),
    }
  })
}

export function getOrderedDeleteTables(
  catalog: GrowthResetTableCatalogEntry[],
): GrowthResetTableCatalogEntry[] {
  return catalog
    .filter((entry) => entry.classification === "DELETE")
    .sort((a, b) => (a.reset_order ?? 9999) - (b.reset_order ?? 9999))
}

export function getGrowthResetDependencyGraph(
  catalog: GrowthResetTableCatalogEntry[],
): Record<string, string[]> {
  const graph: Record<string, string[]> = {}
  for (const entry of catalog) {
    if (entry.dependencies.length > 0) {
      graph[entry.table] = entry.dependencies
    }
  }
  return graph
}

/**
 * GE-AVA-FRESH-SLATE-1A — Operational table inventory (config/infrastructure excluded).
 */

import type {
  GrowthEngineOperationalResetCategory,
  GrowthEngineOperationalResetScopeKind,
} from "./growth-engine-operational-reset-constants"

export type GrowthEngineOperationalResetTableEntry = {
  table: string
  category: GrowthEngineOperationalResetCategory
  scope: GrowthEngineOperationalResetScopeKind
  /** Override default filter column for this scope (e.g. inbox_thread_id for thread_id scope). */
  scope_column?: string
  /** Child tables first; lower numbers delete earlier. */
  delete_order: number
  notes: string | null
}

/** Configuration + infrastructure — never deleted by this reset. */
export const GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES = [
  "account_playbooks",
  "account_playbook_members",
  "assignment_settings",
  "automation_edges",
  "automation_flow_versions",
  "automation_flows",
  "automation_nodes",
  "booking_pages",
  "calendar_provider_connections",
  "communication_settings",
  "content_templates",
  "copilot_settings",
  "delivery_providers",
  "delivery_routes",
  "email_provider_connections",
  "growth_audiences",
  "growth_conversation_agents",
  "governance_policies",
  "inbox_assignment_rules",
  "inbox_assignment_settings",
  "mailbox_connections",
  "mailbox_send_policies",
  "native_dialer_settings",
  "operator_notification_preferences",
  "operator_notification_push_subscriptions",
  "operator_workspace_preferences",
  "organization_ai_teammate_identity",
  "organization_autonomy_settings",
  "organization_growth_objectives",
  "outreach_settings",
  "provider_connection_settings",
  "prospect_search_saved_searches",
  "prospect_search_lists",
  "sender_accounts",
  "sender_domains",
  "sender_pools",
  "sender_pool_members",
  "sender_profiles",
  "sequence_patterns",
  "sequence_pattern_steps",
  "sequence_templates",
  "sequence_template_steps",
  "signal_providers",
  "signal_watchlists",
  "signal_trigger_rules",
  "sms_workspace_settings",
  "suppression_entries",
  "territories",
  "unsubscribe_registry",
  "warmup_profiles",
  "warmup_schedule",
] as const

const ENTRIES: GrowthEngineOperationalResetTableEntry[] = [
  // --- AI OS / command center (children first) ---
  { table: "ai_work_order_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 10, notes: null },
  { table: "ai_decision_record_audit_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 11, notes: null },
  { table: "ai_os_event_deliveries", category: "ai_os_command_center", scope: "organization_id", delete_order: 12, notes: null },
  { table: "ai_os_event_archive_records", category: "ai_os_command_center", scope: "organization_id", delete_order: 13, notes: null },
  { table: "ai_memory_registry_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 14, notes: null },
  { table: "ai_executive_heartbeat_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 15, notes: null },
  { table: "ai_executive_event_observations", category: "ai_os_command_center", scope: "organization_id", delete_order: 16, notes: null },
  { table: "ai_os_agent_heartbeat_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 17, notes: null },
  { table: "ai_context_packages", category: "ai_os_command_center", scope: "organization_id", delete_order: 18, notes: null },
  { table: "ai_provider_requests", category: "ai_os_command_center", scope: "organization_id", delete_order: 19, notes: null },
  { table: "ai_decision_engine_requests", category: "ai_os_command_center", scope: "organization_id", delete_order: 20, notes: null },
  { table: "closed_loop_learning_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 21, notes: null },
  { table: "closed_loop_learning_insights", category: "ai_os_command_center", scope: "organization_id", delete_order: 22, notes: null },
  { table: "closed_loop_learning_outcomes", category: "ai_os_command_center", scope: "organization_id", delete_order: 23, notes: null },
  { table: "ai_work_orders", category: "ai_os_command_center", scope: "organization_id", delete_order: 30, notes: "Ava command center work orders" },
  { table: "ai_decision_records", category: "ai_os_command_center", scope: "organization_id", delete_order: 31, notes: null },
  { table: "ai_os_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 32, notes: null },
  { table: "ai_memory_registry", category: "ai_os_command_center", scope: "organization_id", delete_order: 33, notes: "Runtime memory — not copilot playbook config" },
  { table: "ai_context_assembly_runtime", category: "ai_os_command_center", scope: "organization_id", delete_order: 34, notes: null },
  { table: "ai_decision_engine_runtime", category: "ai_os_command_center", scope: "organization_id", delete_order: 35, notes: null },
  { table: "ai_executive_brain_runtime", category: "ai_os_command_center", scope: "organization_id", delete_order: 36, notes: null },
  { table: "ai_executive_mission_state", category: "ai_os_command_center", scope: "organization_id", delete_order: 37, notes: null },
  { table: "ai_executive_delegations", category: "ai_os_command_center", scope: "organization_id", delete_order: 38, notes: null },
  { table: "ai_provider_runtime", category: "ai_os_command_center", scope: "organization_id", delete_order: 39, notes: null },
  { table: "ai_os_agent_leases", category: "ai_os_command_center", scope: "organization_id", delete_order: 40, notes: null },
  { table: "autonomous_outbound_scope_actions", category: "ai_os_command_center", scope: "organization_id", delete_order: 41, notes: null },
  { table: "autonomous_outbound_scope_events", category: "ai_os_command_center", scope: "organization_id", delete_order: 42, notes: null },
  { table: "autonomous_outbound_scopes", category: "ai_os_command_center", scope: "organization_id", delete_order: 43, notes: "Pending autonomous outbound approval envelopes" },

  // --- Approvals / human execution (plan_steps cascade from plans) ---
  { table: "human_execution_approvals", category: "approvals_human_execution", scope: "organization_id", delete_order: 50, notes: "Pending approval queue" },
  { table: "human_execution_plans", category: "approvals_human_execution", scope: "organization_id", delete_order: 51, notes: null },

  // --- Outreach / sequence runtime (child event tables cascade from parents) ---
  { table: "sequence_execution_diagnostics", category: "outreach_sequence_runtime", scope: "job_id", delete_order: 60, notes: "Blocked job diagnostics" },
  { table: "sequence_execution_jobs", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 61, notes: "Blocked / pending approval jobs — Home Ava status" },
  { table: "outreach_queue", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 62, notes: "Outreach drafts awaiting approval" },
  { table: "sequence_channel_task_events", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 63, notes: null },
  { table: "sequence_channel_tasks", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 64, notes: null },
  { table: "sequence_enrollment_channel_events", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 65, notes: null },
  { table: "sequence_enrollment_step_waits", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 66, notes: null },
  { table: "sequence_enrollment_steps", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 67, notes: null },
  { table: "personalization_performance_snapshots", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 68, notes: null },
  { table: "personalization_generations", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 69, notes: "Draft personalization runs" },
  { table: "sequence_enrollments", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 70, notes: "Active sequence runtime enrollments" },
  { table: "inbox_reply_drafts", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 71, notes: "Reply drafts awaiting approval" },
  { table: "ai_copilot_generations", category: "outreach_sequence_runtime", scope: "lead_id", delete_order: 79, notes: "AI draft generations tied to leads" },

  // --- Lead research ---
  { table: "lead_research_notes", category: "lead_research", scope: "lead_id", delete_order: 90, notes: null },
  { table: "lead_research_runs", category: "lead_research", scope: "lead_id", delete_order: 91, notes: "Lead research execution runs" },

  // --- Notifications ---
  { table: "operator_notification_push_deliveries", category: "notifications", scope: "organization_id", delete_order: 100, notes: null },
  { table: "operator_notifications", category: "notifications", scope: "organization_id", delete_order: 101, notes: "Operator notification noise from test runs" },
  { table: "notifications", category: "notifications", scope: "org_id", delete_order: 102, notes: null },

  // --- Dashboard counters / read models ---
  { table: "growth_engagement_event_rollups", category: "dashboard_counters", scope: "organization_id", delete_order: 110, notes: null },
  { table: "video_page_rollups", category: "dashboard_counters", scope: "organization_id", delete_order: 111, notes: null },
  { table: "runtime_health_counters", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 112, notes: "Home dashboard health counters" },
  { table: "operational_analytics_snapshots", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 113, notes: null },
  { table: "operational_alerts", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 114, notes: null },
  { table: "throughput_snapshots", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 115, notes: null },
  { table: "sales_execution_insight_snapshots", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 116, notes: null },
  { table: "execution_sprints", category: "dashboard_counters", scope: "organization_id", delete_order: 117, notes: null },
  { table: "maintenance_tasks", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 118, notes: "Operational maintenance recommendations" },
  { table: "cron_execution_runs", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 119, notes: null },
  { table: "campaign_engagement_metrics", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 120, notes: null },
  { table: "campaign_launch_checks", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 121, notes: null },
  { table: "outbound_scheduler_decisions", category: "dashboard_counters", scope: "workspace_disposable", delete_order: 122, notes: null },

  // --- Inbox intelligence summaries (not mailbox threads) ---
  { table: "relationship_summary_snapshots", category: "inbox_intelligence", scope: "lead_id", delete_order: 130, notes: "Generated relationship summaries" },
  { table: "relationship_context", category: "inbox_intelligence", scope: "lead_id", delete_order: 131, notes: null },
  { table: "committee_relationship_context", category: "inbox_intelligence", scope: "lead_id", delete_order: 132, notes: null },

  // --- Automation / AI job runs ---
  { table: "automation_validation_results", category: "automation_runs", scope: "organization_id", delete_order: 140, notes: null },
  { table: "media_generation_runs", category: "automation_runs", scope: "organization_id", delete_order: 141, notes: "AI media generation jobs" },
  { table: "enrichment_runs", category: "automation_runs", scope: "workspace_disposable", delete_order: 142, notes: null },
  { table: "research_runs", category: "automation_runs", scope: "organization_id", delete_order: 143, notes: null },
  { table: "growth_audience_refresh_runs", category: "automation_runs", scope: "organization_id", delete_order: 144, notes: null },
  { table: "growth_audience_enrollment_runs", category: "automation_runs", scope: "organization_id", delete_order: 145, notes: null },
  { table: "growth_audience_lead_creation_runs", category: "automation_runs", scope: "organization_id", delete_order: 146, notes: null },
  { table: "growth_audience_enrollment_previews", category: "automation_runs", scope: "organization_id", delete_order: 147, notes: null },
  { table: "growth_audience_enrollment_preview_members", category: "automation_runs", scope: "organization_id", delete_order: 148, notes: null },
  { table: "growth_audience_snapshots", category: "automation_runs", scope: "organization_id", delete_order: 149, notes: "Runtime snapshot materializations — audience definitions preserved" },
  { table: "growth_audience_snapshot_diffs", category: "automation_runs", scope: "organization_id", delete_order: 150, notes: null },
  { table: "growth_audience_member_diffs", category: "automation_runs", scope: "organization_id", delete_order: 151, notes: null },
  { table: "growth_audience_members", category: "automation_runs", scope: "organization_id", delete_order: 152, notes: "Runtime audience membership rows — not audience definitions" },
  { table: "growth_sendr_launch_runs", category: "automation_runs", scope: "organization_id", delete_order: 153, notes: null },
  { table: "apollo_enrollment_automation_runs", category: "automation_runs", scope: "workspace_disposable", delete_order: 154, notes: null },
  { table: "apollo_enrollment_candidates", category: "automation_runs", scope: "lead_id", scope_column: "growth_lead_id", delete_order: 155, notes: null },
  { table: "apollo_multichannel_orchestration_runs", category: "automation_runs", scope: "workspace_disposable", delete_order: 156, notes: null },
  { table: "apollo_multichannel_sequence_candidates", category: "automation_runs", scope: "lead_id", scope_column: "growth_lead_id", delete_order: 157, notes: null },
  { table: "apollo_primary_contact_enrollment_drafts", category: "automation_runs", scope: "lead_id", scope_column: "growth_lead_id", delete_order: 158, notes: null },
  { table: "apollo_primary_contact_enrollment_handoffs", category: "automation_runs", scope: "workspace_disposable", delete_order: 159, notes: null },
  { table: "apollo_primary_contact_enrollment_queue", category: "automation_runs", scope: "workspace_disposable", delete_order: 160, notes: null },
  { table: "apollo_primary_contact_operator_reviews", category: "automation_runs", scope: "workspace_disposable", delete_order: 161, notes: null },
  { table: "apollo_sequence_execution_automation_runs", category: "automation_runs", scope: "workspace_disposable", delete_order: 162, notes: null },
  { table: "apollo_sequence_execution_candidates", category: "automation_runs", scope: "lead_id", scope_column: "growth_lead_id", delete_order: 163, notes: null },
  { table: "apollo_voice_drop_automation_runs", category: "automation_runs", scope: "workspace_disposable", delete_order: 164, notes: null },
  { table: "apollo_voice_drop_candidates", category: "automation_runs", scope: "lead_id", scope_column: "growth_lead_id", delete_order: 165, notes: null },

  // --- Deliverability operational snapshots (not DNS/domain config) ---
  { table: "deliverability_protection_events", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 170, notes: null },
  { table: "deliverability_trend_snapshots", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 171, notes: null },
  { table: "domain_health_snapshots", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 172, notes: "Health snapshots — sender_domains preserved" },
  { table: "mailbox_health_snapshots", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 173, notes: "Health snapshots — mailbox_connections preserved" },
  { table: "mailbox_reputation_snapshots", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 174, notes: null },
  { table: "sender_reputation_snapshots", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 175, notes: null },
  { table: "sender_performance_snapshots", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 176, notes: null },
  { table: "warmup_events", category: "deliverability_ops_snapshots", scope: "workspace_disposable", delete_order: 177, notes: "Warmup send history — warmup_profiles/schedule preserved" },

  // --- GE-AVA-FRESH-SLATE-1B: Home inbox / conversation runtime ---
  { table: "reply_workflow_actions", category: "home_inbox_conversations", scope: "lead_id", delete_order: 180, notes: null },
  { table: "reply_intelligence_events", category: "home_inbox_conversations", scope: "thread_id", delete_order: 181, notes: null },
  { table: "reply_ingestion_events", category: "home_inbox_conversations", scope: "lead_id", delete_order: 182, notes: null },
  { table: "outbound_replies", category: "home_inbox_conversations", scope: "lead_id", delete_order: 183, notes: "Home replies waiting metric" },
  { table: "email_opens", category: "home_inbox_conversations", scope: "lead_id", delete_order: 184, notes: null },
  { table: "email_clicks", category: "home_inbox_conversations", scope: "lead_id", delete_order: 185, notes: null },
  { table: "delivery_events", category: "home_inbox_conversations", scope: "workspace_disposable", delete_order: 186, notes: null },
  { table: "delivery_attempts", category: "home_inbox_conversations", scope: "lead_id", delete_order: 187, notes: null },
  { table: "outbound_messages", category: "home_inbox_conversations", scope: "lead_id", delete_order: 188, notes: null },
  { table: "inbox_provider_message_map", category: "home_inbox_conversations", scope: "thread_id", scope_column: "inbox_thread_id", delete_order: 189, notes: null },
  { table: "inbox_messages", category: "home_inbox_conversations", scope: "thread_id", delete_order: 190, notes: null },
  { table: "inbox_thread_links", category: "home_inbox_conversations", scope: "lead_id", delete_order: 191, notes: null },
  { table: "inbox_thread_owner_history", category: "home_inbox_conversations", scope: "thread_id", scope_column: "inbox_thread_id", delete_order: 192, notes: null },
  { table: "inbox_lifecycle_events", category: "home_inbox_conversations", scope: "workspace_disposable", delete_order: 193, notes: null },
  { table: "inbox_sync_runs", category: "home_inbox_conversations", scope: "workspace_disposable", delete_order: 194, notes: null },
  { table: "inbox_threads", category: "home_inbox_conversations", scope: "lead_id", delete_order: 195, notes: "Inbox reply counts + positive interest" },

  // --- Home pipeline / meetings / cadence ---
  { table: "opportunity_stage_history", category: "home_pipeline_meetings", scope: "opportunity_id", delete_order: 200, notes: null },
  { table: "opportunity_signals", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 201, notes: null },
  { table: "opportunity_recommendations", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 202, notes: null },
  { table: "opportunity_draft_runs", category: "home_pipeline_meetings", scope: "workspace_disposable", delete_order: 203, notes: null },
  { table: "opportunity_approval_runs", category: "home_pipeline_meetings", scope: "opportunity_id", delete_order: 204, notes: null },
  { table: "opportunity_drafts", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 205, notes: "Aiden opportunities_pending" },
  { table: "opportunities", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 206, notes: "Home opportunities created metric" },
  { table: "meeting_candidate_runs", category: "home_pipeline_meetings", scope: "workspace_disposable", delete_order: 207, notes: null },
  { table: "meeting_candidates", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 208, notes: null },
  { table: "booking_page_bookings", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 209, notes: null },
  { table: "meetings", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 210, notes: "Meetings today / this week in briefing" },
  { table: "cadence_tasks", category: "home_pipeline_meetings", scope: "lead_id", delete_order: 211, notes: "Call-ready leads metric" },

  // --- Home entity runtime (lead inbox + lead graph — clears daily work queue inputs) ---
  { table: "lead_timeline_events", category: "home_entity_runtime", scope: "lead_id", delete_order: 220, notes: "Activity timeline noise" },
  { table: "platform_timeline_events", category: "home_entity_runtime", scope: "workspace_disposable", delete_order: 221, notes: null },
  { table: "lead_memory_events", category: "home_entity_runtime", scope: "lead_id", delete_order: 222, notes: null },
  { table: "lead_memory_profiles", category: "home_entity_runtime", scope: "lead_id", delete_order: 223, notes: "IRE / daily queue inputs" },
  { table: "lead_decision_makers", category: "home_entity_runtime", scope: "lead_id", delete_order: 224, notes: null },
  { table: "engagement_scores", category: "home_entity_runtime", scope: "lead_id", delete_order: 225, notes: "Hot companies / engagement score" },
  { table: "buying_momentum_snapshots", category: "home_entity_runtime", scope: "lead_id", delete_order: 226, notes: null },
  { table: "deal_intelligence_scores", category: "home_entity_runtime", scope: "organization_id", delete_order: 227, notes: null },
  { table: "personalization_profiles", category: "home_entity_runtime", scope: "lead_id", delete_order: 228, notes: null },
  { table: "company_enrichments", category: "home_entity_runtime", scope: "workspace_disposable", delete_order: 229, notes: "IRE / daily queue enrichment inputs" },
  { table: "growth_engagement_events", category: "home_entity_runtime", scope: "organization_id", delete_order: 230, notes: "Hot companies engagement feed" },
  { table: "signal_events", category: "home_entity_runtime", scope: "organization_id", delete_order: 231, notes: "Buying signal feed for Home intelligence" },
  { table: "apollo_pilot_cohort_companies", category: "home_entity_runtime", scope: "workspace_disposable", delete_order: 232, notes: "Apollo pilot revenue snapshot — cohort defs preserved" },
  { table: "lead_inbox", category: "home_entity_runtime", scope: "lead_inbox_queue", delete_order: 233, notes: "Legacy table (deprecated) — canonical Revenue Queue uses growth.leads; safe to drop after GE-LEADS-CANONICAL-4E+ schema cutover" },
  { table: "leads", category: "home_entity_runtime", scope: "lead_pk", delete_order: 234, notes: "Clears daily work queue lead candidates (single-tenant Growth workspace)" },
]

export function getGrowthEngineOperationalResetTableEntries(): GrowthEngineOperationalResetTableEntry[] {
  return [...ENTRIES].sort((a, b) => a.delete_order - b.delete_order)
}

export function assertOperationalResetInventorySafe(): void {
  const deleteTables = new Set(ENTRIES.map((entry) => entry.table))
  for (const preserved of GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES) {
    if (deleteTables.has(preserved)) {
      throw new Error(`Operational reset inventory must not delete preserved table: ${preserved}`)
    }
  }
}

assertOperationalResetInventorySafe()

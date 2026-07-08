/**
 * GE-AVA-FRESH-SLATE-1B — Maps /growth Home UI metrics to upstream API + database sources.
 */

export type GrowthHomeStaleDataSourceKind =
  | "database_table"
  | "computed_read_model"
  | "api_aggregate"

export type GrowthHomeStaleDataSource = {
  /** Stable id for diagnostics. */
  id: string
  /** Home UI label shown to operators. */
  ui_label: string
  /** React section / synthesizer that renders the value. */
  ui_component: string
  /** Client fetch batch entry (use-growth-workspace-dashboard). */
  api_route: string | null
  /** Server loader / repository. */
  service: string
  kind: GrowthHomeStaleDataSourceKind
  /** Primary growth schema tables (empty when purely computed). */
  tables: string[]
  notes: string | null
}

/** Every stale Home metric called out in GE-AVA-FRESH-SLATE-1B. */
export const GROWTH_HOME_STALE_DATA_SOURCES: GrowthHomeStaleDataSource[] = [
  {
    id: "ava_status_waiting_for_approval",
    ui_label: "Ava status: Waiting for approval",
    ui_component: "GrowthHomeExecutiveBriefingDashboard → deriveEmployeeStatus",
    api_route: "/api/platform/growth/aiden/briefing",
    service: "lib/growth/aiden/aiden-briefing-repository.ts → fetchAidenDailyBriefing",
    kind: "api_aggregate",
    tables: ["sequence_execution_jobs", "outreach_queue", "human_execution_approvals"],
    notes: "pending_approvals = pending_drafts + pending_jobs from sequence_execution_jobs",
  },
  {
    id: "qualified_prospects_ready",
    ui_label: "Qualified prospects ready",
    ui_component: "GrowthHomeExecutiveBriefingHeroSection → buildExecutiveBriefingHero",
    api_route: "/api/platform/growth/lead-inbox + /api/platform/growth/cadence/command-summary",
    service: "growth-workspace-dashboard-mapper.ts (my-queue metrics)",
    kind: "api_aggregate",
    tables: ["leads", "cadence_tasks"],
    notes: "Call-ready leads + Leads needing action from canonical Revenue Queue (growth.leads) and cadence",
  },
  {
    id: "replies_waiting",
    ui_label: "Replies waiting",
    ui_component: "buildExecutiveBriefingHero",
    api_route: "/api/platform/growth/aiden/briefing",
    service: "aiden-briefing-repository.ts + growth-workspace-dashboard-mapper",
    kind: "api_aggregate",
    tables: ["inbox_threads", "outbound_replies", "inbox_messages"],
    notes: "briefing.summary.replies_needing_attention + inbox requiring replies metric",
  },
  {
    id: "opportunities_created",
    ui_label: "Opportunities created",
    ui_component: "buildExecutiveBriefingHero + buildThroughputMetrics",
    api_route: "/api/platform/growth/opportunities/pipeline + /api/platform/growth/aiden/briefing",
    service: "opportunity-pipeline + loadPilotRevenueSnapshot (apollo cohort analytics)",
    kind: "api_aggregate",
    tables: ["opportunities", "apollo_pilot_cohort_companies"],
    notes: "Max of briefing.revenue.opportunities and open pipeline count",
  },
  {
    id: "confidence_level",
    ui_label: "Confidence level",
    ui_component: "buildExecutiveBriefingHero → overallConfidence",
    api_route: null,
    service: "growth-home-ai-os-ux-synthesizer.ts (computed from briefing + engagement score)",
    kind: "computed_read_model",
    tables: ["sequence_execution_jobs", "inbox_threads", "leads"],
    notes: "Derived from pending_approvals, mailbox warnings, engagement score — not a stored counter",
  },
  {
    id: "biggest_opportunity",
    ui_label: "Biggest opportunity (e.g. positive replies)",
    ui_component: "buildExecutiveBriefingHero",
    api_route: "/api/platform/growth/aiden/briefing + /api/platform/growth/daily-revenue-work-queue",
    service: "growth-home-executive-briefing-synthesizer.ts → buildBiggestWin",
    kind: "computed_read_model",
    tables: ["inbox_threads", "outbound_replies"],
    notes: "Uses executiveBrief.biggestWin or top canonical queue action",
  },
  {
    id: "biggest_risk_blocked_jobs",
    ui_label: "Biggest risk: blocked jobs",
    ui_component: "buildExecutiveBriefingHero",
    api_route: "/api/platform/growth/daily-revenue-work-queue",
    service: "daily-revenue-work-queue-engine.ts (blocked bucket) + aiden briefing blocked_jobs",
    kind: "computed_read_model",
    tables: ["sequence_execution_jobs", "leads"],
    notes: "display.blocked_count from daily queue OR briefing.approval_queue.blocked_jobs",
  },
  {
    id: "expected_outcome_mailbox_warnings",
    ui_label: "Expected outcome today: Review mailbox warnings",
    ui_component: "buildExecutiveBriefingHero → expectedOutcomeToday",
    api_route: "/api/platform/growth/aiden/briefing",
    service: "aiden-briefing-repository.ts → fetchMailboxHealthDashboard",
    kind: "api_aggregate",
    tables: ["mailbox_connections"],
    notes: "Mailbox connection status is PRESERVED config — narrative comes from live health scan, not stale counters",
  },
  {
    id: "waiting_on_you_ready_to_activate",
    ui_label: "Waiting On You: Ready to activate",
    ui_component: "GrowthHomeAiOsWaitingOnYouSection → buildApprovalSummary",
    api_route: "/api/platform/growth/aiden/briefing + /api/platform/growth/sequences/execution/dashboard",
    service: "growth-home-executive-briefing-synthesizer.ts → buildApprovalSummary",
    kind: "api_aggregate",
    tables: ["sequence_execution_jobs"],
    notes: "pending_jobs = jobs with status pending_approval",
  },
  {
    id: "waiting_on_you_blocked",
    ui_label: "Waiting On You: Blocked",
    ui_component: "mapCanonicalQueueToWaitingOnYou + buildApprovalSummary",
    api_route: "/api/platform/growth/daily-revenue-work-queue",
    service: "daily-revenue-work-queue-view.ts blocked_count + briefing blocked_jobs",
    kind: "computed_read_model",
    tables: ["sequence_execution_jobs", "leads"],
    notes: "Canonical queue blocked bucket when daily work queue enabled",
  },
  {
    id: "daily_work_queue_blocked_waiting",
    ui_label: "Daily work queue blocked / waiting buckets",
    ui_component: "GrowthHomeDailyWorkQueueSection",
    api_route: "/api/platform/growth/daily-revenue-work-queue",
    service: "daily-revenue-work-queue-resolver.ts → listGrowthLeads + IRE bundle",
    kind: "computed_read_model",
    tables: ["leads", "lead_memory_profiles", "company_enrichments", "personalization_profiles"],
    notes: "Computed at request time from lead qualification + communication strategy — not cached",
  },
  {
    id: "hot_companies_engagement",
    ui_label: "Hot companies / engagement score",
    ui_component: "growth-workspace-dashboard-mapper intelligence section",
    api_route: "/api/platform/growth/engagement-dashboard/command-center",
    service: "engagement command center high-intent cards",
    kind: "api_aggregate",
    tables: ["engagement_scores", "growth_engagement_events", "signal_events"],
    notes: "Drives researching / watching Ava live status items",
  },
]

export function listGrowthHomeStaleDataSourceTables(): string[] {
  return [...new Set(GROWTH_HOME_STALE_DATA_SOURCES.flatMap((source) => source.tables))].sort()
}

/**
 * GE-AVA-FRESH-SLATE-1C — Server-side /growth Home runtime source diagnostics.
 */
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAidenDailyBriefing } from "@/lib/growth/aiden/aiden-briefing-repository"
import { fetchDailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  GROWTH_HOME_DEBUG_SOURCE_API_PATH,
  GROWTH_HOME_NO_STORE_CACHE_CONTROL,
  GROWTH_HOME_WORKSPACE_API_ROUTES,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
} from "@/lib/growth/home/growth-home-workspace-api-contract"
import { resolveGrowthHomeSupabaseRuntimeEnv } from "@/lib/growth/home/growth-home-supabase-runtime-env"
import { loadRevenueQueueDashboardPayload } from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import { fetchGrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-dashboard-repository"
import { listGrowthHomeStaleDataSourceTables } from "@/lib/growth/reset/growth-home-stale-data-source-map"
import {
  buildGrowthWorkspaceDashboardViewModel,
  type GrowthWorkspaceDashboardSourcePayload,
} from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"

import { GROWTH_HOME_DEBUG_SOURCE_QA_MARKER } from "@/lib/growth/reset/growth-engine-operational-reset-constants"

export { GROWTH_HOME_DEBUG_SOURCE_QA_MARKER }

type TableCountRow = {
  table: string
  count: number | null
  error: string | null
}

type SampleRow = Record<string, unknown>

async function countTable(admin: SupabaseClient, table: string): Promise<TableCountRow> {
  const { count, error } = await admin.schema("growth").from(table).select("id", { count: "exact", head: true })
  return {
    table,
    count: error ? null : (count ?? 0),
    error: error?.message ?? null,
  }
}

function summarizeBriefingPayload(briefing: Awaited<ReturnType<typeof fetchAidenDailyBriefing>> | null) {
  if (!briefing) return null
  const mailbox = (briefing as { mailbox?: { qa_marker?: string } }).mailbox
  return {
    qa_marker: briefing.qa_marker,
    summary: briefing.summary,
    approval_queue: briefing.approval_queue,
    revenue: briefing.revenue,
    inbox: {
      new_replies: briefing.inbox.new_replies,
      threads_open: briefing.inbox.threads_open,
    },
    mailbox_health_qa_marker: mailbox?.qa_marker ?? null,
  }
}

function summarizeRevenueQueuePayload(
  sections: Awaited<ReturnType<typeof loadRevenueQueueDashboardPayload>>["sections"],
  total: number,
) {
  return {
    total,
    queue_source: "canonical" as const,
    section_counts: sections.map((section) => ({
      id: section.id,
      count: section.items.length,
    })),
  }
}

function summarizeDailyQueuePayload(result: Awaited<ReturnType<typeof fetchDailyRevenueWorkQueue>>) {
  return {
    enabled: result.enabled,
    display: result.display
      ? {
          actionable_count: result.display.actionable_count,
          blocked_count: result.display.blocked_count,
          waiting_count: result.display.waiting_count,
          bucket_counts: result.display.bucket_counts,
        }
      : null,
    queue_bucket_sizes: result.queue
      ? {
          blocked: result.queue.blocked?.length ?? 0,
          waiting: result.queue.waiting?.length ?? 0,
          critical: result.queue.critical?.length ?? 0,
          high: result.queue.high?.length ?? 0,
        }
      : null,
  }
}

function summarizePipelinePayload(
  dashboard: Awaited<ReturnType<typeof fetchGrowthOpportunityPipelineDashboard>> | null,
) {
  if (!dashboard) return null
  return {
    weightedPipeline: dashboard.weightedPipeline,
    dealsNeedingAction: dashboard.dealsNeedingAction,
    pipelineByStage: dashboard.pipelineByStage.map((stage) => ({
      stageKey: stage.stageKey,
      count: stage.count,
    })),
    forecastTotals: dashboard.forecastTotals,
  }
}

function metricFromDashboard(
  dashboard: ReturnType<typeof buildGrowthWorkspaceDashboardViewModel>,
  sectionId: string,
  label: string,
): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function detectFallbackFlags(input: {
  briefing: Awaited<ReturnType<typeof fetchAidenDailyBriefing>> | null
  sources: GrowthWorkspaceDashboardSourcePayload
}): string[] {
  const flags: string[] = []
  const mailbox = (input.briefing as { mailbox?: { qa_marker?: string } } | null)?.mailbox
  if (mailbox?.qa_marker === "fallback") {
    flags.push("aiden_mailbox_health_fallback")
  }
  if (!input.sources.briefing) flags.push("aiden_briefing_unavailable")
  if (input.sources.dailyRevenueWorkQueueEnabled && !input.sources.dailyRevenueWorkQueue) {
    flags.push("daily_queue_enabled_but_null")
  }
  return flags
}

async function sampleStaleMetricRows(admin: SupabaseClient): Promise<Record<string, SampleRow[]>> {
  const [
    pendingApprovalJobs,
    blockedJobs,
    revenueQueueLeadRows,
    openThreads,
    unansweredReplies,
    opportunities,
    openCadenceTasks,
  ] = await Promise.all([
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, lead_id, organization_id, last_error, updated_at")
      .eq("status", "pending_approval")
      .limit(20),
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, lead_id, organization_id, last_error, updated_at")
      .eq("status", "blocked")
      .limit(20),
    admin
      .schema("growth")
      .from("leads")
      .select("id, status, score, updated_at")
      .is("archived_at", null)
      .limit(20),
    admin
      .schema("growth")
      .from("inbox_threads")
      .select("id, thread_status, lead_id, classification, updated_at")
      .in("thread_status", ["open", "needs_review"])
      .limit(20),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id, lead_id, thread_id, unanswered, received_at")
      .eq("unanswered", true)
      .limit(20),
    admin.schema("growth").from("opportunities").select("id, lead_id, stage_key, title, updated_at").limit(20),
    admin
      .schema("growth")
      .from("cadence_tasks")
      .select("id, lead_id, status, due_at")
      .eq("status", "open")
      .limit(20),
  ])

  return {
    ready_to_activate_pending_approval_jobs: pendingApprovalJobs.data ?? [],
    blocked_sequence_execution_jobs: blockedJobs.data ?? [],
    revenue_queue_leads: revenueQueueLeadRows.data ?? [],
    inbox_threads_open: openThreads.data ?? [],
    outbound_replies_unanswered: unansweredReplies.data ?? [],
    opportunities: opportunities.data ?? [],
    cadence_tasks_open: openCadenceTasks.data ?? [],
  }
}

export async function buildGrowthHomeDebugSourceReport(input: {
  admin: SupabaseClient
  operatorEmail: string
  actorUserId: string
}): Promise<Record<string, unknown>> {
  const generatedAt = new Date().toISOString()
  const runtime = resolveGrowthHomeSupabaseRuntimeEnv()
  const organizationId = getGrowthEngineAiOrgId()

  const homeTables = listGrowthHomeStaleDataSourceTables()
  const tableCounts = await Promise.all(homeTables.map((table) => countTable(input.admin, table)))

  const [briefing, revenueQueue, dailyQueue, pipelineDashboard] = await Promise.all([
    fetchAidenDailyBriefing(input.admin, {
      operatorEmail: input.operatorEmail,
      actorUserId: input.actorUserId,
    }).catch(() => null),
    loadRevenueQueueDashboardPayload(input.admin, { sort: "priority", limit: 100 }).catch(() => ({
      sections: [],
      total: 0,
      queue_source: "canonical" as const,
    })),
    fetchDailyRevenueWorkQueue(input.admin, { limit: 100 }).catch(() => ({
      enabled: false,
      queue: null,
      display: null,
    })),
    fetchGrowthOpportunityPipelineDashboard(input.admin, input.actorUserId).catch(() => null),
  ])

  const leadInboxSections = revenueQueue.sections

  const sources: GrowthWorkspaceDashboardSourcePayload = {
    briefing,
    leadInboxSections,
    cadenceSummary: null,
    pipelineDashboard,
    opportunityReadiness: null,
    sequenceFoundation: null,
    sequenceExecution: null,
    engagementWorkspace: null,
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
    dailyRevenueWorkQueueEnabled: dailyQueue.enabled,
    dailyRevenueWorkQueue: dailyQueue.queue,
    dailyRevenueWorkQueueDisplay: dailyQueue.display,
  }

  const dashboard = buildGrowthWorkspaceDashboardViewModel(sources)

  const qualifiedProspects =
    metricFromDashboard(dashboard, "my-queue", "Call-ready leads") +
    metricFromDashboard(dashboard, "my-queue", "Leads needing action")
  const repliesWaiting =
    metricFromDashboard(dashboard, "my-queue", "Inbox requiring replies") +
    (briefing?.summary.replies_needing_attention ?? 0)
  const opportunitiesCreated = Math.max(
    briefing?.revenue.opportunities ?? 0,
    metricFromDashboard(dashboard, "pipeline-snapshot", "Open opportunities"),
  )
  const blockedJobs = (dailyQueue.display?.blocked_count ?? 0) + (briefing?.summary.blocked_jobs ?? 0)
  const readyToActivate = briefing?.approval_queue.pending_jobs ?? 0

  const opportunitiesTableCount =
    tableCounts.find((row) => row.table === "opportunities")?.count ?? null
  const apolloCohortTableCount =
    tableCounts.find((row) => row.table === "apollo_pilot_cohort_companies")?.count ?? null
  const revenueFromApolloPilot =
    (briefing?.revenue.opportunities ?? 0) > 0 &&
    (opportunitiesTableCount ?? 0) === 0 &&
    (apolloCohortTableCount ?? 0) > 0

  const fallbackFlags = detectFallbackFlags({ briefing, sources })
  if (revenueFromApolloPilot) {
    fallbackFlags.push("opportunities_from_apollo_pilot_analytics_not_opportunities_table")
  }
  const totalDbRows = tableCounts.reduce((sum, row) => sum + (row.count ?? 0), 0)
  const uiHasNonZeroHomeMetrics =
    qualifiedProspects > 0 ||
    repliesWaiting > 0 ||
    opportunitiesCreated > 0 ||
    blockedJobs > 0 ||
    readyToActivate > 0

  const integrityMismatch = totalDbRows === 0 && uiHasNonZeroHomeMetrics

  const sampleRows =
    uiHasNonZeroHomeMetrics || totalDbRows > 0 ? await sampleStaleMetricRows(input.admin) : {}

  const apiSources = GROWTH_HOME_WORKSPACE_API_ROUTES.map((route) => ({
    id: route.id,
    path: route.path,
    label: route.label,
    cache_control_expected: GROWTH_HOME_NO_STORE_CACHE_CONTROL,
  }))

  return {
    ok: true,
    qa_marker: GROWTH_HOME_DEBUG_SOURCE_QA_MARKER,
    generated_at: generatedAt,
    debug_endpoint: GROWTH_HOME_DEBUG_SOURCE_API_PATH,
    fetch_batch_marker: GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
    runtime,
    organization_id: organizationId,
    deployment: {
      git_sha: runtime.git_sha,
      vercel_deployment_id: runtime.vercel_deployment_id,
      vercel_env: runtime.vercel_env,
      vercel_url: runtime.vercel_url,
    },
    workspace_api_routes: apiSources,
    table_counts: tableCounts,
    table_count_total: totalDbRows,
    api_payloads: {
      aiden_briefing: summarizeBriefingPayload(briefing),
      revenue_queue: summarizeRevenueQueuePayload(revenueQueue.sections, revenueQueue.total),
      daily_revenue_work_queue: summarizeDailyQueuePayload(dailyQueue),
      opportunities_pipeline: summarizePipelinePayload(pipelineDashboard),
    },
    home_ui_metrics: {
      qualified_prospects_ready: qualifiedProspects,
      replies_waiting: repliesWaiting,
      opportunities_created: opportunitiesCreated,
      blocked_jobs: blockedJobs,
      ready_to_activate: readyToActivate,
    },
    revenue_attribution: {
      opportunities_table_count: opportunitiesTableCount,
      apollo_pilot_cohort_companies_count: apolloCohortTableCount,
      briefing_revenue_opportunities: briefing?.revenue.opportunities ?? 0,
      from_apollo_pilot_analytics: revenueFromApolloPilot,
    },
    fallback_flags: fallbackFlags,
    data_source: {
      live_db: totalDbRows > 0 && fallbackFlags.length === 0,
      uses_fallback: fallbackFlags.length > 0,
      integrity_mismatch: integrityMismatch,
      note: integrityMismatch
        ? "All Home source tables report zero rows but UI metrics are non-zero — likely wrong Supabase project or cached client state."
        : totalDbRows === 0
          ? "Home source tables are empty; UI should show zeros unless fallbacks are active."
          : "Home metrics are backed by live database rows.",
    },
    cache_headers: {
      debug_source: GROWTH_HOME_NO_STORE_CACHE_CONTROL,
      workspace_apis: GROWTH_HOME_NO_STORE_CACHE_CONTROL,
    },
    stale_metric_row_samples: sampleRows,
  }
}

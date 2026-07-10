/**
 * GE-AIOS-HOTFIX-LIVE-1A — Profile Home workspace-summary pipeline timing (read-only).
 *
 *   pnpm profile:ge-aios-hotfix-live-1a-home-pipeline
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { fetchGrowthHomeLeadPoolPage } from "@/lib/growth/lead-repository"
import { GROWTH_HOME_LEAD_POOL_BATCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { fetchDailyRevenueWorkQueueFromLeads } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import { isGrowthCadenceSchemaReady } from "@/lib/growth/cadence/cadence-schema-health"
import { probeGrowthNativeDialerSchemaHealth } from "@/lib/growth/native-dialer/native-dialer-schema-health"
import { fetchGrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-dashboard-repository"
import { fetchGrowthOpportunityDashboard } from "@/lib/growth/opportunity-dashboard-repository"
import { fetchSequenceExecutionFoundationDashboard } from "@/lib/growth/sequences/sequence-repository"
import { fetchGrowthSequenceSafeExecutionDashboard } from "@/lib/growth/sequences/execution/sequence-execution-dashboard"
import {
  getGrowthEngagementCommandCenterHighIntent,
  parseEngagementCommandCenterFilters,
} from "@/lib/growth/engagement/growth-engagement-command-center-service"
import { fetchGrowthConversationDashboard } from "@/lib/growth/conversation-dashboard-repository"
import { fetchGrowthRelationshipDashboard } from "@/lib/growth/relationship-dashboard-repository"
import { fetchGrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-dashboard-repository"
import { fetchGrowthNativeCallWorkspaceDashboard } from "@/lib/growth/native-dialer/native-dialer-service"
import { fetchLatestAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { buildGrowthHomeSalesOutcomes } from "@/lib/growth/home/growth-home-sales-outcomes-loader"
import { buildGrowthHomeOrganizationMemory } from "@/lib/growth/memory/storage/organization-memory-repository"
import { buildGrowthHomeOrganizationalKnowledge } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
import { enrichRelationshipLeadSnapshotsBatch } from "@/lib/growth/relationship/enrich-relationship-lead-snapshots-batch"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"

const PHASE = "GE-AIOS-HOTFIX-LIVE-1A" as const

function ms(start: number): number {
  return Date.now() - start
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; durationMs: number; result: T }> {
  const start = Date.now()
  const result = await fn()
  return { label, durationMs: ms(start), result }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Home pipeline profiler (read-only)`)
  console.log(`Flags: dailyWorkQueue=${isDailyRevenueWorkQueueEnabled()} nativeDecision=${isNativeRevenueDecisionEngineEnabled()} commStrategy=${isCommunicationStrategyEnabled()}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  const actorUserId = "hotfix-live-1a-profile"
  const generatedAt = new Date().toISOString()
  const timings: Array<{ label: string; durationMs: number }> = []
  const totalStart = Date.now()

  console.log("\nHome request started")

  const leadPoolStep = await timed("Lead pool fetch", () =>
    fetchGrowthHomeLeadPoolPage(admin, { cursor: null, limit: GROWTH_HOME_LEAD_POOL_BATCH_LIMIT }),
  )
  timings.push(leadPoolStep)
  const leads = leadPoolStep.result.leads
  console.log(`  Lead pool fetch: ${leadPoolStep.durationMs}ms (${leads.length} leads)`)

  if (isDailyRevenueWorkQueueEnabled()) {
    const dwqStep = await timed("Daily work queue (sequential per-lead)", () =>
      fetchDailyRevenueWorkQueueFromLeads(admin, leads),
    )
    timings.push(dwqStep)
    console.log(`  Daily work queue: ${dwqStep.durationMs}ms`)
  } else {
    console.log("  Daily work queue: skipped (disabled)")
  }

  const engagementFilters = parseEngagementCommandCenterFilters(
    organizationId ?? "",
    new URL("https://growth.local/engagement?dateRange=last_7_days&limit=1").searchParams,
  )

  const parallelStart = Date.now()
  const [
    cadenceSchemaReady,
    nativeDialerProbe,
    pipelineDashboard,
    opportunityReadiness,
    sequenceFoundation,
    sequenceExecution,
    engagementHighIntent,
    conversationDashboard,
    relationshipDashboard,
  ] = await Promise.all([
    timed("Cadence schema probe", () => isGrowthCadenceSchemaReady(admin).catch(() => false)),
    timed("Native dialer schema probe", () => probeGrowthNativeDialerSchemaHealth(admin).catch(() => ({ schemaReady: false }))),
    timed("Opportunity pipeline dashboard", () => fetchGrowthOpportunityPipelineDashboard(admin, actorUserId).catch(() => null)),
    timed("Opportunity dashboard", () => fetchGrowthOpportunityDashboard(admin).catch(() => null)),
    timed("Sequence foundation", () => fetchSequenceExecutionFoundationDashboard(admin).catch(() => null)),
    timed("Sequence execution", () => fetchGrowthSequenceSafeExecutionDashboard(admin).catch(() => null)),
    timed("Engagement command center (full load)", () => getGrowthEngagementCommandCenterHighIntent(admin, engagementFilters).catch(() => null)),
    timed("Conversation dashboard", () => fetchGrowthConversationDashboard(admin).catch(() => null)),
    timed("Relationship dashboard", () => fetchGrowthRelationshipDashboard(admin).catch(() => null)),
  ])
  for (const step of [
    cadenceSchemaReady,
    nativeDialerProbe,
    pipelineDashboard,
    opportunityReadiness,
    sequenceFoundation,
    sequenceExecution,
    engagementHighIntent,
    conversationDashboard,
    relationshipDashboard,
  ]) {
    timings.push(step)
    console.log(`  ${step.label}: ${step.durationMs}ms`)
  }
  console.log(`  Parallel fan-out wall: ${ms(parallelStart)}ms`)

  const conditionalStart = Date.now()
  if (cadenceSchemaReady.result) {
    const step = await timed("Cadence command summary", () => fetchGrowthCadenceCommandSummary(admin).catch(() => null))
    timings.push(step)
    console.log(`  ${step.label}: ${step.durationMs}ms`)
  }
  if (nativeDialerProbe.result.schemaReady) {
    const step = await timed("Native call workspace", () => fetchGrowthNativeCallWorkspaceDashboard(admin, actorUserId).catch(() => null))
    timings.push(step)
    console.log(`  ${step.label}: ${step.durationMs}ms`)
  }
  console.log(`  Conditional loaders wall: ${ms(conditionalStart)}ms`)

  buildRevenueQueueDashboardSectionsFromLeads(leads, "priority")

  const tailSteps = [
    organizationId
      ? timed("Ava research loop summary", () => fetchLatestAvaResearchLoopSummary(admin, organizationId).catch(() => null))
      : null,
    organizationId
      ? timed("Sales outcomes (4 pilots)", () =>
          buildGrowthHomeSalesOutcomes({
            admin,
            organizationId,
            generatedAt,
            researchLoopSummary: null,
            pendingApprovals: 0,
          }).catch(() => null),
        )
      : null,
  ].filter(Boolean) as Array<Promise<{ label: string; durationMs: number; result: unknown }>>

  for (const promise of tailSteps) {
    const step = await promise
    timings.push(step)
    console.log(`  ${step.label}: ${step.durationMs}ms`)
  }

  const salesOutcomes = organizationId
    ? await buildGrowthHomeSalesOutcomes({
        admin,
        organizationId,
        generatedAt,
        researchLoopSummary: null,
        pendingApprovals: 0,
      }).catch(() => null)
    : null

  const memStep = organizationId
    ? await timed("Organization memory", () =>
        buildGrowthHomeOrganizationMemory({
          admin,
          organizationId,
          generatedAt,
          salesOutcomes: salesOutcomes?.outcomes ?? [],
        }).catch(() => null),
      )
    : null
  if (memStep) {
    timings.push(memStep)
    console.log(`  ${memStep.label}: ${memStep.durationMs}ms`)
  }

  const knowStep = organizationId
    ? await timed("Organizational knowledge (BI + upsert)", () =>
        buildGrowthHomeOrganizationalKnowledge({
          admin,
          organizationId,
          generatedAt,
          memoryEvents: [],
          salesOutcomes: salesOutcomes?.outcomes ?? [],
        }).catch(() => null),
      )
    : null
  if (knowStep) {
    timings.push(knowStep)
    console.log(`  ${knowStep.label}: ${knowStep.durationMs}ms`)
  }

  const snapStep = await timed("Relationship snapshots batch", () => enrichRelationshipLeadSnapshotsBatch(admin, leads))
  timings.push(snapStep)
  console.log(`  ${snapStep.label}: ${snapStep.durationMs}ms`)

  if (organizationId) {
    const missionStep = await timed("Mission discovery snapshot", () =>
      loadGrowthHomeMissionDiscoverySnapshot(admin, {
        organizationId,
        leadPool: leadPoolStep.result.leadPool,
      }).catch(() => null),
    )
    timings.push(missionStep)
    console.log(`  ${missionStep.label}: ${missionStep.durationMs}ms`)
  }

  const totalMs = ms(totalStart)
  console.log(`\nTotal: ${totalMs}ms`)

  timings.sort((a, b) => b.durationMs - a.durationMs)
  console.log("\n--- Slowest stages ---")
  for (const row of timings.slice(0, 8)) {
    console.log(`  ${row.label}: ${row.durationMs}ms`)
  }

  const slowest = timings[0]
  if (slowest && slowest.durationMs > 5000) {
    console.log(`\n[${PHASE}] LIKELY BLOCKER: ${slowest.label} (${slowest.durationMs}ms)`)
  }
}

void main()

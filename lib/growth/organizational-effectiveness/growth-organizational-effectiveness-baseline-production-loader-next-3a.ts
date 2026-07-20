/** GE-AIOS-NEXT-3A — Production evidence loader for organizational effectiveness baseline (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { analyzeLive1ResearchEvidenceMetrics } from "@/lib/growth/live-operations/ge-aios-live-1-operations-analysis"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { buildGrowthOrganizationalEffectivenessBaselineSnapshot } from "./growth-organizational-effectiveness-baseline-next-3a"
import type {
  GrowthOrganizationalEffectivenessEvidenceInput,
  GrowthOrganizationalEffectivenessSnapshot,
  GrowthOrganizationalEffectivenessTimeWindow,
} from "./growth-organizational-effectiveness-baseline-next-3a-types"

export const GROWTH_AIOS_NEXT_3A_PRODUCTION_LOADER_QA_MARKER =
  "ge-aios-next-3a-organizational-effectiveness-production-loader-v1" as const

const OBJECTIVE_SCHEDULER_ROUTE = growthCronApiPath("growth-objective-runtime-scheduler")

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function buildTimeWindow(
  id: string,
  label: string,
  startHoursAgo: number,
  endHoursAgo: number,
  sampleCount: number,
  minForComparison: number,
): GrowthOrganizationalEffectivenessTimeWindow {
  return {
    id,
    label,
    start: hoursAgoIso(startHoursAgo),
    end: hoursAgoIso(endHoursAgo),
    sampleSizeNote:
      sampleCount < minForComparison
        ? `Sample size ${sampleCount} — insufficient for confident period comparison.`
        : null,
    sufficientForComparison: sampleCount >= minForComparison,
  }
}

async function countDraftFactoryByState(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Record<string, number>> {
  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state")
    .eq("organization_id", organizationId)

  if (error) return {}
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const state = String(row.state)
    counts[state] = (counts[state] ?? 0) + 1
  }
  return counts
}

async function countLeadsInWindow(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
  untilIso?: string,
): Promise<number> {
  let query = admin
    .schema("growth")
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)

  if (untilIso) query = query.lt("created_at", untilIso)

  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

async function countDiscoveryRunsInWindow(
  admin: SupabaseClient,
  sinceIso: string,
  untilIso?: string,
): Promise<{ runs: number; providerRecords: number }> {
  let query = admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("run_name, record_count, preview_count, imported_count, created_at")
    .gte("created_at", sinceIso)

  if (untilIso) query = query.lt("created_at", untilIso)

  const { data, error } = await query
  if (error) return { runs: 0, providerRecords: 0 }

  const autonomous = (data ?? []).filter((row) =>
    String(row.run_name ?? "").startsWith(AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX),
  )
  const providerRecords = autonomous.reduce(
    (sum, row) => sum + Number(row.record_count ?? row.preview_count ?? row.imported_count ?? 0),
    0,
  )
  return { runs: autonomous.length, providerRecords }
}

async function countSchedulerInWindow(
  admin: SupabaseClient,
  sinceIso: string,
  untilIso?: string,
): Promise<{ runs: number; success: number; failures: number }> {
  const allRuns = await listRecentGrowthCronExecutionRuns(admin, {
    cronRoute: OBJECTIVE_SCHEDULER_ROUTE,
    limit: 200,
  })
  const inWindow = allRuns.filter((run) => {
    if (run.startedAt < sinceIso) return false
    if (untilIso && run.startedAt >= untilIso) return false
    return true
  })
  const success = inWindow.filter((run) => run.ok).length
  return { runs: inWindow.length, success, failures: inWindow.length - success }
}

async function countDraftFactoryUpdatesInWindow(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
  untilIso?: string,
): Promise<number> {
  let query = admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("updated_at", sinceIso)

  if (untilIso) query = query.lt("updated_at", untilIso)

  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

async function countOutboundInWindow(
  admin: SupabaseClient,
  sinceIso: string,
  untilIso?: string,
): Promise<number> {
  let query = admin
    .schema("growth")
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso)

  if (untilIso) query = query.lt("created_at", untilIso)

  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

async function countOrganizationKnowledge(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number | null> {
  const { count, error } = await admin
    .schema("growth")
    .from("organization_knowledge")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (error) return null
  return count ?? 0
}

export async function loadGrowthOrganizationalEffectivenessBaselineFromProduction(input: {
  admin: SupabaseClient
  organizationId: string
  observationHours?: number
}): Promise<{
  qaMarker: typeof GROWTH_AIOS_NEXT_3A_PRODUCTION_LOADER_QA_MARKER
  readOnly: true
  snapshot: GrowthOrganizationalEffectivenessSnapshot
  rawEvidence: GrowthOrganizationalEffectivenessEvidenceInput
  admissionAnalysis: Awaited<ReturnType<typeof analyzeGrowthLeadAdmissionProductionPool>> | null
}> {
  const observationHours = input.observationHours ?? 24
  const generatedAt = new Date().toISOString()
  const currentStart = hoursAgoIso(observationHours)
  const priorStart = hoursAgoIso(observationHours * 2)
  const priorEnd = currentStart

  const [
    currentDiscovery,
    priorDiscovery,
    currentLeads,
    priorLeads,
    currentScheduler,
    priorScheduler,
    currentDraftUpdates,
    draftFactoryCounts,
    currentOutbound,
    researchMetrics,
    admissionAnalysis,
    knowledgeCount,
  ] = await Promise.all([
    countDiscoveryRunsInWindow(input.admin, currentStart),
    countDiscoveryRunsInWindow(input.admin, priorStart, priorEnd),
    countLeadsInWindow(input.admin, input.organizationId, currentStart),
    countLeadsInWindow(input.admin, input.organizationId, priorStart, priorEnd),
    countSchedulerInWindow(input.admin, currentStart),
    countSchedulerInWindow(input.admin, priorStart, priorEnd),
    countDraftFactoryUpdatesInWindow(input.admin, input.organizationId, currentStart),
    countDraftFactoryByState(input.admin, input.organizationId),
    countOutboundInWindow(input.admin, currentStart),
    analyzeLive1ResearchEvidenceMetrics(input.admin, { sinceIso: currentStart }),
    analyzeGrowthLeadAdmissionProductionPool({
      admin: input.admin,
      organizationId: input.organizationId,
      limit: 500,
    }).catch(() => null),
    countOrganizationKnowledge(input.admin, input.organizationId),
  ])

  const admissionYield =
    currentDiscovery.providerRecords > 0
      ? Math.round((currentLeads / currentDiscovery.providerRecords) * 1000) / 10
      : currentDiscovery.runs > 0 && currentLeads > 0
        ? null
        : null

  const schedulerSuccessRate =
    currentScheduler.runs > 0
      ? Math.round((currentScheduler.success / currentScheduler.runs) * 1000) / 10
      : null

  const draftFactoryActive = Object.values(draftFactoryCounts).reduce((a, b) => a + b, 0)
  const waitingForResearch = draftFactoryCounts.waiting_for_research ?? 0
  const waitingForDm = draftFactoryCounts.waiting_for_dm ?? 0
  const waitingForApproval = draftFactoryCounts.waiting_for_approval ?? 0
  const draftReady = draftFactoryCounts.draft_ready ?? 0
  const approved = draftFactoryCounts.approved ?? 0
  const failed = draftFactoryCounts.failed ?? 0
  const paused = draftFactoryCounts.paused ?? 0

  const outboundDisabled = !GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled

  const measurementPeriod = buildTimeWindow(
    "current_24h",
    `Current ${observationHours} hours`,
    observationHours,
    0,
    currentScheduler.runs + currentDiscovery.runs,
    5,
  )

  const comparisonPeriod = buildTimeWindow(
    "prior_24h",
    `Previous ${observationHours} hours`,
    observationHours * 2,
    observationHours,
    priorScheduler.runs + priorDiscovery.runs,
    5,
  )

  const evidenceInput: GrowthOrganizationalEffectivenessEvidenceInput = {
    organizationId: input.organizationId,
    generatedAt,
    measurementPeriod,
    comparisonPeriod,
    outboundSendExecutionEnabled: !outboundDisabled,
    pipeline: {
      discoveryRuns: currentDiscovery.runs,
      providerRecords: currentDiscovery.providerRecords || null,
      leadsAdmitted: currentLeads,
      leadsRejected: admissionAnalysis?.counts.rejected ?? 0,
      duplicatesPrevented: null,
      admissionYield,
      pipelineCoverage: admissionAnalysis?.counts.totalActiveLeads ?? null,
      comparisonDiscoveryRuns: priorDiscovery.runs,
      comparisonLeadsAdmitted: priorLeads,
    },
    research: {
      researchRuns: researchMetrics.completedRuns + researchMetrics.activeRuns,
      researchCompleted: researchMetrics.completedRuns,
      leadsWithResearch: admissionAnalysis?.counts.researchEligible ?? null,
      stalledResearch: waitingForResearch > 0 ? waitingForResearch : researchMetrics.activeRuns,
      medianCompletionHours: null,
      comparisonResearchRuns: null,
    },
    qualification: {
      qualifiedCount: admissionAnalysis?.counts.accepted ?? null,
      rejectedCount: admissionAnalysis?.counts.rejected ?? null,
      unresolvedCount: admissionAnalysis?.counts.review ?? null,
      qualificationYield:
        admissionAnalysis && admissionAnalysis.counts.totalActiveLeads > 0
          ? Math.round(
              (admissionAnalysis.counts.accepted / admissionAnalysis.counts.totalActiveLeads) * 1000,
            ) / 10
          : null,
      operatorAgreementRate: null,
      comparisonQualificationYield: null,
    },
    decisionMakers: {
      verified: draftFactoryCounts.executed ?? null,
      contactable: draftFactoryCounts.approved ?? null,
      unresolved: waitingForDm > 0 ? waitingForDm : null,
      verificationRate:
        draftFactoryActive > 0 && waitingForDm >= 0
          ? Math.round(((draftFactoryActive - waitingForDm) / draftFactoryActive) * 1000) / 10
          : null,
      waitingForDecisionMaker: waitingForDm,
    },
    packages: {
      draftFactoryActive: draftFactoryActive || null,
      draftReady: draftReady || null,
      waitingForApproval: waitingForApproval || null,
      packagesBlocked: failed + paused || null,
      packagesApproved: approved || null,
      comparisonDraftReady: null,
    },
    operator: {
      pendingApprovals: waitingForApproval || null,
      recommendationsAccepted: null,
      recommendationsSkipped: null,
      strategicOverrideCount: null,
      comparisonPendingApprovals: null,
    },
    outreach: {
      outboundDisabled,
      approvedPackages: approved || null,
      draftsReady: draftReady || null,
      sendWindowEligible: null,
      transportAuthorized: !outboundDisabled,
      outboundMessagesInPeriod: currentOutbound,
    },
    meetings: {
      replies: null,
      meetingsBooked: null,
      opportunitiesOpened: null,
      packageToMeetingRate: null,
      outboundDisabledNote: outboundDisabled
        ? "Outbound transport disabled — meeting progression baseline not applicable."
        : null,
    },
    runtime: {
      schedulerRuns: currentScheduler.runs,
      schedulerSuccessRate,
      schedulerFailures: currentScheduler.failures,
      draftFactoryUpdates: currentDraftUpdates,
      queueDepth: draftFactoryActive || null,
      comparisonSchedulerRuns: priorScheduler.runs,
    },
    strategicLearning: {
      organizationalKnowledgeItems: knowledgeCount,
      validatedFindings: null,
      overridePatterns: null,
      segmentSamples: admissionAnalysis?.counts.totalActiveLeads ?? null,
    },
    admissionAnalysisAvailable: admissionAnalysis !== null,
    salesOutcomesAvailable: false,
    segmentAnalyticsAvailable: false,
  }

  const snapshot = buildGrowthOrganizationalEffectivenessBaselineSnapshot(evidenceInput)

  return {
    qaMarker: GROWTH_AIOS_NEXT_3A_PRODUCTION_LOADER_QA_MARKER,
    readOnly: true,
    snapshot,
    rawEvidence: evidenceInput,
    admissionAnalysis,
  }
}

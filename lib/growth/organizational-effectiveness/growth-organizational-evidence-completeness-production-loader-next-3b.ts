/** GE-AIOS-NEXT-3B — Production evidence loader for evidence completeness (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listRevenueDirectorWorkflowRequestsForOrganization } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-repository"
import { fetchOrganizationMemoryStore } from "@/lib/growth/memory/storage/organization-memory-repository"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { readAutonomousProspectSearchDatamoonMetadata } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import type { DatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import { loadGrowthOrganizationalEffectivenessBaselineFromProduction } from "./growth-organizational-effectiveness-baseline-production-loader-next-3a"
import { buildGrowthOrganizationalEvidenceCompletenessSnapshot } from "./growth-organizational-evidence-completeness-next-3b"
import type {
  GrowthDiscoveryIntakeEvidence,
  GrowthOrganizationalEvidenceCompletenessSnapshot,
} from "./growth-organizational-evidence-completeness-next-3b-types"

export const GROWTH_AIOS_NEXT_3B_PRODUCTION_LOADER_QA_MARKER =
  "ge-aios-next-3b-evidence-completeness-production-loader-v1" as const

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function mapDatamoonRunRow(row: Record<string, unknown>): DatamoonAudienceImportRun {
  return {
    id: row.id as string,
    runName: row.run_name as string,
    datamoonAudienceId: (row.datamoon_audience_id as string | null) ?? null,
    providerMode: row.provider_mode,
    audienceType: row.audience_type,
    filters: Array.isArray(row.filters) ? row.filters : [],
    topicIds: Array.isArray(row.topic_ids) ? row.topic_ids.map(String) : [],
    requestedLimit: row.requested_limit as number | null,
    audienceName: (row.audience_name as string | null) ?? null,
    websiteId: (row.website_id as string | null) ?? null,
    status: row.status as DatamoonAudienceImportRun["status"],
    recordCount: (row.record_count as number | null) ?? 0,
    loadingCount: (row.loading_count as number | null) ?? 0,
    previewCount: (row.preview_count as number | null) ?? 0,
    importedCount: (row.imported_count as number | null) ?? 0,
    duplicateCount: (row.duplicate_count as number | null) ?? 0,
    skippedCount: (row.skipped_count as number | null) ?? 0,
    errorCount: (row.error_count as number | null) ?? 0,
    providerMetadata: (row.provider_metadata as Record<string, unknown>) ?? {},
    errorMessage: (row.error_message as string | null) ?? null,
    dryRun: row.dry_run === true,
    createdBy: (row.created_by as string | null) ?? null,
    lastPolledAt: (row.last_polled_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    importedAt: (row.imported_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

async function aggregateDiscoveryIntakeEvidence(
  admin: SupabaseClient,
  sinceIso: string,
  leadsAdmittedInWindow: number,
): Promise<GrowthDiscoveryIntakeEvidence> {
  const { data, error } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select(
      "run_name, record_count, preview_count, imported_count, provider_metadata, created_at",
    )
    .gte("created_at", sinceIso)

  if (error) {
    return {
      discoveryRunsInWindow: 0,
      providerRecordsInWindow: 0,
      intakeSelectedTotal: 0,
      intakePushedTotal: 0,
      intakeExistingTotal: 0,
      intakeRejectedTotal: 0,
      intakeSkippedInvalidTotal: 0,
      intakeErrorTotal: 0,
      leadsAdmittedInWindow,
      providerToLeadYieldPct: null,
      completeness: "unavailable",
      completenessNote: error.message,
    }
  }

  let discoveryRunsInWindow = 0
  let providerRecordsInWindow = 0
  let intakeSelectedTotal = 0
  let intakePushedTotal = 0
  let intakeExistingTotal = 0
  let intakeRejectedTotal = 0
  let intakeSkippedInvalidTotal = 0
  let intakeErrorTotal = 0

  for (const row of data ?? []) {
    if (!String(row.run_name ?? "").startsWith(AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX)) continue
    discoveryRunsInWindow += 1
    providerRecordsInWindow += Number(row.record_count ?? row.preview_count ?? row.imported_count ?? 0)

    const run = mapDatamoonRunRow(row as Record<string, unknown>)
    const meta = readAutonomousProspectSearchDatamoonMetadata(run)
    if (!meta) continue

    intakeSelectedTotal += meta.intake_selected_count ?? 0
    intakePushedTotal += meta.intake_pushed_count ?? 0
    intakeExistingTotal += meta.intake_existing_count ?? 0
    intakeRejectedTotal += meta.intake_rejected_count ?? 0
    intakeSkippedInvalidTotal += meta.intake_skipped_invalid_count ?? 0
    intakeErrorTotal += meta.intake_error_count ?? 0
  }

  const providerToLeadYieldPct =
    providerRecordsInWindow > 0
      ? Math.round((leadsAdmittedInWindow / providerRecordsInWindow) * 1000) / 10
      : null

  return {
    discoveryRunsInWindow,
    providerRecordsInWindow,
    intakeSelectedTotal,
    intakePushedTotal,
    intakeExistingTotal,
    intakeRejectedTotal,
    intakeSkippedInvalidTotal,
    intakeErrorTotal,
    leadsAdmittedInWindow,
    providerToLeadYieldPct,
    completeness:
      intakeSelectedTotal > 0 || intakeRejectedTotal > 0 ? "available" : "partially_available",
    completenessNote:
      intakeSelectedTotal === 0 && providerRecordsInWindow > 0
        ? "Provider records returned but durable intake disposition counters are not yet populated on all runs."
        : null,
  }
}

async function loadResearchCompletedRuns(
  admin: SupabaseClient,
  sinceIso: string,
): Promise<{ completed: Array<{ createdAt: string; completedAt: string }>; activeRuns: number }> {
  const [{ data: completed }, { count: activeCount }] = await Promise.all([
    admin
      .schema("growth")
      .from("research_runs")
      .select("created_at, completed_at")
      .eq("status", "completed")
      .gte("completed_at", sinceIso)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(200),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "running"]),
  ])

  return {
    completed: (completed ?? [])
      .filter((row) => row.created_at && row.completed_at)
      .map((row) => ({
        createdAt: String(row.created_at),
        completedAt: String(row.completed_at),
      })),
    activeRuns: activeCount ?? 0,
  }
}

async function loadDecisionMakerEvidence(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  waitingForDm: number
  waitingForContactVerification: number
  verifiedWithDecisionMakerId: number
  contactVerificationFailed: number
  draftFactoryActive: number
  progressionHoursSamples: number[]
  blockingReasons: Array<{ reason: string; count: number }>
}> {
  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select(
      "state, decision_maker_id, last_error_code, last_error_stage, created_at, updated_at",
    )
    .eq("organization_id", organizationId)

  if (error || !data) {
    return {
      waitingForDm: 0,
      waitingForContactVerification: 0,
      verifiedWithDecisionMakerId: 0,
      contactVerificationFailed: 0,
      draftFactoryActive: 0,
      progressionHoursSamples: [],
      blockingReasons: [],
    }
  }

  let waitingForDm = 0
  let waitingForContactVerification = 0
  let verifiedWithDecisionMakerId = 0
  let contactVerificationFailed = 0
  const blockingReasons = new Map<string, number>()
  const progressionHoursSamples: number[] = []

  for (const row of data) {
    const state = String(row.state)
    if (state === "waiting_for_dm") waitingForDm += 1
    if (state === "waiting_for_contact_verification") waitingForContactVerification += 1
    if (row.decision_maker_id) verifiedWithDecisionMakerId += 1
    if (state === "failed" && row.last_error_stage === "contact_verification") {
      contactVerificationFailed += 1
    }

    if (state === "waiting_for_dm" || state === "waiting_for_contact_verification") {
      const reason = String(row.last_error_code ?? row.last_error_stage ?? state)
      blockingReasons.set(reason, (blockingReasons.get(reason) ?? 0) + 1)
    }

    if (state === "waiting_for_dm" && row.created_at && row.updated_at) {
      const start = Date.parse(String(row.created_at))
      const end = Date.parse(String(row.updated_at))
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        progressionHoursSamples.push((end - start) / (1000 * 60 * 60))
      }
    }
  }

  return {
    waitingForDm,
    waitingForContactVerification,
    verifiedWithDecisionMakerId,
    contactVerificationFailed,
    draftFactoryActive: data.length,
    progressionHoursSamples,
    blockingReasons: [...blockingReasons.entries()].map(([reason, count]) => ({ reason, count })),
  }
}

async function countDraftFactoryStateTransitionsInWindow(
  admin: SupabaseClient,
  organizationId: string,
  state: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("state", state)
    .gte("updated_at", sinceIso)

  if (error) return 0
  return count ?? 0
}

function isInWindow(iso: string | null | undefined, sinceIso: string): boolean {
  if (!iso) return false
  return iso >= sinceIso
}

export async function loadGrowthOrganizationalEvidenceCompletenessFromProduction(input: {
  admin: SupabaseClient
  organizationId: string
  observationHours?: number
}): Promise<{
  qaMarker: typeof GROWTH_AIOS_NEXT_3B_PRODUCTION_LOADER_QA_MARKER
  readOnly: true
  snapshot: GrowthOrganizationalEvidenceCompletenessSnapshot
}> {
  const observationHours = input.observationHours ?? 24
  const sinceIso = hoursAgoIso(observationHours)
  const generatedAt = new Date().toISOString()

  const baseline = await loadGrowthOrganizationalEffectivenessBaselineFromProduction({
    admin: input.admin,
    organizationId: input.organizationId,
    observationHours,
  })

  const [
    discoveryIntake,
    researchRuns,
    decisionMakers,
    memoryPayload,
    workflowRequests,
    packageApprovedInPeriod,
    packageRejectedInPeriod,
  ] = await Promise.all([
    aggregateDiscoveryIntakeEvidence(
      input.admin,
      sinceIso,
      baseline.rawEvidence.pipeline.leadsAdmitted,
    ),
    loadResearchCompletedRuns(input.admin, sinceIso),
    loadDecisionMakerEvidence(input.admin, input.organizationId),
    fetchOrganizationMemoryStore(input.admin, {
      organizationId: input.organizationId,
      generatedAt,
      limit: 100,
    }),
    listRevenueDirectorWorkflowRequestsForOrganization(input.admin, {
      organizationId: input.organizationId,
      limit: 100,
    }).catch(() => []),
    countDraftFactoryStateTransitionsInWindow(input.admin, input.organizationId, "approved", sinceIso),
    countDraftFactoryStateTransitionsInWindow(input.admin, input.organizationId, "rejected", sinceIso),
  ])

  const memoryEvents = memoryPayload.store.events.filter((event) => event.timestamp >= sinceIso)
  const memoryDecisionEvents = memoryEvents.filter((event) => event.category === "decision").length
  const memoryApprovalEvents = memoryEvents.filter((event) => event.category === "approval").length

  const workflowRequestsInWindow = workflowRequests.filter((request) => request.createdAt >= sinceIso)
  const workflowRequestsAcceptedInPeriod = workflowRequestsInWindow.filter((request) =>
    isInWindow(request.acceptedAt, sinceIso),
  ).length
  const workflowRequestsCompletedInPeriod = workflowRequestsInWindow.filter((request) =>
    isInWindow(request.completedAt, sinceIso),
  ).length

  const driftRows =
    baseline.admissionAnalysis?.driftRows.map((row) => ({
      evaluatedState: row.evaluatedState,
      reasons: row.reasons,
    })) ?? []

  const snapshot = buildGrowthOrganizationalEvidenceCompletenessSnapshot({
    organizationId: input.organizationId,
    generatedAt,
    measurementPeriodLabel: baseline.snapshot.measurementPeriod.label,
    baselineSnapshot: baseline.snapshot,
    admission: {
      driftRows,
      discoveryIntake,
    },
    decisionMakers,
    research: {
      completedRuns: researchRuns.completed,
      activeRuns: researchRuns.activeRuns,
      stalledThresholdHours: 24,
    },
    operator: {
      packageApprovedInPeriod,
      packageRejectedInPeriod,
      pendingApprovals: baseline.rawEvidence.operator.pendingApprovals ?? 0,
      memoryDecisionEvents,
      memoryApprovalEvents,
      workflowRequestsAcceptedInPeriod,
      workflowRequestsCompletedInPeriod,
      workflowRequestsTotal: workflowRequestsInWindow.length,
    },
  })

  return {
    qaMarker: GROWTH_AIOS_NEXT_3B_PRODUCTION_LOADER_QA_MARKER,
    readOnly: true,
    snapshot,
  }
}

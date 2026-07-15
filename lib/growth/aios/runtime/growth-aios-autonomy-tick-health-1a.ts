import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { mapAslWorkflowAgentToActionKind } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-action-policy-1a"
import {
  evaluateCanonicalExecutionAuthorityForLead,
  buildLeadLifecycleSnapshotForAuthority,
} from "@/lib/growth/aios/execution/growth-canonical-execution-authority-server-1a"
import { isCanonicalExecutionAllowed } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import { createGrowthAiOsRuntimeContext } from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { delegateWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import {
  AutonomyTickHealthBuildError,
  GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
  resolveAdmissionBlockedFromLeadMetadata,
  resolveAutonomyTickStopReason,
  type AutonomyTickHealthBuildDiagnostics,
  type AutonomyTickHealthStage,
  type GrowthAiosAutonomyTickHealthSnapshot,
} from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import {
  GROWTH_PORTFOLIO_EMPTY_OR_INELIGIBLE_STOP_REASON,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"

function emptySnapshot(input: Partial<GrowthAiosAutonomyTickHealthSnapshot>): GrowthAiosAutonomyTickHealthSnapshot {
  return {
    ok: false,
    qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
    organizationResolved: false,
    portfolioSnapshotBuilt: false,
    leadCount: 0,
    candidateCount: 0,
    selectedWork: false,
    selectedWorkType: null,
    workflowAgent: null,
    decisionResolved: false,
    authorityDisposition: null,
    wouldExecute: false,
    outboundEnabled: false,
    mutationPerformed: false,
    stopReason: null,
    admissionBlocked: false,
    ...input,
  }
}

function buildDiagnostics(input: {
  stage: AutonomyTickHealthStage
  organizationResolved: boolean
  portfolioSnapshotBuilt: boolean
  workSelected: boolean
  decisionResolutionStarted: boolean
  authorityEvaluationStarted: boolean
  errorClass?: string | null
}): AutonomyTickHealthBuildDiagnostics {
  return {
    stage: input.stage,
    organizationResolved: input.organizationResolved,
    portfolioSnapshotBuilt: input.portfolioSnapshotBuilt,
    workSelected: input.workSelected,
    decisionResolutionStarted: input.decisionResolutionStarted,
    authorityEvaluationStarted: input.authorityEvaluationStarted,
    errorClass: input.errorClass ?? null,
  }
}

function failAtStage(input: {
  stage: AutonomyTickHealthStage
  diagnostics: AutonomyTickHealthBuildDiagnostics
  cause: unknown
}): never {
  logGrowthEngine("autonomy_tick_health_failed", {
    qa_marker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
    stage: input.stage,
    error_class: input.diagnostics.errorClass,
    organization_resolved: input.diagnostics.organizationResolved,
    portfolio_snapshot_built: input.diagnostics.portfolioSnapshotBuilt,
    work_selected: input.diagnostics.workSelected,
    decision_resolution_started: input.diagnostics.decisionResolutionStarted,
    authority_evaluation_started: input.diagnostics.authorityEvaluationStarted,
    stack: input.cause instanceof Error ? input.cause.stack : null,
  })
  throw new AutonomyTickHealthBuildError(input)
}

/** GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B — one ASL dry-run iteration (no mutation). */
export async function buildGrowthAiosAutonomyTickHealthSnapshot(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GrowthAiosAutonomyTickHealthSnapshot> {
  let stage: AutonomyTickHealthStage = "initializing"
  let organizationResolved = false
  let portfolioSnapshotBuilt = false
  let workSelected = false
  let decisionResolutionStarted = false
  let authorityEvaluationStarted = false

  try {
    stage = "organization_resolution"
    const organizationId = getGrowthEngineAiOrgId()
    const killSwitches = await getRuntimeKillSwitchStates(admin)
    organizationResolved = organizationId != null

    if (!organizationId) {
      return emptySnapshot({
        outboundEnabled: killSwitches.autonomy_outbound_enabled,
        stopReason: "organization_unresolved",
      })
    }

    const generatedAt = new Date().toISOString()

    stage = "portfolio_snapshot"
    const portfolioSnapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId,
      generatedAt,
    }).catch(() => null)

    portfolioSnapshotBuilt = portfolioSnapshot != null
    if (!portfolioSnapshot) {
      return emptySnapshot({
        organizationResolved: true,
        outboundEnabled: killSwitches.autonomy_outbound_enabled,
        stopReason: "portfolio_snapshot_unavailable",
      })
    }

    stage = "runtime_context"
    const { summary: memorySummary } = runMemoryEngine({
      organizationId,
      generatedAt,
      workspaceSummary: portfolioSnapshot.workManagerInput.workspaceSummary,
      waitingOnYou: portfolioSnapshot.workManagerInput.waitingOnYou,
      dailyWorkQueue: portfolioSnapshot.workManagerInput.dailyWorkQueue,
      accomplishments: portfolioSnapshot.workManagerInput.accomplishments,
      timeline: portfolioSnapshot.workManagerInput.timeline,
      persistedStore: portfolioSnapshot.organizationalMemory.store,
      salesOutcomes: portfolioSnapshot.salesOutcomes.outcomes,
      organizationalKnowledge: portfolioSnapshot.organizationalKnowledge.store.items,
    })

    stage = "work_manager"
    const workResult = runWorkManager({
      ...portfolioSnapshot.workManagerInput,
      memorySummary,
      organizationId,
      portfolioLeads: portfolioSnapshot.portfolioLeads,
    })

    const candidateCount = workResult.all_work_items.length
    const selectedItem = selectNextExecutableWorkItem(workResult)
    const delegation = selectedItem ? delegateWorkItem(selectedItem) : null
    workSelected = selectedItem != null

    stage = "asl_dry_run"
    const dryRun = await inspectAutonomousSalesLoopDryRun(admin, { organizationId, generatedAt })
    const drySelected = dryRun.selected_work?.[0] ?? null

    let authorityDisposition: string | null = null
    let authorityReasonCode: string | null = null
    let decisionResolved = false
    let admissionBlocked = false
    let wouldExecute = false

    const leadId = selectedItem ? extractLeadIdFromWorkItem(selectedItem) : drySelected?.lead_id ?? null
    const workflowAgent =
      delegation && delegation.delegated
        ? delegation.workflow_agent
        : drySelected?.workflow_agent ?? null

    if (leadId) {
      stage = "lead_resolution"
      const lead = await fetchGrowthLeadById(admin, leadId).catch(() => null)

      stage = "admission_evaluation"
      admissionBlocked = resolveAdmissionBlockedFromLeadMetadata(lead?.metadata)

      if (workflowAgent) {
        stage = "execution_authority"
        decisionResolutionStarted = true
        authorityEvaluationStarted = true

        const lifecycle = lead ? await buildLeadLifecycleSnapshotForAuthority(admin, lead).catch(() => null) : null

        const runtimeContext = createGrowthAiOsRuntimeContext(admin, {
          organizationId,
          leadId,
          generatedAt,
          companyName: lead?.companyName ?? null,
          cacheScope: "autonomy-tick-health",
        })
        const decisionResolution = await runtimeContext.getDecision().catch(() => null)
        decisionResolved = decisionResolution?.decision?.decisionFingerprint != null

        try {
          const authority = await evaluateCanonicalExecutionAuthorityForLead(admin, {
            organizationId,
            leadId,
            actionKind: mapAslWorkflowAgentToActionKind(workflowAgent),
            generatedAt,
            lead,
            lifecycle: lifecycle ?? undefined,
          })
          authorityDisposition = authority.disposition
          authorityReasonCode = authority.reasonCode
          wouldExecute =
            Boolean(selectedItem && isExecutableWorkItem(selectedItem)) &&
            Boolean(delegation?.delegated) &&
            isCanonicalExecutionAllowed(authority) &&
            !admissionBlocked &&
            dryRun.dry_run === true &&
            (dryRun.selected_work?.length ?? 0) > 0

          logGrowthEngine("autonomy_tick_health_authority_evaluated", {
            qa_marker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
            stage,
            disposition: authority.disposition,
            reason_code: authority.reasonCode,
            decision_resolved: decisionResolved,
            lifecycle_reason: authority.lifecycleReason,
            organization_resolved: organizationResolved,
            portfolio_snapshot_built: portfolioSnapshotBuilt,
            work_selected: workSelected,
          })
        } catch (authorityError) {
          authorityDisposition = "deferred"
          authorityReasonCode = "decision_resolution_unavailable"
          decisionResolved = false
          wouldExecute = false
          logGrowthEngine("autonomy_tick_health_authority_deferred", {
            qa_marker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
            stage,
            error_class: authorityError instanceof Error ? authorityError.name : "UnknownError",
            organization_resolved: organizationResolved,
            portfolio_snapshot_built: portfolioSnapshotBuilt,
            work_selected: workSelected,
            decision_resolution_started: decisionResolutionStarted,
            authority_evaluation_started: authorityEvaluationStarted,
          })
        }
      }
    }

    const selectedWork = Boolean(selectedItem ?? drySelected)
    const stopReason =
      !selectedWork && portfolioSnapshot.eligibleLeadCount === 0
        ? GROWTH_PORTFOLIO_EMPTY_OR_INELIGIBLE_STOP_REASON
        : resolveAutonomyTickStopReason({
            selectedWork,
            decisionResolved,
            authorityDisposition,
            authorityReasonCode,
            dryRunStopReason: dryRun.stop_reason,
          })
    const ok = wouldExecute && !killSwitches.autonomy_outbound_enabled

    stage = "complete"
    return {
      ok,
      qaMarker: GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
      organizationResolved: true,
      portfolioSnapshotBuilt: true,
      leadCount: portfolioSnapshot.leadCount,
      candidateCount,
      selectedWork,
      selectedWorkType: selectedItem?.type ?? null,
      workflowAgent,
      decisionResolved,
      authorityDisposition,
      wouldExecute,
      outboundEnabled: killSwitches.autonomy_outbound_enabled,
      mutationPerformed: false,
      stopReason,
      admissionBlocked,
    }
  } catch (error) {
    if (error instanceof AutonomyTickHealthBuildError) {
      throw error
    }
    failAtStage({
      stage,
      diagnostics: buildDiagnostics({
        stage,
        organizationResolved,
        portfolioSnapshotBuilt,
        workSelected,
        decisionResolutionStarted,
        authorityEvaluationStarted,
        errorClass: error instanceof Error ? error.name : "UnknownError",
      }),
      cause: error,
    })
  }
}

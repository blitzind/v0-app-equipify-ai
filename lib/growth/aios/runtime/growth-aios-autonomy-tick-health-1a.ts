import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { mapAslWorkflowAgentToActionKind } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-action-policy-1a"
import {
  evaluateCanonicalExecutionAuthorityForLead,
} from "@/lib/growth/aios/execution/growth-canonical-execution-authority-server-1a"
import { isCanonicalExecutionAllowed } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { delegateWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import {
  GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER,
  type GrowthAiosAutonomyTickHealthSnapshot,
} from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"

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

/** GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B — one ASL dry-run iteration (no mutation). */
export async function buildGrowthAiosAutonomyTickHealthSnapshot(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GrowthAiosAutonomyTickHealthSnapshot> {
  const organizationId = getGrowthEngineAiOrgId(env)
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  if (!organizationId) {
    return emptySnapshot({
      outboundEnabled: killSwitches.autonomy_outbound_enabled,
      stopReason: "organization_unresolved",
    })
  }

  const generatedAt = new Date().toISOString()
  const portfolioSnapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId,
    generatedAt,
  }).catch(() => null)

  if (!portfolioSnapshot) {
    return emptySnapshot({
      organizationResolved: true,
      outboundEnabled: killSwitches.autonomy_outbound_enabled,
      stopReason: "portfolio_snapshot_unavailable",
    })
  }

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

  const workResult = runWorkManager({
    ...portfolioSnapshot.workManagerInput,
    memorySummary,
  })

  const candidateCount = workResult.all_work_items.length
  const selectedItem = selectNextExecutableWorkItem(workResult)
  const delegation = selectedItem ? delegateWorkItem(selectedItem) : null

  const dryRun = await inspectAutonomousSalesLoopDryRun(admin, { organizationId, generatedAt })
  const drySelected = dryRun.selected_work?.[0] ?? null

  let authorityDisposition: string | null = null
  let decisionResolved = false
  let admissionBlocked = false
  let wouldExecute = false

  const leadId = selectedItem ? extractLeadIdFromWorkItem(selectedItem) : drySelected?.lead_id ?? null
  const workflowAgent =
    delegation && delegation.delegated
      ? delegation.workflow_agent
      : drySelected?.workflow_agent ?? null

  if (leadId) {
    const lead = await fetchGrowthLeadById(admin, leadId).catch(() => null)
    const admission = lead ? resolveLeadAdmissionStateFromMetadata(lead.metadata).state : null
    admissionBlocked = admission === "review" || admission === "rejected" || admission === "invalid"

    if (workflowAgent) {
      const authority = await evaluateCanonicalExecutionAuthorityForLead(admin, {
        organizationId,
        leadId,
        actionKind: mapAslWorkflowAgentToActionKind(workflowAgent),
        generatedAt,
        lead,
      })
      authorityDisposition = authority.disposition
      decisionResolved = authority.decisionFingerprint != null
      wouldExecute =
        Boolean(selectedItem && isExecutableWorkItem(selectedItem)) &&
        Boolean(delegation?.delegated) &&
        isCanonicalExecutionAllowed(authority) &&
        !admissionBlocked &&
        dryRun.dry_run === true &&
        (dryRun.selected_work?.length ?? 0) > 0
    }
  }

  const selectedWork = Boolean(selectedItem ?? drySelected)
  const ok = wouldExecute && !killSwitches.autonomy_outbound_enabled

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
    stopReason: dryRun.stop_reason ?? (selectedWork ? null : "no_executable_work"),
    admissionBlocked,
  }
}

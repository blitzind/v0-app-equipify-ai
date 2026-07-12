/** GE-AIOS-21A — Unified lead research execution facade (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { runAutonomousQualificationManualEvaluation } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-service"
import type { GrowthLeadResearchEvidenceSummary } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { publishGrowthLeadResearchWorkflowStatus } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { shadowEvaluateResourceAllocation } from "@/lib/growth/resource-allocation/resource-allocation-facade"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import {
  GROWTH_LEAD_RESEARCH_READINESS_21A_QA_MARKER,
  isProspectResearchStale,
  shouldAutoQueueLeadResearch,
} from "@/lib/growth/research/growth-lead-research-readiness"
import { runProspectResearch } from "@/lib/growth/research/research-orchestrator"
import { fetchActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"

export {
  GROWTH_LEAD_RESEARCH_READINESS_21A_QA_MARKER,
  shouldAutoQueueLeadResearch,
} from "@/lib/growth/research/growth-lead-research-readiness"

export type GrowthLeadResearchTrigger =
  | "sales_loop"
  | "import"
  | "mission_bind"
  | "work_manager"
  | "drawer_opportunistic"
  | "manual"
  | "stale_refresh"
  | "ava_queue"

export type RunGrowthLeadResearchInput = {
  admin: SupabaseClient
  organizationId: string
  leadId: string
  trigger: GrowthLeadResearchTrigger
  generatedAt?: string
  rebuild?: boolean
  runQualification?: boolean
  force?: boolean
}

export type RunGrowthLeadResearchResult =
  | {
      ok: true
      outcome: "completed" | "cached" | "active"
      run: GrowthResearchRunPublicView
      lead: GrowthLead | null
      qualificationRan: boolean
    }
  | {
      ok: false
      outcome: "skipped" | "failed" | "not_found" | "not_configured"
      code: string
      message: string
      run?: GrowthResearchRunPublicView | null
    }

function buildProspectResearchEvidenceSummary(run: GrowthResearchRunPublicView): GrowthLeadResearchEvidenceSummary {
  const companyEvidence = run.signals?.companyEvidence_v22
  const verifiedEvidence: string[] = []

  if (companyEvidence?.profile.companyDescription?.value) {
    verifiedEvidence.push(
      `Verified description (${Math.round((companyEvidence.profile.companyDescription.confidence ?? 0) * 100)}%): ${companyEvidence.profile.companyDescription.value}`,
    )
  }

  for (const industry of companyEvidence?.profile.industriesServed?.values ?? []) {
    verifiedEvidence.push(`Verified industry: ${industry}`)
  }

  for (const product of companyEvidence?.profile.primaryProducts?.values ?? []) {
    verifiedEvidence.push(`Verified product: ${product}`)
  }

  for (const service of companyEvidence?.profile.primaryServices?.values ?? []) {
    verifiedEvidence.push(`Verified service: ${service}`)
  }

  for (const source of companyEvidence?.evidenceSources ?? []) {
    verifiedEvidence.push(`Source: ${source}`)
  }

  if (verifiedEvidence.length === 0) {
    verifiedEvidence.push(
      ...[
        run.researchSummary,
        run.suggestedPitchAngle,
        run.suggestedCallOpening,
        ...(run.signals?.painSignals ?? []).map((signal) => `Pain point: ${signal}`),
        run.industryGuess ? `Industry: ${run.industryGuess}` : null,
        run.websiteMaturityScore != null ? `Website maturity score: ${run.websiteMaturityScore}` : null,
      ].filter((line): line is string => typeof line === "string" && line.trim().length > 0),
    )
  }

  const missingEvidence =
    companyEvidence?.crawlState.missingInformation ??
    (verifiedEvidence.length === 0 ? ["Prospect research produced no verified evidence."] : [])

  const assumptions = companyEvidence
    ? [`Evidence confidence: ${Math.round(companyEvidence.qualityScores.overallEvidenceConfidence * 100)}%. Inferences only when website evidence unavailable.`]
    : ["Evidence gathered from public website and existing lead data — inferences labeled separately."]

  return {
    verifiedEvidence,
    missingEvidence,
    potentialRisks: run.status === "failed" && run.failedReason ? [run.failedReason] : [],
    assumptions,
    humanReviewNotes: companyEvidence?.qualificationExplanation?.reasons ?? [],
  }
}

async function publishProspectResearchWorkflowBridge(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    run: GrowthResearchRunPublicView
    trigger: GrowthLeadResearchTrigger
  },
): Promise<void> {
  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    researchRunId: input.run.id,
    workflowStatus: input.run.status === "completed" ? "research_complete" : "failed",
    evidenceSummary: buildProspectResearchEvidenceSummary(input.run),
    detail: `GE-AIOS-21A unified research — ${input.trigger} — ${input.run.status}.`,
  })
}

export async function executeGrowthLeadProspectResearch(
  input: RunGrowthLeadResearchInput,
): Promise<RunGrowthLeadResearchResult> {
  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!organizationId) {
    return {
      ok: false,
      outcome: "not_configured",
      code: "server_config",
      message: "Prospect research is not configured.",
    }
  }

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return { ok: false, outcome: "not_found", code: "not_found", message: "Lead not found." }
  }

  // SV1-1 / ARCH-1A — Resource Allocation Facade in shadow mode only.
  // Existing admission / freshness / force gates below remain the production allow/deny path.
  await shadowEvaluateResourceAllocation(input.admin, {
    organizationId,
    accountId: lead.id,
    accountKind: "lead",
    resourceClass: "website_research",
    requestedBy: `research:${input.trigger}`,
    signals: buildResourceAllocationSignalsFromLead(lead),
  }).catch(() => undefined)

  const rebuild = Boolean(input.rebuild) || input.trigger === "stale_refresh"
  const force = Boolean(input.force)

  if (input.trigger === "stale_refresh" && lead.lastProspectResearchedAt) {
    const { publishDraftFactoryResearchBecameStale } = await import(
      "@/lib/growth/draft-factory/draft-factory-wake-emitters"
    )
    void publishDraftFactoryResearchBecameStale(input.admin, {
      organizationId,
      leadId: lead.id,
      lastResearchedAt: lead.lastProspectResearchedAt,
    })
  }

  if (!force && !shouldAutoQueueLeadResearch(lead) && !rebuild) {
    return {
      ok: false,
      outcome: "skipped",
      code: "research_not_needed",
      message: "Lead already has fresh research.",
    }
  }

  const admissionState = lead.metadata?.admission_state
  if (
    !force &&
    (admissionState === "invalid" ||
      admissionState === "rejected" ||
      (admissionState === "review" && !lead.website?.trim()))
  ) {
    return {
      ok: false,
      outcome: "skipped",
      code: "admission_blocked",
      message: "Lead admission gate blocked autonomous research.",
    }
  }

  if (
    !force &&
    !rebuild &&
    lead.lastProspectResearchedAt &&
    !isProspectResearchStale(lead.lastProspectResearchedAt) &&
    lead.latestProspectResearchRunId
  ) {
    return {
      ok: false,
      outcome: "skipped",
      code: "research_fresh",
      message: "Prospect research is still fresh.",
    }
  }

  const active = await fetchActiveProspectResearchRun(input.admin, lead.id)
  if (active && !rebuild) {
    logGrowthEngine("growth_lead_research_active_reused", {
      leadId: lead.id,
      runId: active.id,
      trigger: input.trigger,
    })
    return {
      ok: true,
      outcome: "active",
      run: active,
      lead,
      qualificationRan: false,
    }
  }

  await publishGrowthLeadResearchWorkflowStatus(input.admin, {
    organizationId,
    leadId: lead.id,
    workflowStatus: "researching",
    detail: `GE-AIOS-21A — ${input.trigger}`,
  }).catch(() => undefined)

  const research = await runProspectResearch({
    admin: input.admin,
    leadId: lead.id,
    rebuild,
  })

  if (!research.ok) {
    await publishGrowthLeadResearchWorkflowStatus(input.admin, {
      organizationId,
      leadId: lead.id,
      workflowStatus: "failed",
      detail: research.message,
    }).catch(() => undefined)

    return {
      ok: false,
      outcome: "failed",
      code: research.code,
      message: research.message,
      run: research.run ?? null,
    }
  }

  await publishProspectResearchWorkflowBridge(input.admin, {
    organizationId,
    leadId: lead.id,
    run: research.run,
    trigger: input.trigger,
  })

  await recomputeGrowthLeadWorkflowSignals(input.admin, lead.id).catch(() => undefined)

  let qualificationRan = false
  const shouldQualify =
    input.runQualification !== false &&
    research.run.status === "completed" &&
    !research.cached

  if (shouldQualify) {
    try {
      await runAutonomousQualificationManualEvaluation(input.admin, {
        organizationId,
        leadId: lead.id,
        generatedAt: input.generatedAt ?? new Date().toISOString(),
      })
      qualificationRan = true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logGrowthEngine("growth_lead_research_qualification_failed", {
        leadId: lead.id,
        trigger: input.trigger,
        message: message.slice(0, 240),
      })
    }
  }

  logGrowthEngine("growth_lead_research_completed", {
    leadId: lead.id,
    runId: research.run.id,
    trigger: input.trigger,
    cached: research.cached,
    qualificationRan,
  })

  // GE-AIOS-AUTONOMY-1B — research completion wakes Draft Factory via AI OS Event Bus
  // (growth.workflow.status_changed → draft_factory_wake_observer). No parallel direct wake.

  return {
    ok: true,
    outcome: research.cached ? "cached" : "completed",
    run: research.run,
    lead: research.lead ?? lead,
    qualificationRan,
  }
}

export function scheduleGrowthLeadProspectResearchIfNeeded(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null
    leadId: string
    trigger: GrowthLeadResearchTrigger
    generatedAt?: string
    force?: boolean
  },
): void {
  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!organizationId) return

  void (async () => {
    const lead = await fetchGrowthLeadById(admin, input.leadId)
    if (!lead) return
    if (!input.force && !shouldAutoQueueLeadResearch(lead)) return

    await executeGrowthLeadProspectResearch({
      admin,
      organizationId,
      leadId: input.leadId,
      trigger: input.trigger,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      force: input.force,
    })
  })().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("growth_lead_research_schedule_failed", {
      leadId: input.leadId,
      trigger: input.trigger,
      message: message.slice(0, 240),
    })
  })
}

/** GE-AIOS-6B — Ava Research Orchestrator (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishAiOsEvent, queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { runAutonomousQualificationManualEvaluation } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-service"
import {
  fetchLatestGrowthLeadResearchWorkflowSnapshot,
  publishGrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import type {
  GrowthLeadResearchEvidenceSummary,
  GrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  fetchGrowthAiOsAutonomyPolicy,
  fetchGrowthAiOsAutonomyPolicyEvaluationContext,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import { evaluateQualificationPilotAutonomyPolicyGate } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { enforceGrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-enforcement"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT,
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
  GROWTH_AVA_RESEARCH_QUEUE_SECTIONS,
  GROWTH_AVA_QUALIFICATION_WAITING_MESSAGE,
  type GrowthAvaQualificationOrchestratorStatus,
  type GrowthAvaResearchLoopLeadResult,
  type GrowthAvaResearchLoopSummary,
  type GrowthAvaResearchQueueRunResult,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { fetchGrowthLeadById, listGrowthLeads } from "@/lib/growth/lead-repository"
import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import { executeGrowthLeadProspectResearch } from "@/lib/growth/research/growth-lead-research-execution-service"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"

import { GROWTH_HOME_LEAD_POOL_BATCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

const OUTREACH_READY_ACTIONS = new Set([
  "call_prospect",
  "enroll_sequence",
  "schedule_demo",
  "follow_up",
  "call prospect",
  "enroll sequence",
  "schedule demo",
  "follow up",
])

function nowIso(): string {
  return new Date().toISOString()
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildAvaResearchLoopNarrative(input: {
  companiesReviewed: number
  researchCompleted: number
  researchFailed: number
  buyingSignalsVerified: number
  readyForOutreachReview: number
  qualificationCompleted: number
  qualificationSkipped: number
  qualificationFailed: number
}): string {
  if (input.companiesReviewed <= 0) {
    return "No Revenue Queue leads were selected for research."
  }

  const lines = [
    `Ava reviewed ${input.companiesReviewed} ${pluralize(input.companiesReviewed, "company", "companies")}.`,
  ]

  if (input.researchCompleted > 0) {
    lines.push("Research completed.")
  } else if (input.researchFailed > 0) {
    lines.push("Research did not complete for the selected lead(s).")
  }

  if (input.qualificationCompleted > 0) {
    lines.push("Qualification completed.")
  } else if (input.qualificationSkipped > 0) {
    lines.push(GROWTH_AVA_QUALIFICATION_WAITING_MESSAGE)
  } else if (input.qualificationFailed > 0) {
    lines.push("Qualification could not complete — review research evidence.")
  }

  if (input.buyingSignalsVerified > 0) {
    lines.push(
      `${input.buyingSignalsVerified} ${pluralize(input.buyingSignalsVerified, "has", "have")} verified buying signals.`,
    )
  }

  if (input.readyForOutreachReview > 0) {
    lines.push(
      `${input.readyForOutreachReview} ${pluralize(input.readyForOutreachReview, "appears", "appear")} ready for outreach review.`,
    )
  }

  lines.push("Please review.")
  return lines.join("\n")
}

/**
 * GE-AIOS-6E — Resolve qualification outcome from durable workflow snapshot.
 * Workflow events are canonical; the 5C in-memory pilot store supplements skip reasons only.
 */
export function resolveAvaQualificationOrchestratorOutcome(input: {
  workflowStatus: GrowthLeadResearchWorkflowStatus | null
  policyGate: { allowed: boolean; blockReason: string | null; policyKey: string | null }
  pilotRun?: {
    outcome: "completed" | "failed" | "skipped"
    qualificationStatus: "qualified" | "blocked" | "failed" | "skipped" | null
    skipReason: string | null
  } | null
}): {
  qualificationStatus: GrowthAvaQualificationOrchestratorStatus
  qualificationSkipReason: string | null
  qualificationPolicyGate: string | null
} {
  const workflow = input.workflowStatus
  const policyKey = input.policyGate.policyKey

  if (workflow === "qualified" || workflow === "assessed") {
    return {
      qualificationStatus: "completed",
      qualificationSkipReason: null,
      qualificationPolicyGate: policyKey,
    }
  }

  if (workflow === "failed") {
    return {
      qualificationStatus: "failed",
      qualificationSkipReason: input.pilotRun?.skipReason ?? "Qualification workflow failed.",
      qualificationPolicyGate: policyKey,
    }
  }

  if (workflow === "blocked") {
    return {
      qualificationStatus: "blocked",
      qualificationSkipReason: input.pilotRun?.skipReason ?? "Qualification workflow blocked.",
      qualificationPolicyGate: policyKey,
    }
  }

  if (!input.policyGate.allowed) {
    return {
      qualificationStatus: "blocked",
      qualificationSkipReason: input.policyGate.blockReason,
      qualificationPolicyGate: policyKey,
    }
  }

  if (input.pilotRun?.outcome === "failed" || input.pilotRun?.qualificationStatus === "failed") {
    return {
      qualificationStatus: "failed",
      qualificationSkipReason: input.pilotRun.skipReason,
      qualificationPolicyGate: policyKey,
    }
  }

  if (input.pilotRun?.qualificationStatus === "blocked") {
    return {
      qualificationStatus: "blocked",
      qualificationSkipReason: input.pilotRun.skipReason,
      qualificationPolicyGate: policyKey,
    }
  }

  return {
    qualificationStatus: "skipped",
    qualificationSkipReason:
      input.pilotRun?.skipReason ??
      (workflow === "research_complete"
        ? "Qualification did not advance beyond research_complete."
        : "Qualification agent did not record a run."),
    qualificationPolicyGate: policyKey,
  }
}

async function runQualificationSpecialistForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt: string
  },
): Promise<{
  qualificationStatus: GrowthAvaQualificationOrchestratorStatus
  qualificationSkipReason: string | null
  qualificationPolicyGate: string | null
}> {
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })
  const policyGate = evaluateQualificationPilotAutonomyPolicyGate(evaluationContext)

  const qualificationReadModel = await runAutonomousQualificationManualEvaluation(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
  })

  const workflowSnapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  const latestRun = qualificationReadModel.recentRuns.find((run) => run.leadId === input.leadId) ?? null

  return resolveAvaQualificationOrchestratorOutcome({
    workflowStatus: workflowSnapshot?.workflowStatus ?? null,
    policyGate,
    pilotRun: latestRun
      ? {
          outcome: latestRun.outcome,
          qualificationStatus: latestRun.qualificationStatus,
          skipReason: latestRun.skipReason,
        }
      : null,
  })
}

export function selectRevenueQueueResearchCandidates(
  leads: GrowthLead[],
  maxLeads: number = GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
): RevenueQueueCardView[] {
  const sections = buildRevenueQueueDashboardSectionsFromLeads(leads, "priority")
  const selected: RevenueQueueCardView[] = []
  const seen = new Set<string>()

  for (const sectionId of GROWTH_AVA_RESEARCH_QUEUE_SECTIONS) {
    const section = sections.find((row) => row.id === sectionId)
    if (!section) continue
    for (const card of section.items) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
      selected.push(card)
      if (selected.length >= maxLeads) return selected
    }
  }

  return selected
}

function buildEvidenceFromProspectRun(run: GrowthResearchRunPublicView): GrowthLeadResearchEvidenceSummary {
  const verifiedEvidence = [
    run.researchSummary,
    run.suggestedPitchAngle,
    run.suggestedCallOpening,
    ...(run.signals?.painSignals ?? []).map((signal) => `Pain point: ${signal}`),
    run.industryGuess ? `Industry: ${run.industryGuess}` : null,
    run.websiteMaturityScore != null ? `Website maturity score: ${run.websiteMaturityScore}` : null,
  ].filter((line): line is string => typeof line === "string" && line.trim().length > 0)

  return {
    verifiedEvidence,
    missingEvidence: verifiedEvidence.length === 0 ? ["Prospect research produced no verified evidence."] : [],
    potentialRisks: run.status === "failed" && run.failedReason ? [run.failedReason] : [],
    assumptions: ["Prospect research completed via Ava Research Orchestrator — no outbound providers."],
    humanReviewNotes: [],
  }
}

async function publishProspectResearchWorkflowBridge(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    run: GrowthResearchRunPublicView
  },
): Promise<void> {
  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    researchRunId: input.run.id,
    workflowStatus: input.run.status === "completed" ? "research_complete" : "failed",
    evidenceSummary: buildEvidenceFromProspectRun(input.run),
    detail: `GE-AIOS-6B Ava Research Orchestrator — prospect research ${input.run.status}.`,
  })
}

function leadHasBuyingSignals(lead: GrowthLead | null, run: GrowthResearchRunPublicView | null): boolean {
  if ((run?.signals?.painSignals?.length ?? 0) > 0) return true
  if ((lead?.score ?? 0) >= 75 || (lead?.engagementScore ?? 0) >= 75) return true
  if (
    lead?.decisionMakerStatus === "confirmed" ||
    lead?.decisionMakerStatus === "verified_contactable" ||
    lead?.decisionMakerStatus === "suspected"
  ) {
    return true
  }
  if ((run?.websiteMaturityScore ?? 0) >= 60 && (run?.researchConfidence ?? 0) >= 65) return true
  return false
}

function leadReadyForOutreachReview(
  lead: GrowthLead | null,
  workflowStatus: string | null | undefined,
): boolean {
  if (!lead) return false
  const status = workflowStatus ?? null
  if (status === "assessed" || status === "qualified") return true

  const nba = `${lead.nextBestAction ?? ""} ${lead.prospectRecommendedNextAction ?? ""}`.toLowerCase()
  if ([...OUTREACH_READY_ACTIONS].some((action) => nba.includes(action))) return true
  if (
    lead.nextBestAction === "call_immediately" ||
    lead.nextBestAction === "call_now" ||
    lead.nextBestAction === "call_primary_contact" ||
    lead.nextBestAction === "call_decision_maker" ||
    lead.nextBestAction === "immediate_sales_action"
  ) {
    return true
  }
  if ((lead.score ?? 0) >= 70 && lead.workflowHealth === "healthy") return true
  return false
}

function parseResearchLoopSummaryFromEvent(
  event: Awaited<ReturnType<typeof queryAiOsEvents>>[number],
): GrowthAvaResearchLoopSummary | null {
  const payload = event.payload ?? {}
  if (payload.qa_marker !== GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER) return null
  if (typeof payload.run_id !== "string") return null
  if (typeof payload.narrative !== "string") return null

  return {
    qaMarker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
    runId: payload.run_id,
    completedAt: event.occurredAt,
    companiesReviewed: Number(payload.companies_reviewed ?? 0),
    researchCompleted: Number(payload.research_completed ?? 0),
    buyingSignalsVerified: Number(payload.buying_signals_verified ?? 0),
    readyForOutreachReview: Number(payload.ready_for_outreach_review ?? 0),
    qualificationCompleted: Number(payload.qualification_completed ?? 0),
    qualificationSkipped: Number(payload.qualification_skipped ?? 0),
    qualificationFailed: Number(payload.qualification_failed ?? 0),
    narrative: payload.narrative,
    leadResults: Array.isArray(payload.lead_results) ? (payload.lead_results as GrowthAvaResearchLoopLeadResult[]) : [],
    transportBlocked: true,
    humanApprovalRequired: true,
    outboundOccurred: false,
  }
}

export async function fetchLatestAvaResearchLoopSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAvaResearchLoopSummary | null> {
  const events = await queryAiOsEvents(admin, {
    organizationId,
    eventType: GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT,
    limit: 5,
  })

  for (const event of events) {
    const summary = parseResearchLoopSummaryFromEvent(event)
    if (summary) return summary
  }

  return null
}

async function publishResearchLoopCompletedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    summary: GrowthAvaResearchLoopSummary
    actorUserId?: string | null
  },
): Promise<void> {
  await publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT,
    category: "system",
    producer: "ava_research_orchestrator",
    source: "ge-aios-6b",
    entityType: "organization",
    entityId: input.organizationId,
    correlationId: input.summary.runId,
    payload: {
      qa_marker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
      run_id: input.summary.runId,
      completed_at: input.summary.completedAt,
      companies_reviewed: input.summary.companiesReviewed,
      research_completed: input.summary.researchCompleted,
      buying_signals_verified: input.summary.buyingSignalsVerified,
      ready_for_outreach_review: input.summary.readyForOutreachReview,
      qualification_completed: input.summary.qualificationCompleted,
      qualification_skipped: input.summary.qualificationSkipped,
      qualification_failed: input.summary.qualificationFailed,
      narrative: input.summary.narrative,
      lead_results: input.summary.leadResults,
      transport_blocked: true,
      human_approval_required: true,
      outbound_occurred: false,
      actor_user_id: input.actorUserId ?? null,
    },
  })
}

async function processLeadResearch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    generatedAt: string
  },
): Promise<GrowthAvaResearchLoopLeadResult> {
  const research = await executeGrowthLeadProspectResearch({
    admin,
    organizationId: input.organizationId,
    leadId: input.leadId,
    trigger: "ava_queue",
    generatedAt: input.generatedAt,
    rebuild: false,
    runQualification: false,
    force: true,
  })

  if (!research.ok) {
    return {
      leadId: input.leadId,
      companyName: input.companyName,
      outcome: "failed",
      skipReason: research.message,
      qualificationStatus: null,
    }
  }

  if (research.outcome === "active") {
    return {
      leadId: input.leadId,
      companyName: input.companyName,
      outcome: "skipped",
      skipReason: "research_in_progress",
      qualificationStatus: null,
    }
  }

  const qualification = await runQualificationSpecialistForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId).catch(() => undefined)

  const refreshedLead = research.lead ?? (await fetchGrowthLeadById(admin, input.leadId))
  const workflowSnapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  return {
    leadId: input.leadId,
    companyName: input.companyName,
    outcome: research.run.status === "completed" ? "completed" : "skipped",
    skipReason: research.run.status === "completed" ? null : research.run.failedReason,
    researchRunId: research.run.id,
    workflowStatus: workflowSnapshot?.workflowStatus ?? null,
    qualificationStatus: qualification.qualificationStatus,
    qualificationSkipReason: qualification.qualificationSkipReason,
    qualificationPolicyGate: qualification.qualificationPolicyGate,
    hasBuyingSignals: leadHasBuyingSignals(refreshedLead, research.run),
    readyForOutreachReview: leadReadyForOutreachReview(refreshedLead, workflowSnapshot?.workflowStatus),
  }
}

export async function runAvaResearchQueueOrchestrator(
  admin: SupabaseClient,
  input: {
    organizationId: string
    actorUserId?: string | null
    maxLeads?: number
    generatedAt?: string
  },
): Promise<GrowthAvaResearchQueueRunResult> {
  const generatedAt = input.generatedAt ?? nowIso()
  const maxLeads = input.maxLeads ?? GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS

  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  if (policy.emergencyStopActive) {
    return {
      ok: false,
      qaMarker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
      summary: null,
      blocked: true,
      blockReason: "Emergency stop active — configure in Growth Autonomy.",
      transportBlocked: true,
      humanApprovalRequired: true,
      outboundOccurred: false,
    }
  }

  const enforcement = await enforceGrowthAutonomyCapability(admin, {
    organizationId: input.organizationId,
    capability: "research",
    runtimeContext: "ava_research_orchestrator",
    triggerSource: "operator",
  })

  if (!enforcement.allowed) {
    return {
      ok: false,
      qaMarker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
      summary: null,
      blocked: true,
      blockReason: enforcement.reason ?? "Research capability blocked by autonomy policy.",
      transportBlocked: true,
      humanApprovalRequired: true,
      outboundOccurred: false,
    }
  }

  const leads = await listGrowthLeads(admin, {
    limit: GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
    includeArchived: false,
  })

  const candidates = selectRevenueQueueResearchCandidates(leads, maxLeads)
  const leadResults: GrowthAvaResearchLoopLeadResult[] = []

  for (const card of candidates) {
    try {
      const result = await processLeadResearch(admin, {
        organizationId: input.organizationId,
        leadId: card.id,
        companyName: card.company_name,
        generatedAt,
      })
      leadResults.push(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      leadResults.push({
        leadId: card.id,
        companyName: card.company_name,
        outcome: "failed",
        skipReason: message.slice(0, 240),
      })
    }
  }

  const researchCompleted = leadResults.filter((row) => row.outcome === "completed").length
  const researchFailed = leadResults.filter((row) => row.outcome === "failed").length
  const buyingSignalsVerified = leadResults.filter((row) => row.hasBuyingSignals).length
  const readyForOutreachReview = leadResults.filter((row) => row.readyForOutreachReview).length
  const qualificationCompleted = leadResults.filter((row) => row.qualificationStatus === "completed").length
  const qualificationSkipped = leadResults.filter(
    (row) => row.qualificationStatus === "skipped" || row.qualificationStatus === "blocked",
  ).length
  const qualificationFailed = leadResults.filter((row) => row.qualificationStatus === "failed").length

  const summary: GrowthAvaResearchLoopSummary = {
    qaMarker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
    runId: randomUUID(),
    completedAt: generatedAt,
    companiesReviewed: candidates.length,
    researchCompleted,
    buyingSignalsVerified,
    readyForOutreachReview,
    qualificationCompleted,
    qualificationSkipped,
    qualificationFailed,
    narrative: buildAvaResearchLoopNarrative({
      companiesReviewed: candidates.length,
      researchCompleted,
      researchFailed,
      buyingSignalsVerified,
      readyForOutreachReview,
      qualificationCompleted,
      qualificationSkipped,
      qualificationFailed,
    }),
    leadResults,
    transportBlocked: true,
    humanApprovalRequired: true,
    outboundOccurred: false,
  }

  await publishResearchLoopCompletedEvent(admin, {
    organizationId: input.organizationId,
    summary,
    actorUserId: input.actorUserId,
  })

  logGrowthEngine("ava_research_queue_orchestrator_completed", {
    organizationId: input.organizationId,
    runId: summary.runId,
    companiesReviewed: summary.companiesReviewed,
    researchCompleted: summary.researchCompleted,
    buyingSignalsVerified: summary.buyingSignalsVerified,
    readyForOutreachReview: summary.readyForOutreachReview,
    actorUserId: input.actorUserId ?? null,
  })

  return {
    ok: true,
    qaMarker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
    summary,
    transportBlocked: true,
    humanApprovalRequired: true,
    outboundOccurred: false,
  }
}

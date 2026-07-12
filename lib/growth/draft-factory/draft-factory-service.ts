/**
 * SV1-3 — Autonomous Draft Factory service (server-only).
 * Orchestrates existing engines. Generation delegates to Growth 5F draft service.
 * Never sends. Never clears transport_blocked.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { evaluateAndEnrichDecisionMakerForLead } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-service"
import {
  applyAdvanceToRecord,
  assembleDraftFactoryPackage,
  createDraftFactoryLeadRecord,
  planDraftFactoryAdvance,
  runDraftFactoryOvernightBatch,
} from "@/lib/growth/draft-factory/draft-factory-engine"
import {
  recordDraftFactoryAdvanceLedger,
  recordDraftFactoryBatchLedger,
} from "@/lib/growth/draft-factory/draft-factory-ledger"
import {
  getDraftFactoryLeadRecord,
  getDraftFactoryPackagesProducedToday,
  incrementDraftFactoryPackagesProduced,
  releaseDraftFactoryLeadLock,
  tryAcquireDraftFactoryLeadLock,
  upsertDraftFactoryLeadRecord,
} from "@/lib/growth/draft-factory/draft-factory-store"
import { syncSv13AdvanceIntoDurableStore } from "@/lib/growth/draft-factory/draft-factory-durable-bridge"
import {
  AI_OS_DRAFT_FACTORY_CAPACITY,
  type AiOsDraftFactoryAdvanceResult,
  type AiOsDraftFactoryBatchResult,
  type AiOsDraftFactorySignals,
  type AiOsDraftFactoryWakeSource,
} from "@/lib/growth/draft-factory/draft-factory-types"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"

function nowIso(): string {
  return new Date().toISOString()
}

export function buildDraftFactorySignalsForLead(input: {
  organizationId: string
  lead: Awaited<ReturnType<typeof fetchGrowthLeadById>>
  portfolioSelected?: boolean
  hasRecentApprovalPackage?: boolean
  knowledgeComplete?: boolean
  personalizationReady?: boolean
  approvalDecision?: "approved" | "rejected" | null
  selectedBecause?: string | null
}): AiOsDraftFactorySignals {
  const lead = input.lead
  if (!lead) {
    return {
      admissionState: "unknown",
      transportBlocked: true,
      budgetAvailable: false,
    }
  }

  const resource = evaluateResourceAllocationFacade({
    organizationId: input.organizationId,
    accountId: lead.id,
    resourceClass: "email_drafting",
    signals: buildResourceAllocationSignalsFromLead(lead, {
      approvalRequired: true,
      approvalGranted: false,
    }),
  })

  const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
  const researchStale = lead.lastProspectResearchedAt
    ? isProspectResearchStale(lead.lastProspectResearchedAt)
    : true

  return {
    admissionState:
      (lead.metadata?.admission_state as AiOsDraftFactorySignals["admissionState"]) ?? "unknown",
    researchFresh: hasUsableResearch && !researchStale,
    researchStale,
    hasUsableResearch,
    knowledgeComplete: input.knowledgeComplete ?? hasUsableResearch,
    investmentState: resource.investment_state,
    spendAuthorized: resource.spend_authorized,
    portfolioSelected: input.portfolioSelected ?? false,
    decisionMakerStatus: lead.decisionMakerStatus,
    hasPrimaryDecisionMaker: Boolean(lead.primaryDecisionMakerId),
    hasContactName: Boolean(lead.contactName?.trim()),
    personalizationReady: input.personalizationReady,
    hasRecentApprovalPackage: input.hasRecentApprovalPackage ?? false,
    approvalDecision: input.approvalDecision ?? null,
    transportBlocked: true,
    budgetAvailable: true,
    companySummary: lead.companyName,
    selectedBecause: input.selectedBecause ?? null,
  }
}

/**
 * Advance one lead through the Draft Factory.
 * Reuses existing research/DM/personalization/drafts; generation calls Growth 5F only when needed.
 */
export async function advanceDraftFactoryForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeSource?: AiOsDraftFactoryWakeSource | null
    portfolioSelected?: boolean
    selectedBecause?: string | null
    workerId?: string
    generatedAt?: string
    /** When false, plan only — do not call 5F generation. */
    allowGeneration?: boolean
  },
): Promise<AiOsDraftFactoryAdvanceResult> {
  const generatedAt = input.generatedAt ?? nowIso()
  const workerId = input.workerId ?? `draft-factory:${generatedAt}`
  const allowGeneration = input.allowGeneration !== false

  const locked = tryAcquireDraftFactoryLeadLock({
    organizationId: input.organizationId,
    leadId: input.leadId,
    workerId,
    now: generatedAt,
  })
  if (!locked) {
    const existing = getDraftFactoryLeadRecord(input.organizationId, input.leadId, generatedAt)
    return {
      qaMarker: "sv1-3-draft-factory-v1",
      leadId: input.leadId,
      previousState: existing?.state ?? "paused",
      nextState: existing?.state ?? "paused",
      stagesSkipped: [],
      stageExecuted: null,
      resumedFrom: existing?.earliestIncompleteStage ?? null,
      package: existing?.package ?? null,
      blockedReason: "Parallel worker lock — duplicate work prevented.",
      duplicatePrevented: true,
      transportBlocked: true,
      mode: "active",
    }
  }

  try {
    const lead = await fetchGrowthLeadById(admin, input.leadId)
    if (!lead) {
      const failed = planDraftFactoryAdvance({
        record: createDraftFactoryLeadRecord({
          organizationId: input.organizationId,
          leadId: input.leadId,
          signals: { admissionState: "invalid", transportBlocked: true },
          now: generatedAt,
        }),
        signals: { admissionState: "invalid", transportBlocked: true },
        budgetAvailable: false,
        now: generatedAt,
      })
      await recordDraftFactoryAdvanceLedger(admin, { organizationId: input.organizationId, advance: failed })
      return failed
    }

    const existing = getDraftFactoryLeadRecord(input.organizationId, input.leadId, generatedAt)
    const signals = buildDraftFactorySignalsForLead({
      organizationId: input.organizationId,
      lead,
      portfolioSelected: input.portfolioSelected,
      hasRecentApprovalPackage: Boolean(existing?.package),
      selectedBecause: input.selectedBecause,
      approvalDecision: existing?.package?.growth5fApprovalPackage?.packageApprovalDecision ?? null,
    })

    const record =
      existing ??
      createDraftFactoryLeadRecord({
        organizationId: input.organizationId,
        leadId: input.leadId,
        companyName: lead.companyName,
        signals,
        wakeSource: input.wakeSource,
        now: generatedAt,
        existingPackage: null,
      })

    const packagesToday = getDraftFactoryPackagesProducedToday(input.organizationId, generatedAt)
    const budgetAvailable = packagesToday < AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay

    // First plan without generation to see if we can reuse or need upstream stages.
    let advance = planDraftFactoryAdvance({
      record: { ...record, lockOwner: workerId },
      signals,
      wakeSource: input.wakeSource,
      budgetAvailable,
      now: generatedAt,
      workerId,
    })

    // SV1-4 — waiting_for_dm is an active resumable stage via DataMoon decision-maker enrichment.
    if (
      advance.nextState === "waiting_for_dm" ||
      advance.resumedFrom === "decision_maker" ||
      input.wakeSource === "decision_maker_required" ||
      input.wakeSource === "datamoon_person_requested" ||
      input.wakeSource === "provider_capacity_available"
    ) {
      const dmDecision = await evaluateAndEnrichDecisionMakerForLead(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        portfolioSelected: input.portfolioSelected === true,
        budgetAvailable: true,
        generatedAt,
      }).catch(() => null)

      if (dmDecision?.resumeDraftFactoryTo === "personalization") {
        const refreshedSignals = {
          ...signals,
          decisionMakerStatus: "confirmed" as const,
          hasPrimaryDecisionMaker: true,
          hasContactName: true,
          personalizationReady: true,
        }
        advance = planDraftFactoryAdvance({
          record: { ...record, lockOwner: workerId },
          signals: refreshedSignals,
          wakeSource: "datamoon_person_completed",
          budgetAvailable,
          now: generatedAt,
          workerId,
        })
        Object.assign(signals, refreshedSignals)
      } else if (dmDecision?.denyReason === "stop_investment" || dmDecision?.resumeDraftFactoryTo === "paused") {
        advance = {
          ...advance,
          nextState: "paused",
          stageExecuted: "decision_maker",
          resumedFrom: "decision_maker",
          blockedReason: dmDecision.explainability.whyAccountEarnedSpend || dmDecision.denyReason,
        }
      } else if (dmDecision) {
        advance = {
          ...advance,
          nextState: "waiting_for_dm",
          stageExecuted: "decision_maker",
          resumedFrom: "decision_maker",
          blockedReason: dmDecision.explainability.pipelineDisposition,
        }
      }
    }

    if (
      allowGeneration &&
      advance.nextState === "waiting_for_generation" &&
      advance.resumedFrom === "generation" &&
      budgetAvailable &&
      signals.portfolioSelected &&
      signals.investmentState !== "stop_investment"
    ) {
      const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      })
      if (snapshot) {
        const growth5f = await buildAutonomousOutreachApprovalPackage(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          companyName: lead.companyName,
          snapshot,
          generatedAt,
        })
        // Hard invariant: never clear transport block.
        if (growth5f.transportBlocked !== true || growth5f.pendingHumanApproval !== true) {
          advance = {
            ...advance,
            nextState: "failed",
            blockedReason: "5F package missing transport_blocked/pendingHumanApproval — refused.",
            package: null,
          }
        } else {
          advance = planDraftFactoryAdvance({
            record: { ...record, lockOwner: workerId },
            signals: { ...signals, hasRecentApprovalPackage: true, personalizationReady: true },
            wakeSource: input.wakeSource,
            budgetAvailable: true,
            growth5fApprovalPackage: growth5f,
            now: generatedAt,
            workerId,
          })
          if (advance.stageExecuted === "generation" && advance.package) {
            incrementDraftFactoryPackagesProduced(input.organizationId, generatedAt)
          }
        }
      }
    }

    // Reuse path: assemble explainability around existing package if needed
    if (advance.package == null && existing?.package && advance.nextState === "waiting_for_approval") {
      advance = {
        ...advance,
        package: existing.package,
        duplicatePrevented: true,
      }
    }

    const nextRecord = applyAdvanceToRecord(record, advance, generatedAt)
    upsertDraftFactoryLeadRecord(input.organizationId, generatedAt, nextRecord)
    // SV1-5 — durable store is production authority; dual-write so restarts resume correctly.
    syncSv13AdvanceIntoDurableStore({
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeSource: input.wakeSource ?? "outreach_preparation_wake",
      advance,
      record: nextRecord,
      now: generatedAt,
    })
    await recordDraftFactoryAdvanceLedger(admin, {
      organizationId: input.organizationId,
      advance,
    })
    return advance
  } finally {
    releaseDraftFactoryLeadLock({
      organizationId: input.organizationId,
      leadId: input.leadId,
      now: generatedAt,
    })
  }
}

/**
 * Capacity-bounded overnight batch. Delegates generation to advanceDraftFactoryForLead → 5F.
 */
export async function runDraftFactoryOvernightCycle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    candidates: Array<{
      leadId: string
      companyName?: string | null
      portfolioSelected?: boolean
      selectedBecause?: string | null
      wakeSource?: AiOsDraftFactoryWakeSource | null
    }>
    generatedAt?: string
    maxPackages?: number
  },
): Promise<AiOsDraftFactoryBatchResult> {
  const generatedAt = input.generatedAt ?? nowIso()
  const maxPackages = input.maxPackages ?? AI_OS_DRAFT_FACTORY_CAPACITY.maxOvernightBatch
  const results: AiOsDraftFactoryAdvanceResult[] = []
  let packagesReady = 0
  let advanced = 0
  let skippedBudget = 0
  let skippedIneligible = 0
  let failed = 0
  let duplicatesPrevented = 0

  for (const candidate of input.candidates.slice(0, maxPackages)) {
    const advance = await advanceDraftFactoryForLead(admin, {
      organizationId: input.organizationId,
      leadId: candidate.leadId,
      wakeSource: candidate.wakeSource ?? "portfolio_selected",
      portfolioSelected: candidate.portfolioSelected ?? true,
      selectedBecause: candidate.selectedBecause,
      generatedAt,
    })
    results.push(advance)
    if (advance.duplicatePrevented) duplicatesPrevented += 1
    if (advance.blockedReason?.includes("Budget")) skippedBudget += 1
    else if (
      advance.blockedReason?.includes("Investment") ||
      advance.blockedReason?.includes("Portfolio") ||
      advance.blockedReason?.includes("Stop Investment")
    ) {
      skippedIneligible += 1
    } else if (advance.nextState === "failed") failed += 1
    else if (advance.stageExecuted || advance.nextState !== advance.previousState) advanced += 1

    if (advance.nextState === "waiting_for_approval" && advance.package) {
      packagesReady += 1
    }
  }

  const used = getDraftFactoryPackagesProducedToday(input.organizationId, generatedAt)
  const batch: AiOsDraftFactoryBatchResult = {
    qaMarker: "sv1-3-draft-factory-v1",
    organizationId: input.organizationId,
    evaluated: Math.min(input.candidates.length, maxPackages),
    advanced,
    packagesReady,
    skippedBudget,
    skippedIneligible,
    failed,
    duplicatesPrevented,
    capacity: {
      maxPackagesPerDay: AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay,
      used,
      remaining: Math.max(0, AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay - used),
    },
    results,
    decidedAt: generatedAt,
  }

  await recordDraftFactoryBatchLedger(admin, batch)
  return batch
}

export {
  assembleDraftFactoryPackage,
  createDraftFactoryLeadRecord,
  planDraftFactoryAdvance,
  runDraftFactoryOvernightBatch,
} from "@/lib/growth/draft-factory/draft-factory-engine"

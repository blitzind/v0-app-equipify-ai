/**
 * SV1-5 — Canonical durable Draft Factory advancement (client-safe core + side-effect hooks).
 * All wake sources flow through advanceDraftFactoryForLeadDurable.
 * Generation remains Growth 5F only (injected). Never sends / enrolls / clears transport block.
 */

import {
  applyStageCompletionFact,
  applyWakeInvalidationToEvidence,
  buildAdvanceResultV5,
  buildDraftFactoryWakeFingerprint,
  normalizeDraftFactoryWake,
  planDurableStageAdvance,
  projectDurableStateFromStage,
  reconstructDraftFactoryStateFromCanonicalData,
  resolveEarliestIncompleteDurableStage,
} from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import type { DraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"
import { createMemoryDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-memory-repository"
import {
  AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  type AiOsDraftFactoryAdvanceResultV5,
  type AiOsDraftFactoryCanonicalEvidence,
  type AiOsDraftFactoryCanonicalWake,
  type AiOsDraftFactoryDurableLeadState,
  type AiOsDraftFactoryWakeInput,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { evaluatePortfolioAllocationFacade } from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"
import type { AiOsPortfolioCapacityClass } from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"
import { AI_OS_DRAFT_FACTORY_CAPACITY } from "@/lib/growth/draft-factory/draft-factory-types"

export {
  reconstructDraftFactoryStateFromCanonicalData,
  normalizeDraftFactoryWake,
  buildDraftFactoryWakeFingerprint,
} from "@/lib/growth/draft-factory/draft-factory-durable-engine"

export type AdvanceDraftFactoryForLeadInput = {
  organizationId: string
  leadId: string
  wake: string | AiOsDraftFactoryWakeInput
  now: string
  evidence?: AiOsDraftFactoryCanonicalEvidence
  workerId?: string
  /** Injected repository — production must pass Postgres via live facade. */
  repository?: DraftFactoryDurableRepository
  /** Injected Growth 5F generation — only path that may create packages. */
  generateViaGrowth5F?: (ctx: {
    organizationId: string
    leadId: string
    now: string
  }) => Promise<{ packageId: string; pendingHumanApproval: true; transportBlocked: true } | null>
  /** Optional auto-complete facts for deterministic certs / wake completions. */
  completionHints?: {
    completeCurrentStage?: boolean
    inFlightResearch?: boolean
    inFlightDatamoon?: boolean
    generationCapacityAvailable?: boolean
    portfolioDeferred?: boolean
    providerTimeout?: boolean
    terminalNoResult?: boolean
    packageId?: string
    decisionEnforcementBlocked?: boolean
    canonicalDecisionEnforcementOutcome?: string
    canonicalEnforcementFingerprint?: string
    decisionNextEligibleWakeAt?: string | null
    draftFactoryFailureRecoverability?: "recoverable" | "non_recoverable"
    /** GE-AIOS-REVENUE-2A-HOTFIX-2 — bypass next_eligible_wake_at retry gate for integrity reconcile. */
    admissionIntegrityReconcile?: boolean
  }
}

function defaultEvidence(partial?: AiOsDraftFactoryCanonicalEvidence): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: false,
    knowledgeComplete: false,
    stopInvestment: false,
    portfolioSelected: false,
    decisionMakerAvailable: false,
    contactVerifiedForEmail: false,
    personalizationReady: false,
    draftValid: false,
    approved: false,
    rejected: false,
    ...partial,
  }
}

function bumpAttempt(
  counts: AiOsDraftFactoryDurableLeadState["attemptCounts"],
  key: keyof AiOsDraftFactoryDurableLeadState["attemptCounts"] | undefined,
): AiOsDraftFactoryDurableLeadState["attemptCounts"] {
  if (!key) return counts
  return { ...counts, [key]: counts[key] + 1 }
}

/**
 * Canonical advancement entry — load durable state, lease, recompute, one stage, persist, release.
 */
export async function advanceDraftFactoryForLead(
  input: AdvanceDraftFactoryForLeadInput,
): Promise<AiOsDraftFactoryAdvanceResultV5> {
  const repo = input.repository ?? createMemoryDraftFactoryRepository("memory")
  const now = input.now
  const wakeType = normalizeDraftFactoryWake(input.wake)
  const wakeObj: AiOsDraftFactoryWakeInput =
    typeof input.wake === "string" ? { type: input.wake } : input.wake
  const sourceId =
    wakeObj.requestId ??
    wakeObj.eventId ??
    wakeObj.sourceVersion ??
    wakeObj.sourceId ??
    `${wakeType}`
  const wakeFingerprint = buildDraftFactoryWakeFingerprint({
    organizationId: input.organizationId,
    leadId: input.leadId,
    wakeType,
    sourceVersionOrEventId: sourceId,
  })

  const existingReceipt = await repo.getWakeReceipt(input.organizationId, input.leadId, wakeFingerprint)
  if (existingReceipt) {
    const existing = await repo.getLeadState(input.organizationId, input.leadId)
    const state =
      existing ??
      reconstructDraftFactoryStateFromCanonicalData({
        organizationId: input.organizationId,
        leadId: input.leadId,
        evidence: defaultEvidence(input.evidence),
        now,
      })
    const noop = buildAdvanceResultV5({
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeType,
      wakeFingerprint,
      outcome: "duplicate_noop",
      previous: existing,
      next: state,
      stageEvaluated: state.earliestIncompleteStage,
      reason: "Duplicate wake fingerprint — successful no-op.",
      duplicate: true,
      now,
    })
    await repo.appendTransition(noop)
    return noop
  }

  const workerId = input.workerId ?? `df-durable:${now}`
  const leased = await repo.tryAcquireLease({
    organizationId: input.organizationId,
    leadId: input.leadId,
    workerId,
    now,
  })
  if (!leased) {
    const existing = await repo.getLeadState(input.organizationId, input.leadId)
    const state =
      existing ??
      reconstructDraftFactoryStateFromCanonicalData({
        organizationId: input.organizationId,
        leadId: input.leadId,
        evidence: defaultEvidence(input.evidence),
        now,
      })
    const blocked = buildAdvanceResultV5({
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeType,
      wakeFingerprint,
      outcome: "duplicate_noop",
      previous: existing,
      next: state,
      stageEvaluated: null,
      reason: "Concurrent lease held — stage not re-run.",
      duplicate: true,
      now,
    })
    // Do not record fingerprint on lease miss — other worker owns this wake.
    await repo.appendTransition(blocked)
    return blocked
  }

  try {
    let previous = await repo.getLeadState(input.organizationId, input.leadId)
    let evidence = defaultEvidence(input.evidence)

    // Reconstruct missing durable row from canonical evidence.
    if (!previous) {
      previous = reconstructDraftFactoryStateFromCanonicalData({
        organizationId: input.organizationId,
        leadId: input.leadId,
        evidence,
        now,
      })
      await repo.upsertLeadState(previous)
    } else {
      // Merge persisted package / ids into evidence.
      evidence = {
        ...evidence,
        packageId: evidence.packageId ?? previous.packageId,
        researchRunId: evidence.researchRunId ?? previous.researchRunId,
        decisionMakerId: evidence.decisionMakerId ?? previous.decisionMakerId,
        personalizationId: evidence.personalizationId ?? previous.personalizationId,
        draftValid: evidence.draftValid || Boolean(previous.packageId),
      }
    }

    const hints = input.completionHints ?? {}

    // Retry gate — integrity reconcile bypasses wake timing for historical downstream violations.
    if (
      !hints.admissionIntegrityReconcile &&
      previous.nextEligibleWakeAt &&
      Date.parse(previous.nextEligibleWakeAt) > Date.parse(now)
    ) {
      const early = buildAdvanceResultV5({
        organizationId: input.organizationId,
        leadId: input.leadId,
        wakeType,
        wakeFingerprint,
        outcome: "waiting",
        previous,
        next: previous,
        stageEvaluated: previous.earliestIncompleteStage,
        reason: `Retry not yet eligible until ${previous.nextEligibleWakeAt}.`,
        duplicate: false,
        now,
      })
      await repo.recordWakeReceipt({
        organizationId: input.organizationId,
        leadId: input.leadId,
        wakeFingerprint,
        wakeType,
        outcome: early.outcome,
        transitionSummary: { reason: early.reason },
        createdAt: now,
      })
      await repo.appendTransition(early)
      return early
    }

    evidence = applyWakeInvalidationToEvidence(evidence, wakeType, wakeObj.rejectionScope)

    // Existing valid package → do not regenerate (unless invalidation cleared it).
    if (evidence.draftValid && evidence.packageId && wakeType !== "manual_rebuild" && wakeType !== "approval_rejected") {
      const stage = resolveEarliestIncompleteDurableStage(evidence)
      if (stage === "approval" || stage === "complete") {
        const nextState: AiOsDraftFactoryDurableLeadState = {
          ...previous,
          state: "waiting_for_approval",
          earliestIncompleteStage: "approval",
          packageId: evidence.packageId,
          lastWakeType: wakeType,
          lastWakeAt: now,
          nextEligibleWakeAt: null,
          updatedAt: now,
        }
        await repo.upsertLeadState(nextState, previous.version)
        const result = buildAdvanceResultV5({
          organizationId: input.organizationId,
          leadId: input.leadId,
          wakeType,
          wakeFingerprint,
          outcome: "duplicate_noop",
          previous,
          next: nextState,
          stageEvaluated: "approval",
          reason: "Existing valid approval package linked — not regenerated.",
          duplicate: true,
          now,
        })
        await repo.recordWakeReceipt({
          organizationId: input.organizationId,
          leadId: input.leadId,
          wakeFingerprint,
          wakeType,
          outcome: result.outcome,
          transitionSummary: { packageId: nextState.packageId },
          createdAt: now,
        })
        await repo.appendTransition(result)
        return result
      }
    }

    let plan = planDurableStageAdvance({
      evidence,
      wake: wakeType,
      now,
      attemptCounts: previous.attemptCounts,
      inFlightResearch: hints.inFlightResearch,
      inFlightDatamoon: hints.inFlightDatamoon,
      generationCapacityAvailable: hints.generationCapacityAvailable,
      portfolioDeferred: hints.portfolioDeferred,
      providerTimeout: hints.providerTimeout,
      terminalNoResult: hints.terminalNoResult,
      growth5fOnly: true,
    })

    let nextEvidence = plan.nextEvidence

    // Auto-complete stage facts from completion wakes (map wake → stage explicitly).
    const wakeStageCompletion: Partial<
      Record<AiOsDraftFactoryCanonicalWake, Parameters<typeof applyStageCompletionFact>[1]>
    > = {
      research_completed: "research",
      datamoon_person_completed: "decision_maker",
      decision_maker_discovered: "decision_maker",
      contact_verified: "contact_verification",
      personalization_improved: "personalization",
      generation_completed: "generation",
      approval_package_created: "generation",
    }

    const mappedStage = wakeStageCompletion[wakeType]
    if (mappedStage || hints.completeCurrentStage) {
      const stage =
        mappedStage ??
        plan.stageEvaluated ??
        resolveEarliestIncompleteDurableStage(nextEvidence)
      // AUTONOMY-1F — when Growth 5F is injected, do not stub-complete generation
      // before the generator runs (would skip generateViaGrowth5F entirely).
      const deferGenerationToGrowth5F = stage === "generation" && Boolean(input.generateViaGrowth5F)
      if (
        stage &&
        !deferGenerationToGrowth5F &&
        stage !== "complete" &&
        stage !== "approval" &&
        stage !== "qualification" &&
        stage !== "investment"
      ) {
        nextEvidence = applyStageCompletionFact(nextEvidence, stage, {
          packageId: hints.packageId,
          researchRunId: wakeType === "research_completed" ? String(sourceId) : nextEvidence.researchRunId,
          decisionMakerId:
            wakeType === "datamoon_person_completed" || wakeType === "decision_maker_discovered"
              ? String(sourceId)
              : nextEvidence.decisionMakerId,
        })
        plan = {
          ...plan,
          stageEvaluated: stage,
          outcome: "completed",
          reason: `Stage ${stage} advanced from wake ${wakeType}.`,
          nextEvidence,
        }
      }
    }

    // Generation via Growth 5F only when this wake is targeting generation (one stage per wake).
    const stageNow = resolveEarliestIncompleteDurableStage(nextEvidence)
    const generationWakes: AiOsDraftFactoryCanonicalWake[] = [
      "generation_required",
      "generation_completed",
      "capacity_available",
      "approval_package_created",
      "portfolio_selected",
      "scheduled_resume",
    ]
    const mayGenerateThisWake =
      generationWakes.includes(wakeType) ||
      (hints.completeCurrentStage === true && (plan.stageEvaluated === "generation" || mappedStage === "generation"))

    if (
      mayGenerateThisWake &&
      stageNow === "generation" &&
      hints.generationCapacityAvailable !== false &&
      !hints.portfolioDeferred &&
      !nextEvidence.stopInvestment &&
      nextEvidence.portfolioSelected
    ) {
      if (hints.decisionEnforcementBlocked) {
        plan = {
          stageEvaluated: "generation",
          outcome: "deferred",
          reason: `Canonical decision enforcement: ${hints.canonicalDecisionEnforcementOutcome ?? "blocked"}.`,
          nextEvidence,
          nextEligibleWakeAt: hints.decisionNextEligibleWakeAt ?? null,
        }
      } else {
      const packagesToday = await repo.getPackagesProducedToday(input.organizationId, now)
      if (packagesToday >= AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay) {
        plan = {
          stageEvaluated: "generation",
          outcome: "deferred",
          reason: "Daily package capacity exhausted — defer.",
          nextEvidence,
          nextEligibleWakeAt: null,
        }
      } else if (input.generateViaGrowth5F) {
        const pkg = await input.generateViaGrowth5F({
          organizationId: input.organizationId,
          leadId: input.leadId,
          now,
        })
        if (
          pkg &&
          pkg.pendingHumanApproval === true &&
          pkg.transportBlocked === true
        ) {
          nextEvidence = applyStageCompletionFact(nextEvidence, "generation", {
            packageId: pkg.packageId,
          })
          await repo.incrementPackagesProduced(input.organizationId, now)
          plan = {
            stageEvaluated: "generation",
            outcome: "completed",
            reason: "Growth 5F generated approval package — stop at waiting_for_approval.",
            nextEvidence,
            nextEligibleWakeAt: null,
            incrementAttempt: "generation",
          }
        } else if (pkg) {
          plan = {
            stageEvaluated: "generation",
            outcome: "terminal_failure",
            reason: "Refused package missing pendingHumanApproval/transportBlocked.",
            nextEvidence: { ...nextEvidence, failed: true },
            nextEligibleWakeAt: null,
          }
        }
      } else if (hints.completeCurrentStage || wakeType === "generation_completed" || wakeType === "capacity_available") {
        // Cert path without live 5F — still mark as Growth-5F-only contract when hint supplies package.
        const packageId = hints.packageId ?? `growth5f:${input.leadId}:${now}`
        nextEvidence = applyStageCompletionFact(nextEvidence, "generation", { packageId })
        await repo.incrementPackagesProduced(input.organizationId, now)
        plan = {
          stageEvaluated: "generation",
          outcome: "completed",
          reason: "Growth 5F-only generation path completed (injected/stub).",
          nextEvidence,
          nextEligibleWakeAt: null,
          incrementAttempt: "generation",
        }
      }
      }
    }

    const finalStage = resolveEarliestIncompleteDurableStage(nextEvidence)
    const finalStateName = projectDurableStateFromStage(finalStage, nextEvidence)
    // Terminal approval stop
    const stoppedAtApproval =
      nextEvidence.draftValid &&
      Boolean(nextEvidence.packageId) &&
      !nextEvidence.approved &&
      finalStage === "approval"

    const nextRecord: AiOsDraftFactoryDurableLeadState = {
      ...previous,
      state: stoppedAtApproval ? "waiting_for_approval" : finalStateName,
      earliestIncompleteStage:
        finalStage === "complete" ? (stoppedAtApproval ? "approval" : "complete") : finalStage,
      packageId: nextEvidence.packageId ?? previous.packageId,
      researchRunId: nextEvidence.researchRunId ?? previous.researchRunId,
      decisionMakerId: nextEvidence.decisionMakerId ?? previous.decisionMakerId,
      personalizationId: nextEvidence.personalizationId ?? previous.personalizationId,
      lastWakeType: wakeType,
      lastWakeAt: now,
      nextEligibleWakeAt: plan.nextEligibleWakeAt,
      attemptCounts: bumpAttempt(previous.attemptCounts, plan.incrementAttempt),
      lastErrorCode: plan.outcome.includes("failure") ? plan.outcome : null,
      lastErrorStage: plan.outcome.includes("failure") ? plan.stageEvaluated : null,
      pausedReason:
        plan.outcome === "stopped"
          ? plan.reason.includes("Stop")
            ? "stop_investment"
            : plan.reason
          : plan.outcome === "deferred"
            ? "portfolio_deferred"
            : nextEvidence.stopInvestment
              ? "stop_investment"
              : null,
      leaseOwner: workerId,
      updatedAt: now,
    }

    const wrote = await repo.upsertLeadState(nextRecord, previous.version)
    if (!wrote) {
      const conflict = buildAdvanceResultV5({
        organizationId: input.organizationId,
        leadId: input.leadId,
        wakeType,
        wakeFingerprint,
        outcome: "duplicate_noop",
        previous,
        next: previous,
        stageEvaluated: plan.stageEvaluated,
        reason: "Optimistic version conflict — concurrent advance won.",
        duplicate: true,
        now,
      })
      await repo.appendTransition(conflict)
      return conflict
    }

    const result = buildAdvanceResultV5({
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeType,
      wakeFingerprint,
      outcome: plan.outcome,
      previous,
      next: nextRecord,
      stageEvaluated: plan.stageEvaluated,
      reason: plan.reason,
      duplicate: plan.outcome === "duplicate_noop",
      now,
    })

    await repo.recordWakeReceipt({
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeFingerprint,
      wakeType,
      outcome: result.outcome,
      transitionSummary: {
        previousState: result.previousState,
        nextState: result.nextState,
        previousStage: result.previousStage,
        nextStage: result.nextStage,
        stageEvaluated: result.stageEvaluated,
        packageId: result.packageId,
        pendingHumanApproval: true,
        transportBlocked: true,
      },
      createdAt: now,
    })
    await repo.appendTransition(result)
    return result
  } finally {
    await repo.releaseLease({
      organizationId: input.organizationId,
      leadId: input.leadId,
      workerId,
      now,
    })
  }
}

export async function advanceDraftFactoryBatch(input: {
  organizationId: string
  leads: Array<{
    leadId: string
    wake?: string | AiOsDraftFactoryWakeInput
    evidence?: AiOsDraftFactoryCanonicalEvidence
  }>
  now: string
  workerId?: string
  repository?: DraftFactoryDurableRepository
  generateViaGrowth5F?: AdvanceDraftFactoryForLeadInput["generateViaGrowth5F"]
  completionHints?: AdvanceDraftFactoryForLeadInput["completionHints"]
}): Promise<AiOsDraftFactoryAdvanceResultV5[]> {
  const results: AiOsDraftFactoryAdvanceResultV5[] = []
  for (const lead of input.leads) {
    results.push(
      await advanceDraftFactoryForLead({
        organizationId: input.organizationId,
        leadId: lead.leadId,
        wake: lead.wake ?? "scheduled_resume",
        now: input.now,
        evidence: lead.evidence,
        workerId: input.workerId,
        repository: input.repository,
        generateViaGrowth5F: input.generateViaGrowth5F,
        completionHints: input.completionHints,
      }),
    )
  }
  return results
}

export async function recordDraftFactoryWake(input: {
  organizationId: string
  leadId: string
  wake: string | AiOsDraftFactoryWakeInput
  now: string
  repository?: DraftFactoryDurableRepository
}): Promise<{ wakeType: AiOsDraftFactoryCanonicalWake; wakeFingerprint: string; alreadySeen: boolean }> {
  const repo = input.repository ?? createMemoryDraftFactoryRepository("memory")
  const wakeType = normalizeDraftFactoryWake(input.wake)
  const wakeObj: AiOsDraftFactoryWakeInput =
    typeof input.wake === "string" ? { type: input.wake } : input.wake
  const sourceId =
    wakeObj.requestId ?? wakeObj.eventId ?? wakeObj.sourceVersion ?? wakeObj.sourceId ?? wakeType
  const wakeFingerprint = buildDraftFactoryWakeFingerprint({
    organizationId: input.organizationId,
    leadId: input.leadId,
    wakeType,
    sourceVersionOrEventId: sourceId,
  })
  const alreadySeen = Boolean(await repo.getWakeReceipt(input.organizationId, input.leadId, wakeFingerprint))
  return { wakeType, wakeFingerprint, alreadySeen }
}

export async function listDueDraftFactoryStates(input: {
  organizationId: string
  now: string
  limit?: number
  repository?: DraftFactoryDurableRepository
}): Promise<AiOsDraftFactoryDurableLeadState[]> {
  const repo = input.repository ?? createMemoryDraftFactoryRepository("memory")
  return repo.listDueStates(input)
}

export async function listAdmissionIntegrityReconcileDraftFactoryStates(input: {
  organizationId: string
  limit?: number
  repository?: DraftFactoryDurableRepository
}): Promise<AiOsDraftFactoryDurableLeadState[]> {
  const repo = input.repository ?? createMemoryDraftFactoryRepository("memory")
  return repo.listAdmissionIntegrityReconcileStates(input)
}

/**
 * Capacity wake: SV1-1 eligibility is assumed embedded in portfolio candidates;
 * SV1-2 selects which deferred leads advance; remainder stay deferred.
 */
export async function advanceDraftFactoryCapacityWake(input: {
  organizationId: string
  capacityClass: AiOsPortfolioCapacityClass
  capacitySlotsAvailable: number
  now: string
  candidates: Array<{
    leadId: string
    companyId?: string | null
    investmentState: "increase_investment" | "maintain_investment" | "pending_investment" | "reduce_investment" | "stop_investment"
    spendAuthorized?: boolean
    signals?: Record<string, unknown>
    evidence?: AiOsDraftFactoryCanonicalEvidence
  }>
  workerId?: string
  repository?: DraftFactoryDurableRepository
  generateViaGrowth5F?: AdvanceDraftFactoryForLeadInput["generateViaGrowth5F"]
}): Promise<{
  qaMarker: typeof AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER
  selectedLeadIds: string[]
  deferredLeadIds: string[]
  results: AiOsDraftFactoryAdvanceResultV5[]
}> {
  const portfolio = evaluatePortfolioAllocationFacade({
    organizationId: input.organizationId,
    capacityClass: input.capacityClass,
    capacitySlotsAvailable: input.capacitySlotsAvailable,
    decidedAt: input.now,
    candidates: input.candidates.map((c, index) => ({
      leadId: c.leadId,
      organizationId: input.organizationId,
      companyName: c.companyId ?? null,
      investmentState: c.investmentState,
      spendAuthorized: c.spendAuthorized ?? c.investmentState === "increase_investment",
      signals: {
        missionAligned: true,
        missionPriorityOverall:
          typeof c.signals?.missionPriorityOverall === "number"
            ? (c.signals.missionPriorityOverall as number)
            : 100 - index,
        dailyQueueSortScore:
          typeof c.signals?.dailyQueueSortScore === "number"
            ? (c.signals.dailyQueueSortScore as number)
            : 100 - index,
      },
    })),
  })

  const selected = new Set(portfolio.selectedLeadIds)
  const deferredLeadIds = input.candidates.filter((c) => !selected.has(c.leadId)).map((c) => c.leadId)
  const results: AiOsDraftFactoryAdvanceResultV5[] = []

  for (const c of input.candidates) {
    if (!selected.has(c.leadId)) {
      // Leave deferred — record portfolio_deferred wake without billable advance.
      const deferred = await advanceDraftFactoryForLead({
        organizationId: input.organizationId,
        leadId: c.leadId,
        wake: { type: "portfolio_deferred", sourceId: `capacity:${input.capacityClass}:${input.now}` },
        now: input.now,
        evidence: {
          ...defaultEvidence(c.evidence),
          portfolioSelected: false,
          investmentState: c.investmentState,
        },
        workerId: input.workerId,
        repository: input.repository,
        completionHints: { portfolioDeferred: true },
      })
      results.push(deferred)
      continue
    }

    const advanced = await advanceDraftFactoryForLead({
      organizationId: input.organizationId,
      leadId: c.leadId,
      wake: { type: "capacity_available", sourceId: `capacity:${input.capacityClass}:${input.now}:${c.leadId}` },
      now: input.now,
      evidence: {
        ...defaultEvidence(c.evidence),
        portfolioSelected: true,
        investmentState: c.investmentState,
      },
      workerId: input.workerId,
      repository: input.repository,
      generateViaGrowth5F: input.generateViaGrowth5F,
      completionHints: {
        completeCurrentStage: true,
        generationCapacityAvailable: true,
      },
    })
    results.push(advanced)
  }

  return {
    qaMarker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
    selectedLeadIds: [...selected],
    deferredLeadIds,
    results,
  }
}

export async function getDeferredDraftFactoryStates(
  organizationId: string,
  repository?: DraftFactoryDurableRepository,
): Promise<AiOsDraftFactoryDurableLeadState[]> {
  const repo = repository ?? createMemoryDraftFactoryRepository("memory")
  return repo.listDeferredStates(organizationId)
}

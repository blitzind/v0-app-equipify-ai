/** SV1-5 — Durable Draft Factory pure engine (client-safe). */

import {
  AI_OS_DRAFT_FACTORY_CANONICAL_WAKES,
  AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  AI_OS_DRAFT_FACTORY_WAKE_NORMALIZATION,
  emptyAttemptCounts,
  type AiOsDraftFactoryAdvanceOutcome,
  type AiOsDraftFactoryAdvanceResultV5,
  type AiOsDraftFactoryCanonicalEvidence,
  type AiOsDraftFactoryCanonicalWake,
  type AiOsDraftFactoryDurableLeadState,
  type AiOsDraftFactoryDurableStage,
  type AiOsDraftFactoryDurableState,
  type AiOsDraftFactoryWakeInput,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"

export const AI_OS_DRAFT_FACTORY_RETRY_BACKOFF_MS = {
  research: [5 * 60_000, 15 * 60_000, 60 * 60_000],
  decision_maker: [10 * 60_000, 30 * 60_000, 2 * 60 * 60_000],
  contact_verification: [5 * 60_000, 15 * 60_000, 60 * 60_000],
  personalization: [5 * 60_000, 15 * 60_000, 45 * 60_000],
  generation: [10 * 60_000, 30 * 60_000, 2 * 60 * 60_000],
} as const

export function normalizeDraftFactoryWake(wake: string | AiOsDraftFactoryWakeInput): AiOsDraftFactoryCanonicalWake {
  const raw = typeof wake === "string" ? wake : wake.type
  const mapped = AI_OS_DRAFT_FACTORY_WAKE_NORMALIZATION[raw] ?? (raw as AiOsDraftFactoryCanonicalWake)
  if ((AI_OS_DRAFT_FACTORY_CANONICAL_WAKES as readonly string[]).includes(mapped)) {
    return mapped
  }
  return "scheduled_resume"
}

export function buildDraftFactoryWakeFingerprint(input: {
  organizationId: string
  leadId: string
  wakeType: AiOsDraftFactoryCanonicalWake
  sourceVersionOrEventId?: string | null
}): string {
  const source = (input.sourceVersionOrEventId ?? "none").trim() || "none"
  return `${input.organizationId}:${input.leadId}:${input.wakeType}:${source}`
}

export function resolveEarliestIncompleteDurableStage(
  evidence: AiOsDraftFactoryCanonicalEvidence,
): AiOsDraftFactoryDurableStage {
  if (evidence.paused) return "complete"
  if (evidence.failed) return "complete"
  if (evidence.approved) return "complete"
  if (evidence.stopInvestment) return "investment"
  if (!evidence.admitted) return "qualification"
  if (!evidence.researchCurrent || !evidence.knowledgeComplete) return "research"
  if (evidence.investmentState === "stop_investment") return "investment"
  if (!evidence.portfolioSelected) return "portfolio"
  if (!evidence.decisionMakerAvailable) return "decision_maker"
  if (!evidence.contactVerifiedForEmail) return "contact_verification"
  if (!evidence.personalizationReady) return "personalization"
  if (!evidence.draftValid) return "generation"
  if (!evidence.rejected && evidence.draftValid) return "approval"
  if (evidence.rejected) return "generation"
  return "complete"
}

export function projectDurableStateFromStage(
  stage: AiOsDraftFactoryDurableStage,
  evidence: AiOsDraftFactoryCanonicalEvidence,
): AiOsDraftFactoryDurableState {
  if (evidence.paused) return "paused"
  if (evidence.failed) return "failed"
  if (evidence.approved) return "approved"
  if (evidence.rejected && stage === "generation") return "rejected"
  if (evidence.stopInvestment || evidence.investmentState === "stop_investment") return "paused"
  switch (stage) {
    case "research":
    case "qualification":
      return "waiting_for_research"
    case "investment":
    case "portfolio":
      return evidence.portfolioSelected ? "research_complete" : "paused"
    case "decision_maker":
      return "waiting_for_dm"
    case "contact_verification":
      return "waiting_for_contact_verification"
    case "personalization":
      return "waiting_for_personalization"
    case "generation":
      return "waiting_for_generation"
    case "approval":
      return "waiting_for_approval"
    case "complete":
      return evidence.draftValid ? "waiting_for_approval" : "draft_ready"
    default:
      return "waiting_for_research"
  }
}

/**
 * Apply wake invalidation rules to evidence before stage recompute.
 * Does not invent facts — only clears completion flags that must be revalidated.
 */
export function applyWakeInvalidationToEvidence(
  evidence: AiOsDraftFactoryCanonicalEvidence,
  wake: AiOsDraftFactoryCanonicalWake,
  rejectionScope?: AiOsDraftFactoryWakeInput["rejectionScope"],
): AiOsDraftFactoryCanonicalEvidence {
  const next = { ...evidence }

  switch (wake) {
    case "company_changed":
      next.researchCurrent = false
      next.knowledgeComplete = false
      next.decisionMakerAvailable = false
      next.contactVerifiedForEmail = false
      next.personalizationReady = false
      next.draftValid = false
      next.packageId = null
      break
    case "research_became_stale":
    case "research_failed":
      next.researchCurrent = false
      next.personalizationReady = next.personalizationReady && false
      next.draftValid = false
      next.packageId = null
      break
    case "mission_changed":
      // Reevaluate investment/portfolio/personalization/package; keep company research facts.
      next.portfolioSelected = false
      next.personalizationReady = false
      next.draftValid = false
      next.packageId = null
      break
    case "decision_maker_rejected":
      next.decisionMakerAvailable = false
      next.decisionMakerId = null
      next.contactVerifiedForEmail = false
      next.personalizationReady = false
      next.draftValid = false
      next.packageId = null
      break
    case "approval_rejected": {
      const scope = rejectionScope ?? "copy"
      next.rejected = true
      next.approved = false
      if (scope === "account" || scope === "qualification") {
        next.admitted = false
        next.draftValid = false
        next.packageId = null
        next.personalizationReady = false
      } else if (scope === "person") {
        next.decisionMakerAvailable = false
        next.contactVerifiedForEmail = false
        next.personalizationReady = false
        next.draftValid = false
        next.packageId = null
      } else if (scope === "channel" || scope === "sequence" || scope === "copy") {
        next.draftValid = false
        next.packageId = null
        // Keep person + research.
      }
      break
    }
    case "manual_rebuild":
      next.draftValid = false
      next.packageId = null
      next.approved = false
      next.rejected = false
      break
    case "datamoon_person_completed":
    case "decision_maker_discovered":
      next.decisionMakerAvailable = true
      break
    case "contact_verified":
      next.contactVerifiedForEmail = true
      break
    case "personalization_improved":
      next.personalizationReady = true
      next.draftValid = false
      break
    case "approval_package_created":
    case "generation_completed":
      next.draftValid = true
      break
    case "portfolio_selected":
      next.portfolioSelected = true
      break
    case "portfolio_deferred":
      next.portfolioSelected = false
      break
    default:
      break
  }

  return next
}

export function computeRetryEligibleAt(input: {
  stage: AiOsDraftFactoryDurableStage
  attempt: number
  nowMs: number
}): string {
  const key =
    input.stage === "decision_maker"
      ? "decision_maker"
      : input.stage === "contact_verification"
        ? "contact_verification"
        : input.stage === "personalization"
          ? "personalization"
          : input.stage === "generation"
            ? "generation"
            : "research"
  const schedule = AI_OS_DRAFT_FACTORY_RETRY_BACKOFF_MS[key]
  const idx = Math.min(Math.max(0, input.attempt - 1), schedule.length - 1)
  return new Date(input.nowMs + schedule[idx]).toISOString()
}

export function reconstructDraftFactoryStateFromCanonicalData(input: {
  organizationId: string
  leadId: string
  evidence: AiOsDraftFactoryCanonicalEvidence
  now: string
  existing?: AiOsDraftFactoryDurableLeadState | null
}): AiOsDraftFactoryDurableLeadState {
  const stage = resolveEarliestIncompleteDurableStage(input.evidence)
  const state = projectDurableStateFromStage(stage, input.evidence)
  const now = input.now
  if (input.existing) {
    return {
      ...input.existing,
      state,
      earliestIncompleteStage: stage === "complete" ? "approval" : stage,
      packageId: input.evidence.packageId ?? input.existing.packageId,
      researchRunId: input.evidence.researchRunId ?? input.existing.researchRunId,
      decisionMakerId: input.evidence.decisionMakerId ?? input.existing.decisionMakerId,
      personalizationId: input.evidence.personalizationId ?? input.existing.personalizationId,
      updatedAt: now,
    }
  }
  return {
    organizationId: input.organizationId,
    leadId: input.leadId,
    state,
    earliestIncompleteStage: stage === "complete" ? (input.evidence.draftValid ? "approval" : "complete") : stage,
    version: 1,
    packageId: input.evidence.packageId ?? null,
    researchRunId: input.evidence.researchRunId ?? null,
    decisionMakerId: input.evidence.decisionMakerId ?? null,
    personalizationId: input.evidence.personalizationId ?? null,
    lastWakeType: null,
    lastWakeAt: null,
    nextEligibleWakeAt: null,
    attemptCounts: emptyAttemptCounts(),
    lastErrorCode: null,
    lastErrorStage: null,
    pausedReason: input.evidence.stopInvestment ? "stop_investment" : null,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export type DurableStageExecutionPlan = {
  stageEvaluated: AiOsDraftFactoryDurableStage | null
  outcome: AiOsDraftFactoryAdvanceOutcome
  reason: string
  nextEvidence: AiOsDraftFactoryCanonicalEvidence
  nextEligibleWakeAt: string | null
  incrementAttempt?: keyof AiOsDraftFactoryDurableLeadState["attemptCounts"]
}

/**
 * Plan one-stage advancement from recomputed earliest incomplete stage.
 * Does not call providers — caller executes side effects then re-plans with updated evidence.
 */
export function planDurableStageAdvance(input: {
  evidence: AiOsDraftFactoryCanonicalEvidence
  wake: AiOsDraftFactoryCanonicalWake
  now: string
  attemptCounts: AiOsDraftFactoryDurableLeadState["attemptCounts"]
  inFlightResearch?: boolean
  inFlightDatamoon?: boolean
  generationCapacityAvailable?: boolean
  portfolioDeferred?: boolean
  providerTimeout?: boolean
  terminalNoResult?: boolean
  growth5fOnly?: boolean
}): DurableStageExecutionPlan {
  const evidence = applyWakeInvalidationToEvidence(input.evidence, input.wake)
  const stage = resolveEarliestIncompleteDurableStage(evidence)
  const nowMs = Date.parse(input.now)

  if (evidence.stopInvestment || evidence.investmentState === "stop_investment") {
    return {
      stageEvaluated: "investment",
      outcome: "stopped",
      reason: "Stop Investment — scarce downstream work halted.",
      nextEvidence: { ...evidence, paused: true },
      nextEligibleWakeAt: null,
    }
  }

  if (evidence.draftValid && evidence.packageId && stage === "approval") {
    return {
      stageEvaluated: "approval",
      outcome: "duplicate_noop",
      reason: "Valid approval package already exists — reuse, do not regenerate.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
    }
  }

  if (stage === "research") {
    if (input.inFlightResearch) {
      return {
        stageEvaluated: "research",
        outcome: "waiting",
        reason: "Research currently running — wait.",
        nextEvidence: evidence,
        nextEligibleWakeAt: null,
      }
    }
    if (input.providerTimeout) {
      const attempt = input.attemptCounts.research + 1
      return {
        stageEvaluated: "research",
        outcome: "retryable_failure",
        reason: "Provider temporary timeout — schedule backoff retry.",
        nextEvidence: evidence,
        nextEligibleWakeAt: computeRetryEligibleAt({ stage: "research", attempt, nowMs }),
        incrementAttempt: "research",
      }
    }
    // Mark research needed; caller may start research. For pure plan with no side effect, stay waiting.
    return {
      stageEvaluated: "research",
      outcome: "waiting",
      reason: "Research required — emit research_required wake / wait for completion.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
      incrementAttempt: "research",
    }
  }

  if (stage === "qualification") {
    return {
      stageEvaluated: "qualification",
      outcome: evidence.admitted ? "completed" : "terminal_failure",
      reason: evidence.admitted
        ? "Qualification reused from admission recommendation."
        : "Invalid company identity / admission — terminal for autonomous prep.",
      nextEvidence: evidence.admitted ? evidence : { ...evidence, failed: true },
      nextEligibleWakeAt: null,
    }
  }

  if (stage === "investment") {
    return {
      stageEvaluated: "investment",
      outcome: "stopped",
      reason: "Investment gate blocked scarce work.",
      nextEvidence: { ...evidence, paused: true },
      nextEligibleWakeAt: null,
    }
  }

  if (stage === "portfolio" || input.portfolioDeferred) {
    return {
      stageEvaluated: "portfolio",
      outcome: "deferred",
      reason: "No eligible portfolio slot — preserve state and wait for capacity.",
      nextEvidence: { ...evidence, portfolioSelected: false },
      nextEligibleWakeAt: null,
    }
  }

  if (stage === "decision_maker") {
    if (input.inFlightDatamoon) {
      return {
        stageEvaluated: "decision_maker",
        outcome: "waiting",
        reason: "Recent in-flight DataMoon request — wait, do not request again.",
        nextEvidence: evidence,
        nextEligibleWakeAt: null,
      }
    }
    if (input.terminalNoResult) {
      return {
        stageEvaluated: "decision_maker",
        outcome: "stopped",
        reason: "Terminal no-result — do not repeatedly spend DataMoon credits.",
        nextEvidence: { ...evidence, paused: true },
        nextEligibleWakeAt: null,
        incrementAttempt: "decisionMaker",
      }
    }
    if (input.providerTimeout) {
      const attempt = input.attemptCounts.decisionMaker + 1
      return {
        stageEvaluated: "decision_maker",
        outcome: "retryable_failure",
        reason: "DataMoon temporary timeout — backoff without tight loop.",
        nextEvidence: evidence,
        nextEligibleWakeAt: computeRetryEligibleAt({ stage: "decision_maker", attempt, nowMs }),
        incrementAttempt: "decisionMaker",
      }
    }
    return {
      stageEvaluated: "decision_maker",
      outcome: "waiting",
      reason: "Decision maker required — waiting for DataMoon / canonical person.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
      incrementAttempt: "decisionMaker",
    }
  }

  if (stage === "contact_verification") {
    return {
      stageEvaluated: "contact_verification",
      outcome: "waiting",
      reason: "Contact verification required for planned channel — do not fabricate contact data.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
      incrementAttempt: "contactVerification",
    }
  }

  if (stage === "personalization") {
    return {
      stageEvaluated: "personalization",
      outcome: "waiting",
      reason: "Personalization not ready — reuse existing systems; do not regenerate valid current packs.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
      incrementAttempt: "personalization",
    }
  }

  if (stage === "generation") {
    if (input.generationCapacityAvailable === false) {
      return {
        stageEvaluated: "generation",
        outcome: "deferred",
        reason: "LLM drafting capacity unavailable — defer.",
        nextEvidence: evidence,
        nextEligibleWakeAt: null,
      }
    }
    // Growth 5F only — caller must invoke 5F; plan marks waiting_for_generation → completed when draftValid.
    return {
      stageEvaluated: "generation",
      outcome: "waiting",
      reason: "Generation required via Growth 5F only.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
      incrementAttempt: "generation",
    }
  }

  if (stage === "approval" || stage === "complete") {
    return {
      stageEvaluated: "approval",
      outcome: "completed",
      reason: "Approval package terminal for autonomous preparation — stop at waiting_for_approval.",
      nextEvidence: evidence,
      nextEligibleWakeAt: null,
    }
  }

  return {
    stageEvaluated: stage,
    outcome: "waiting",
    reason: "No eligible stage action.",
    nextEvidence: evidence,
    nextEligibleWakeAt: null,
  }
}

/**
 * Simulate applying a completed stage fact (for certs / wake completions).
 */
export function applyStageCompletionFact(
  evidence: AiOsDraftFactoryCanonicalEvidence,
  stage: AiOsDraftFactoryDurableStage,
  facts?: Partial<AiOsDraftFactoryCanonicalEvidence>,
): AiOsDraftFactoryCanonicalEvidence {
  const next = { ...evidence, ...facts }
  switch (stage) {
    case "research":
      next.researchCurrent = true
      next.knowledgeComplete = true
      break
    case "qualification":
      next.admitted = true
      break
    case "portfolio":
      next.portfolioSelected = true
      break
    case "decision_maker":
      next.decisionMakerAvailable = true
      break
    case "contact_verification":
      next.contactVerifiedForEmail = true
      break
    case "personalization":
      next.personalizationReady = true
      break
    case "generation":
      next.draftValid = true
      next.packageId = facts?.packageId ?? next.packageId ?? `pkg:${Date.now()}`
      break
    case "approval":
      break
    default:
      break
  }
  return next
}

export function buildAdvanceResultV5(input: {
  organizationId: string
  leadId: string
  wakeType: AiOsDraftFactoryCanonicalWake
  wakeFingerprint: string
  outcome: AiOsDraftFactoryAdvanceOutcome
  previous: AiOsDraftFactoryDurableLeadState | null
  next: AiOsDraftFactoryDurableLeadState
  stageEvaluated: AiOsDraftFactoryDurableStage | null
  reason: string
  duplicate: boolean
  now: string
}): AiOsDraftFactoryAdvanceResultV5 {
  return {
    qaMarker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    wakeType: input.wakeType,
    wakeFingerprint: input.wakeFingerprint,
    outcome: input.outcome,
    previousState: input.previous?.state ?? null,
    nextState: input.next.state,
    previousStage: input.previous?.earliestIncompleteStage ?? null,
    nextStage: input.next.earliestIncompleteStage,
    stageEvaluated: input.stageEvaluated,
    reason: input.reason,
    packageId: input.next.packageId,
    transportBlocked: true,
    pendingHumanApproval: true,
    duplicate: input.duplicate,
    state: input.next,
    decidedAt: input.now,
  }
}

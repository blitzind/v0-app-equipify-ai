/**
 * SV1-3 — Autonomous Draft Factory engine (client-safe).
 * Orchestrates stage resume. Does not send, enroll, or bypass transport_blocked.
 * Does not replace Growth 5F draft generation — only plans and resumes around it.
 */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  AI_OS_DRAFT_FACTORY_CAPACITY,
  AI_OS_DRAFT_FACTORY_DEFAULT_MODE,
  AI_OS_DRAFT_FACTORY_QA_MARKER,
  AI_OS_DRAFT_FACTORY_STAGES,
  AI_OS_DRAFT_FACTORY_STATES,
  type AiOsDraftFactoryAdvanceResult,
  type AiOsDraftFactoryBatchResult,
  type AiOsDraftFactoryExplainability,
  type AiOsDraftFactoryLeadRecord,
  type AiOsDraftFactoryMode,
  type AiOsDraftFactoryPackage,
  type AiOsDraftFactorySignals,
  type AiOsDraftFactoryStage,
  type AiOsDraftFactoryStageFlags,
  type AiOsDraftFactoryState,
  type AiOsDraftFactoryWakeSource,
} from "@/lib/growth/draft-factory/draft-factory-types"

function isTerminalBlocking(state: AiOsDraftFactoryState): boolean {
  return state === "paused" || state === "failed" || state === "executed"
}

export function buildDraftFactoryStageFlags(signals: AiOsDraftFactorySignals): AiOsDraftFactoryStageFlags {
  const admission = signals.admissionState ?? "unknown"
  const admitted = admission === "accepted" || admission === "review"
  const researchCurrent = signals.researchFresh === true || (signals.hasUsableResearch === true && signals.researchStale !== true)
  const knowledgeComplete = signals.knowledgeComplete === true || (researchCurrent && signals.hasUsableResearch === true)
  const investmentEligible =
    signals.killSwitchActive !== true &&
    signals.investmentState !== "stop_investment" &&
    signals.investmentState !== "reduce_investment" &&
    (signals.investmentState === "increase_investment" ||
      (signals.spendAuthorized === true && signals.investmentState != null))
  // Draft generation requires increase (or maintain with existing track) + portfolio selection for scarce drafting.
  const portfolioSelected = signals.portfolioSelected === true
  const decisionMakerAvailable =
    signals.hasPrimaryDecisionMaker === true ||
    signals.hasContactName === true ||
    signals.decisionMakerStatus === "confirmed" ||
    signals.decisionMakerStatus === "verified_contactable" ||
    signals.decisionMakerStatus === "suspected"
  const personalizationReady =
    signals.personalizationReady === true || (knowledgeComplete && decisionMakerAvailable)
  const draftValid = signals.hasRecentApprovalPackage === true
  const approved = signals.approvalDecision === "approved"
  const rejected = signals.approvalDecision === "rejected"
  const inApprovalQueue = draftValid && !approved && !rejected

  return {
    admitted,
    researchCurrent,
    knowledgeComplete,
    investmentEligible:
      investmentEligible &&
      signals.investmentState !== "stop_investment" &&
      signals.investmentState !== "reduce_investment" &&
      signals.killSwitchActive !== true,
    portfolioSelected,
    decisionMakerAvailable,
    personalizationReady,
    draftValid,
    inApprovalQueue,
    approved,
    rejected,
    executed: false,
    paused: signals.killSwitchActive === true,
    failed: admission === "rejected" || admission === "invalid",
  }
}

/**
 * Map stage completeness → canonical factory state.
 * Exactly one state; no parallel lifecycle.
 */
export function projectDraftFactoryState(flags: AiOsDraftFactoryStageFlags): AiOsDraftFactoryState {
  if (flags.paused) return "paused"
  if (flags.failed) return "failed"
  if (flags.executed) return "executed"
  if (flags.approved) return "approved"
  if (flags.rejected) return "rejected"
  if (flags.inApprovalQueue || (flags.draftValid && !flags.approved)) return "waiting_for_approval"
  if (flags.draftValid) return "draft_ready"
  if (!flags.admitted) return "failed"
  if (!flags.researchCurrent) return "waiting_for_research"
  if (!flags.knowledgeComplete) return "waiting_for_research"
  if (!flags.investmentEligible) return "paused"
  if (!flags.portfolioSelected) return "paused"
  if (!flags.decisionMakerAvailable) return "waiting_for_dm"
  if (!flags.personalizationReady) return "waiting_for_personalization"
  return "waiting_for_generation"
}

/**
 * Earliest incomplete stage for resume. Completed stages are never re-executed.
 */
export function resolveEarliestIncompleteStage(flags: AiOsDraftFactoryStageFlags): AiOsDraftFactoryStage | null {
  if (flags.paused || flags.failed || flags.executed) return null
  if (flags.approved) return null
  if (flags.rejected) return "generation" // rebuild after rejection
  if (!flags.admitted) return "admission"
  if (!flags.researchCurrent || !flags.knowledgeComplete) return "research"
  if (!flags.investmentEligible) return "investment"
  if (!flags.portfolioSelected) return "portfolio"
  if (!flags.decisionMakerAvailable) return "decision_maker"
  if (!flags.personalizationReady) return "personalization"
  if (!flags.draftValid) return "generation"
  if (!flags.inApprovalQueue && !flags.approved) return "approval_queue"
  return null
}

export function listSkippedStagesBefore(stage: AiOsDraftFactoryStage | null): AiOsDraftFactoryStage[] {
  if (!stage) return [...AI_OS_DRAFT_FACTORY_STAGES]
  const index = AI_OS_DRAFT_FACTORY_STAGES.indexOf(stage)
  if (index <= 0) return []
  return AI_OS_DRAFT_FACTORY_STAGES.slice(0, index)
}

export function wakeShouldForceRebuild(wake: AiOsDraftFactoryWakeSource | null | undefined): boolean {
  return wake === "manual_rebuild" || wake === "approval_rejected" || wake === "company_changed"
}

export function applyWakeToFlags(
  flags: AiOsDraftFactoryStageFlags,
  wake: AiOsDraftFactoryWakeSource | null | undefined,
): AiOsDraftFactoryStageFlags {
  if (!wake) return flags
  const next = { ...flags }
  switch (wake) {
    case "stale_research":
    case "company_changed":
      next.researchCurrent = false
      next.knowledgeComplete = false
      next.draftValid = false
      next.inApprovalQueue = false
      break
    case "decision_maker_discovered":
    case "datamoon_person_completed":
    case "contact_verified":
      next.decisionMakerAvailable = true
      break
    case "decision_maker_required":
    case "datamoon_person_requested":
    case "datamoon_person_failed":
    case "contact_verification_failed":
    case "decision_maker_rejected":
      next.decisionMakerAvailable = false
      next.draftValid = false
      next.inApprovalQueue = false
      break
    case "provider_capacity_available":
      // Capacity wake — do not clear DM; allow resume of waiting enrichment.
      break
    case "personalization_improved":
      next.personalizationReady = true
      next.draftValid = false
      next.inApprovalQueue = false
      break
    case "approval_rejected":
      next.rejected = true
      next.approved = false
      next.draftValid = false
      next.inApprovalQueue = false
      break
    case "manual_rebuild":
      next.draftValid = false
      next.inApprovalQueue = false
      next.approved = false
      next.rejected = false
      break
    case "newly_available_capacity":
    case "portfolio_selected":
      next.portfolioSelected = true
      break
    default:
      break
  }
  return next
}

export function buildDraftFactoryExplainability(input: {
  signals: AiOsDraftFactorySignals
  packageSummary?: GrowthAutonomousOutreachApprovalPackage | null
}): AiOsDraftFactoryExplainability {
  const s = input.signals
  const pkg = input.packageSummary
  return {
    whySelected:
      s.selectedBecause?.trim() ||
      (s.portfolioSelected
        ? `Portfolio selected for scarce drafting capacity (investment=${s.investmentState ?? "unknown"}).`
        : "Not yet portfolio-selected — factory will not generate until selected."),
    whyNow:
      s.researchStale === true
        ? "Research was stale and capacity became available."
        : s.portfolioSelected
          ? "Account earned investment and won a portfolio capacity slot now."
          : "Waiting for investment/portfolio eligibility.",
    whyDecisionMaker:
      s.hasPrimaryDecisionMaker || s.hasContactName
        ? `Decision maker available (status=${s.decisionMakerStatus ?? "contact_on_lead"}).`
        : "No decision maker yet — factory resumes at waiting_for_dm.",
    whyOutreach:
      pkg?.expectedOutcome ??
      "Draft-only outreach preparation for human approval; transport remains blocked.",
    whySequence: pkg?.recommendedSequence ?? "email_first_multichannel (from existing execution plan / 5F).",
    whySubject:
      pkg?.generatedAssets.find((asset) => asset.channel === "email")?.preview?.slice(0, 120) ||
      "Subject produced by existing personalization engine at generation stage.",
    whyRecommendation:
      pkg?.recommendedChannel != null
        ? `Recommended channel ${pkg.recommendedChannel} from Communication Plan / 5F package.`
        : "Channel recommendation deferred until generation via Growth 5F.",
    supportingEvidence: [
      ...(pkg?.supportingResearch ?? []).slice(0, 6),
      ...(pkg?.personalizationEvidence ?? []).slice(0, 4),
      s.companySummary ? `Company: ${s.companySummary}` : null,
      s.missionId ? `Mission: ${s.missionId}` : null,
    ].filter((line): line is string => Boolean(line)),
  }
}

export function assembleDraftFactoryPackage(input: {
  organizationId: string
  leadId: string
  companyName: string | null
  signals: AiOsDraftFactorySignals
  factoryState: AiOsDraftFactoryState
  growth5fApprovalPackage: GrowthAutonomousOutreachApprovalPackage | null
  preparedAt: string
}): AiOsDraftFactoryPackage {
  const pkg = input.growth5fApprovalPackage
  const emailAssets = (pkg?.generatedAssets ?? []).filter((asset) => asset.channel === "email")
  const callAsset = (pkg?.generatedAssets ?? []).find((asset) => asset.channel === "call")
  const linkedInAsset = (pkg?.generatedAssets ?? []).find((asset) => asset.channel === "linkedin")
  const explainability = buildDraftFactoryExplainability({
    signals: input.signals,
    packageSummary: pkg,
  })

  return {
    qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
    factoryPackageId: pkg?.packageId ?? `draft-factory:${input.leadId}:${input.preparedAt}`,
    leadId: input.leadId,
    organizationId: input.organizationId,
    companyName: input.companyName ?? pkg?.companyName ?? null,
    companySummary: input.signals.companySummary?.trim() || `${input.companyName ?? "Account"} — research-backed draft package.`,
    decisionMaker: {
      available:
        input.signals.hasPrimaryDecisionMaker === true ||
        input.signals.hasContactName === true ||
        Boolean(input.signals.decisionMakerStatus && input.signals.decisionMakerStatus !== "none"),
      status: input.signals.decisionMakerStatus ?? null,
      summary:
        input.signals.hasPrimaryDecisionMaker || input.signals.hasContactName
          ? "Decision maker / contact present on lead — reused, not rediscovered."
          : "Decision maker not yet available.",
    },
    evidence: pkg?.supportingResearch ?? [],
    knowledgePackSummary: input.signals.knowledgeComplete
      ? "Knowledge pack / company evidence treated as complete for drafting."
      : null,
    personalizationRationale: pkg?.personalizationEvidence ?? [],
    recommendedChannel: pkg?.recommendedChannel ?? "email",
    recommendedSequence: pkg?.recommendedSequence ?? "email_first_multichannel",
    subjectLines: emailAssets.map((asset) => asset.label).filter(Boolean),
    emailDrafts: emailAssets.map((asset) => asset.preview),
    callOpening: callAsset?.preview ?? null,
    linkedInOpener: linkedInAsset?.preview ?? null,
    confidence: pkg?.confidence ?? 0,
    reasons: [
      explainability.whySelected,
      explainability.whyNow,
      explainability.whyDecisionMaker,
      explainability.whyOutreach,
    ],
    supportingEvidence: explainability.supportingEvidence,
    approvalRequirements: pkg?.approvalRequirements ?? [
      "operator_outbound_approval",
      "human_send_gate",
    ],
    nextRecommendedAction: "Review draft package in Approval Inbox — do not send until approved.",
    explainability,
    pendingHumanApproval: true,
    transportBlocked: true,
    growth5fApprovalPackage: pkg
      ? {
          ...pkg,
          pendingHumanApproval: true,
          transportBlocked: true,
        }
      : null,
    preparedAt: input.preparedAt,
    factoryState: input.factoryState,
  }
}

export function createDraftFactoryLeadRecord(input: {
  organizationId: string
  leadId: string
  companyName?: string | null
  signals: AiOsDraftFactorySignals
  wakeSource?: AiOsDraftFactoryWakeSource | null
  now: string
  existingPackage?: AiOsDraftFactoryPackage | null
}): AiOsDraftFactoryLeadRecord {
  let flags = buildDraftFactoryStageFlags(input.signals)
  flags = applyWakeToFlags(flags, input.wakeSource)
  if (input.existingPackage && !wakeShouldForceRebuild(input.wakeSource)) {
    flags = {
      ...flags,
      draftValid: true,
      inApprovalQueue: true,
      personalizationReady: true,
    }
  }
  const state = projectDraftFactoryState(flags)
  return {
    leadId: input.leadId,
    organizationId: input.organizationId,
    companyName: input.companyName ?? null,
    state,
    earliestIncompleteStage: resolveEarliestIncompleteStage(flags),
    stageFlags: flags,
    wakeSource: input.wakeSource ?? null,
    package: input.existingPackage ?? null,
    lastAdvancedAt: input.now,
    lastError: null,
    lockOwner: null,
    version: 1,
  }
}

/**
 * Pure advance step: resume from earliest incomplete stage.
 * Generation is marked executable but actual 5F call happens in the server service.
 */
export function planDraftFactoryAdvance(input: {
  record: AiOsDraftFactoryLeadRecord
  signals: AiOsDraftFactorySignals
  wakeSource?: AiOsDraftFactoryWakeSource | null
  budgetAvailable: boolean
  growth5fApprovalPackage?: GrowthAutonomousOutreachApprovalPackage | null
  now: string
  mode?: AiOsDraftFactoryMode
  workerId?: string
}): AiOsDraftFactoryAdvanceResult {
  const mode = input.mode ?? AI_OS_DRAFT_FACTORY_DEFAULT_MODE
  const previousState = input.record.state

  if (input.record.lockOwner && input.workerId && input.record.lockOwner !== input.workerId) {
    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState: previousState,
      stagesSkipped: [],
      stageExecuted: null,
      resumedFrom: input.record.earliestIncompleteStage,
      package: input.record.package,
      blockedReason: `Lead locked by worker ${input.record.lockOwner} — parallel duplicate prevented.`,
      duplicatePrevented: true,
      transportBlocked: true,
      mode,
    }
  }

  if (input.signals.transportBlocked === false) {
    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState: "failed",
      stagesSkipped: [],
      stageExecuted: null,
      resumedFrom: null,
      package: input.record.package,
      blockedReason: "transport_blocked must remain true — Draft Factory refuses to proceed when cleared.",
      duplicatePrevented: false,
      transportBlocked: true,
      mode,
    }
  }

  let flags = buildDraftFactoryStageFlags(input.signals)
  flags = applyWakeToFlags(flags, input.wakeSource ?? input.record.wakeSource)

  if (input.record.package && !wakeShouldForceRebuild(input.wakeSource ?? input.record.wakeSource)) {
    flags = {
      ...flags,
      draftValid: true,
      personalizationReady: true,
      inApprovalQueue: !flags.approved && !flags.rejected,
    }
  }

  if (!input.budgetAvailable) {
    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState: previousState,
      stagesSkipped: [],
      stageExecuted: null,
      resumedFrom: resolveEarliestIncompleteStage(flags),
      package: input.record.package,
      blockedReason: "Budget / daily package capacity exhausted — factory will resume when capacity returns.",
      duplicatePrevented: false,
      transportBlocked: true,
      mode,
    }
  }

  if (flags.investmentEligible === false && input.signals.investmentState === "stop_investment") {
    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState: "paused",
      stagesSkipped: listSkippedStagesBefore("investment"),
      stageExecuted: "investment",
      resumedFrom: "investment",
      package: null,
      blockedReason: "Stop Investment — Draft Factory will not generate packages.",
      duplicatePrevented: false,
      transportBlocked: true,
      mode,
    }
  }

  // Capture earliest incomplete stage BEFORE treating a newly supplied 5F package as already-valid.
  const earliestBeforePackage = resolveEarliestIncompleteStage(flags)
  const hadExistingPackage = Boolean(input.record.package)

  if (input.growth5fApprovalPackage) {
    flags = {
      ...flags,
      draftValid: true,
      personalizationReady: true,
      decisionMakerAvailable: flags.decisionMakerAvailable || true,
      inApprovalQueue: true,
    }
  }

  const earliest = resolveEarliestIncompleteStage(flags)
  const skipped = listSkippedStagesBefore(earliestBeforePackage ?? earliest)

  // Valid draft already in approval — reuse, do not regenerate.
  if (
    hadExistingPackage &&
    !wakeShouldForceRebuild(input.wakeSource ?? input.record.wakeSource) &&
    (earliestBeforePackage === null || earliestBeforePackage === "approval_queue")
  ) {
    const nextState: AiOsDraftFactoryState = flags.approved
      ? "approved"
      : flags.rejected
        ? "rejected"
        : "waiting_for_approval"

    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState,
      stagesSkipped: skipped,
      stageExecuted: earliestBeforePackage === "approval_queue" ? "approval_queue" : null,
      resumedFrom: earliestBeforePackage,
      package: input.record.package,
      blockedReason: null,
      duplicatePrevented: true,
      transportBlocked: true,
      mode,
    }
  }

  if (
    earliestBeforePackage === "generation" ||
    (earliestBeforePackage == null && !hadExistingPackage && !flags.draftValid && input.growth5fApprovalPackage)
  ) {
    if (!flags.portfolioSelected && !input.growth5fApprovalPackage) {
      return {
        qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
        leadId: input.record.leadId,
        previousState,
        nextState: "paused",
        stagesSkipped: skipped,
        stageExecuted: "portfolio",
        resumedFrom: "portfolio",
        package: null,
        blockedReason: "Portfolio gate — account not selected for scarce drafting capacity.",
        duplicatePrevented: false,
        transportBlocked: true,
        mode,
      }
    }

    if (!input.signals.portfolioSelected) {
      return {
        qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
        leadId: input.record.leadId,
        previousState,
        nextState: "paused",
        stagesSkipped: skipped,
        stageExecuted: "portfolio",
        resumedFrom: "portfolio",
        package: null,
        blockedReason: "Portfolio gate — account not selected for scarce drafting capacity.",
        duplicatePrevented: false,
        transportBlocked: true,
        mode,
      }
    }

    if (!flags.investmentEligible && input.signals.investmentState !== "increase_investment") {
      return {
        qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
        leadId: input.record.leadId,
        previousState,
        nextState: "paused",
        stagesSkipped: skipped,
        stageExecuted: "investment",
        resumedFrom: "investment",
        package: null,
        blockedReason: "Investment gate — account has not earned drafting investment.",
        duplicatePrevented: false,
        transportBlocked: true,
        mode,
      }
    }

    if (!input.growth5fApprovalPackage) {
      return {
        qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
        leadId: input.record.leadId,
        previousState,
        nextState: "waiting_for_generation",
        stagesSkipped: skipped,
        stageExecuted: null,
        resumedFrom: "generation",
        package: null,
        blockedReason: null,
        duplicatePrevented: false,
        transportBlocked: true,
        mode,
      }
    }

    const assembled = assembleDraftFactoryPackage({
      organizationId: input.record.organizationId,
      leadId: input.record.leadId,
      companyName: input.record.companyName,
      signals: input.signals,
      factoryState: "waiting_for_approval",
      growth5fApprovalPackage: input.growth5fApprovalPackage,
      preparedAt: input.now,
    })

    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState: "waiting_for_approval",
      stagesSkipped: skipped,
      stageExecuted: "generation",
      resumedFrom: "generation",
      package: assembled,
      blockedReason: null,
      duplicatePrevented: false,
      transportBlocked: true,
      mode,
    }
  }

  // Newly supplied 5F package while already complete upstream — treat as generation completion.
  if (input.growth5fApprovalPackage && !hadExistingPackage) {
    if (!input.signals.portfolioSelected) {
      return {
        qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
        leadId: input.record.leadId,
        previousState,
        nextState: "paused",
        stagesSkipped: skipped,
        stageExecuted: "portfolio",
        resumedFrom: "portfolio",
        package: null,
        blockedReason: "Portfolio gate — account not selected for scarce drafting capacity.",
        duplicatePrevented: false,
        transportBlocked: true,
        mode,
      }
    }
    if (
      input.signals.investmentState === "stop_investment" ||
      input.signals.investmentState === "reduce_investment" ||
      !flags.investmentEligible
    ) {
      return {
        qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
        leadId: input.record.leadId,
        previousState,
        nextState: "paused",
        stagesSkipped: skipped,
        stageExecuted: "investment",
        resumedFrom: "investment",
        package: null,
        blockedReason: "Investment gate — account has not earned drafting investment.",
        duplicatePrevented: false,
        transportBlocked: true,
        mode,
      }
    }
    const assembled = assembleDraftFactoryPackage({
      organizationId: input.record.organizationId,
      leadId: input.record.leadId,
      companyName: input.record.companyName,
      signals: input.signals,
      factoryState: "waiting_for_approval",
      growth5fApprovalPackage: input.growth5fApprovalPackage,
      preparedAt: input.now,
    })
    return {
      qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
      leadId: input.record.leadId,
      previousState,
      nextState: "waiting_for_approval",
      stagesSkipped: listSkippedStagesBefore("generation"),
      stageExecuted: "generation",
      resumedFrom: "generation",
      package: assembled,
      blockedReason: null,
      duplicatePrevented: false,
      transportBlocked: true,
      mode,
    }
  }

  const nextState = projectDraftFactoryState(flags)
  return {
    qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
    leadId: input.record.leadId,
    previousState,
    nextState,
    stagesSkipped: skipped,
    stageExecuted: earliest,
    resumedFrom: earliest,
    package: input.record.package,
    blockedReason:
      earliest != null && isTerminalBlocking(nextState)
        ? `Stopped at ${earliest} → ${nextState}`
        : earliest != null
          ? `Resumed at ${earliest}; waiting for upstream systems to complete.`
          : null,
    duplicatePrevented: false,
    transportBlocked: true,
    mode,
  }
}

export function applyAdvanceToRecord(
  record: AiOsDraftFactoryLeadRecord,
  advance: AiOsDraftFactoryAdvanceResult,
  now: string,
): AiOsDraftFactoryLeadRecord {
  return {
    ...record,
    state: advance.nextState,
    earliestIncompleteStage: advance.resumedFrom,
    package: advance.package ?? record.package,
    lastAdvancedAt: now,
    lastError: advance.blockedReason,
    lockOwner: null,
    version: record.version + 1,
  }
}

/**
 * Overnight batch simulation / capacity-bounded factory run (pure).
 * For generation-ready leads, caller may pre-attach synthetic 5F packages in signals via hasRecent or supply packages map.
 */
export function runDraftFactoryOvernightBatch(input: {
  organizationId: string
  now: string
  candidates: Array<{
    leadId: string
    companyName?: string | null
    signals: AiOsDraftFactorySignals
    wakeSource?: AiOsDraftFactoryWakeSource | null
    growth5fApprovalPackage?: GrowthAutonomousOutreachApprovalPackage | null
    existingRecord?: AiOsDraftFactoryLeadRecord | null
  }>
  capacity?: Partial<typeof AI_OS_DRAFT_FACTORY_CAPACITY>
  packagesAlreadyProducedToday?: number
}): AiOsDraftFactoryBatchResult {
  const maxDay = input.capacity?.maxPackagesPerDay ?? AI_OS_DRAFT_FACTORY_CAPACITY.maxPackagesPerDay
  const maxBatch = input.capacity?.maxOvernightBatch ?? AI_OS_DRAFT_FACTORY_CAPACITY.maxOvernightBatch
  let used = input.packagesAlreadyProducedToday ?? 0
  const results: AiOsDraftFactoryAdvanceResult[] = []
  let advanced = 0
  let packagesReady = 0
  let skippedBudget = 0
  let skippedIneligible = 0
  let failed = 0
  let duplicatesPrevented = 0

  const limited = input.candidates.slice(0, maxBatch)

  for (const candidate of limited) {
    const record =
      candidate.existingRecord ??
      createDraftFactoryLeadRecord({
        organizationId: input.organizationId,
        leadId: candidate.leadId,
        companyName: candidate.companyName,
        signals: candidate.signals,
        wakeSource: candidate.wakeSource,
        now: input.now,
      })

    const budgetAvailable = used < maxDay
    const advance = planDraftFactoryAdvance({
      record,
      signals: candidate.signals,
      wakeSource: candidate.wakeSource,
      budgetAvailable,
      growth5fApprovalPackage: candidate.growth5fApprovalPackage,
      now: input.now,
    })

    results.push(advance)
    if (advance.duplicatePrevented) duplicatesPrevented += 1
    if (advance.blockedReason?.includes("Budget")) {
      skippedBudget += 1
      continue
    }
    if (advance.nextState === "failed") {
      failed += 1
      continue
    }
    if (
      advance.blockedReason?.includes("Investment gate") ||
      advance.blockedReason?.includes("Portfolio gate") ||
      advance.blockedReason?.includes("Stop Investment")
    ) {
      skippedIneligible += 1
      continue
    }

    if (advance.stageExecuted || advance.nextState !== advance.previousState) {
      advanced += 1
    }

    if (advance.nextState === "waiting_for_approval" && advance.package) {
      if (advance.stageExecuted === "generation") {
        used += 1
      }
      packagesReady += 1
    }
  }

  return {
    qaMarker: AI_OS_DRAFT_FACTORY_QA_MARKER,
    organizationId: input.organizationId,
    evaluated: limited.length,
    advanced,
    packagesReady,
    skippedBudget,
    skippedIneligible,
    failed,
    duplicatesPrevented,
    capacity: {
      maxPackagesPerDay: maxDay,
      used,
      remaining: Math.max(0, maxDay - used),
    },
    results,
    decidedAt: input.now,
  }
}

export function assertDraftFactoryStatesLocked(): void {
  if (AI_OS_DRAFT_FACTORY_STATES.length !== 12) {
    throw new Error("Draft Factory states drift")
  }
}

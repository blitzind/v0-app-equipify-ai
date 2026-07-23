/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1B — Bounded research investment adapter (client-safe).
 * Consumes persisted Admission / Research Sufficiency metadata only.
 * SV1-1 Resource Allocation remains sole investment authority.
 */

import {
  GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
  type GrowthResearchSufficiencyDecisionKind,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import { resolveLegacyAdmissionPolicyRead } from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import {
  GROWTH_BOUNDED_RESEARCH_ACTION_ORDER,
  readCompletedBoundedResearchActionKeys,
  resolveBoundedResearchActionKeyFromEvidence,
  resolveBoundedResearchActionKeyFromLabel,
  type GrowthBoundedResearchActionKey,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b-action-identity"

export const GROWTH_INVESTMENT_PROPAGATION_1B_QA_MARKER =
  "ge-aios-investment-propagation-1b-v1" as const

/** Canonical budget unit: remaining targeted research passes (see Research Sufficiency 1A). */
export const GROWTH_BOUNDED_RESEARCH_INVESTMENT_UNIT = "targeted_research_pass" as const

const GENERIC_RESEARCH_ACTION_PATTERNS =
  /^(research company|gather more data|enrich lead|improve confidence|check more sources|complete one bounded material research action)$/i

const GENERIC_RESOLVE_ACTION_PATTERN = /^resolve /i

export type GrowthBoundedResearchAuthorization = {
  authorized: boolean
  decision: "targeted_research" | null
  missingRequiredEvidence: string[]
  authorizedActions: string[]
  authorizedActionKeys: GrowthBoundedResearchActionKey[]
  maxAdditionalInvestment: number
  investmentConsumed: number
  investmentRemaining: number
  attemptCount: number
  maxAttempts: number
  stopConditions: string[]
  reevaluateAfterAction: boolean
}

export type GrowthBoundedResearchSignalProjection = {
  researchSufficiencyDecision: GrowthResearchSufficiencyDecisionKind | null
  packageReady: boolean | null
  sendReady: boolean | null
  boundedResearchAuthorization: GrowthBoundedResearchAuthorization | null
}

const EVIDENCE_TO_ACTIONS: Record<string, readonly string[]> = {
  verified_company_identity: [
    "inspect official About page",
    "verify official domain",
    "confirm legal business identity",
    "inspect authoritative business listing",
  ],
  company_identity: [
    "inspect official About page",
    "verify official domain",
    "confirm legal business identity",
    "inspect authoritative business listing",
  ],
  eligible_territory: [
    "inspect official locations page",
    "inspect service-area page",
    "confirm United States operating presence",
    "check authoritative registration or business listing",
  ],
  territory: [
    "inspect official locations page",
    "inspect service-area page",
    "confirm United States operating presence",
    "check authoritative registration or business listing",
  ],
  operational_fit: [
    "inspect services page",
    "inspect maintenance offerings",
    "inspect repair/installation pages",
    "inspect case studies",
    "inspect industries served",
    "inspect careers for technician or field-service roles",
  ],
  defensible_outreach_angle: [
    "identify recurring maintenance pain",
    "identify compliance or inspection obligations",
    "identify service-contract model",
    "identify dispatch, asset, warranty, or documentation workflow",
    "identify relevant Equipify value proposition",
  ],
  outreach_angle: [
    "identify recurring maintenance pain",
    "identify compliance or inspection obligations",
    "identify service-contract model",
    "identify dispatch, asset, warranty, or documentation workflow",
    "identify relevant Equipify value proposition",
  ],
  sufficient_company_context: [
    "inspect About page",
    "identify company scale indicators",
    "identify service geography",
    "identify customer type",
    "identify operational model",
  ],
  company_context: [
    "inspect About page",
    "identify company scale indicators",
    "identify service geography",
    "identify customer type",
    "identify operational model",
  ],
  confidence_or_fit_threshold: [
    "inspect services page",
    "inspect maintenance offerings",
  ],
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function readMetadataNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

export function isGenericResearchAction(action: string): boolean {
  const normalized = action.trim()
  if (!normalized) return true
  if (GENERIC_RESEARCH_ACTION_PATTERNS.test(normalized)) return true
  if (GENERIC_RESOLVE_ACTION_PATTERN.test(normalized)) return true
  return false
}

export function mapMissingEvidenceToAuthorizedActions(missingEvidence: readonly string[]): string[] {
  const actions = new Set<string>()
  for (const gap of missingEvidence) {
    const normalized = gap.trim()
    if (!normalized) continue
    const mapped = EVIDENCE_TO_ACTIONS[normalized] ?? EVIDENCE_TO_ACTIONS[normalized.replace(/^verified_/, "")]
    if (mapped) {
      for (const action of mapped) actions.add(action)
      continue
    }
    for (const [key, values] of Object.entries(EVIDENCE_TO_ACTIONS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        for (const action of values) actions.add(action)
      }
    }
  }
  return [...actions]
}

export function filterSpecificAuthorizedActions(actions: readonly string[]): string[] {
  return actions.filter((action) => !isGenericResearchAction(action))
}

export function resolveBoundedResearchAuthorizationFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchAuthorization {
  const raw = asRecord(metadata) ?? {}
  const policyRead = resolveLegacyAdmissionPolicyRead({
    admissionState: null,
    metadata: raw,
  })
  const decision = policyRead.sufficiencyDecision
  const passesUsed = Math.max(
    0,
    readMetadataNumber(raw, [
      "admission_targeted_research_passes_used",
      "targeted_research_passes_used",
    ]) ?? 0,
  )
  const maxAttempts = GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES
  const persistedMax = readMetadataNumber(raw, ["admission_max_additional_investment"]) ?? 0
  const investmentRemaining = Math.max(0, persistedMax)
  const investmentConsumed = Math.max(0, passesUsed)
  const completedActionKeys = new Set(readCompletedBoundedResearchActionKeys(raw))
  const missingRequiredEvidence = readStringArray(raw.admission_targeted_research_missing_evidence)
  const authorizedActionKeys = [...new Set(
    missingRequiredEvidence
      .map((gap) => resolveBoundedResearchActionKeyFromEvidence(gap))
      .filter((value): value is GrowthBoundedResearchActionKey => value != null),
  )].filter((key) => !completedActionKeys.has(key))
  const mappedActions = mapMissingEvidenceToAuthorizedActions(missingRequiredEvidence)
  const persistedActions = filterSpecificAuthorizedActions(
    readStringArray(raw.admission_bounded_next_actions),
  )
  const authorizedActions = [...new Set([...mappedActions, ...persistedActions])].filter((action) => {
    const actionKey = resolveBoundedResearchActionKeyFromLabel(action)
    if (actionKey && completedActionKeys.has(actionKey)) return false
    return !completedActionKeys.has(action as GrowthBoundedResearchActionKey)
  })

  const stopConditions: string[] = []
  if (decision === "terminal_reject") stopConditions.push("terminal_reject")
  if (decision === "operator_review_required") stopConditions.push("operator_review_required")
  if (investmentRemaining <= 0) stopConditions.push("budget_exhausted")
  if (passesUsed >= maxAttempts) stopConditions.push("max_attempts_reached")
  if (authorizedActions.length === 0 && authorizedActionKeys.length === 0 && decision === "targeted_research_required") {
    stopConditions.push("no_authorized_actions_remaining")
  }

  const authorized =
    policyRead.hasPolicyMetadata &&
    decision === "targeted_research_required" &&
    investmentRemaining > 0 &&
    (authorizedActions.length > 0 || authorizedActionKeys.length > 0) &&
    passesUsed < maxAttempts

  return {
    authorized,
    decision: authorized ? "targeted_research" : null,
    missingRequiredEvidence,
    authorizedActions,
    authorizedActionKeys,
    maxAdditionalInvestment: investmentRemaining,
    investmentConsumed,
    investmentRemaining,
    attemptCount: passesUsed,
    maxAttempts,
    stopConditions,
    reevaluateAfterAction: authorized,
  }
}

export function buildBoundedResearchSignalProjectionFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchSignalProjection {
  const raw = asRecord(metadata) ?? {}
  const policyRead = resolveLegacyAdmissionPolicyRead({
    admissionState: null,
    metadata: raw,
  })
  const packageReady = raw.package_ready === true ? true : raw.package_ready === false ? false : null
  const sendReady = raw.send_ready === true ? true : raw.send_ready === false ? false : null
  const boundedResearchAuthorization = policyRead.hasPolicyMetadata
    ? resolveBoundedResearchAuthorizationFromMetadata(raw)
    : null

  return {
    researchSufficiencyDecision: policyRead.sufficiencyDecision,
    packageReady,
    sendReady,
    boundedResearchAuthorization,
  }
}

export function shouldAuthorizeBoundedLeadResearch(metadata: Record<string, unknown> | null | undefined): boolean {
  return resolveBoundedResearchAuthorizationFromMetadata(metadata).authorized
}

export function shouldQueueSpecificBoundedResearchAction(
  metadata: Record<string, unknown> | null | undefined,
  action: string,
): boolean {
  const normalized = action.trim()
  if (!normalized) return false
  if (isGenericResearchAction(normalized)) return false
  const actionKey = resolveBoundedResearchActionKeyFromLabel(normalized)
  if (actionKey) {
    const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
    if (!auth.authorized || !auth.authorizedActionKeys.includes(actionKey)) return false
    const completed = readCompletedBoundedResearchActionKeys(metadata)
    if (completed.includes(actionKey)) return false
    const ordered = GROWTH_BOUNDED_RESEARCH_ACTION_ORDER.filter(
      (key) => auth.authorizedActionKeys.includes(key) && !completed.includes(key),
    )
    return ordered[0] === actionKey
  }
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  if (!auth.authorized) return false
  return auth.authorizedActions.includes(normalized)
}

/** Fail-closed gate for autonomous research when canonical policy metadata is present. */
export function shouldBlockAutonomousResearchForPolicyMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const raw = asRecord(metadata) ?? {}
  const policyRead = resolveLegacyAdmissionPolicyRead({ admissionState: null, metadata: raw })
  if (!policyRead.hasPolicyMetadata) return false
  if (policyRead.sufficiencyDecision === "terminal_reject") return true
  if (policyRead.sufficiencyDecision === "operator_review_required") return true
  if (policyRead.sufficiencyDecision === "targeted_research_required") {
    return !shouldAuthorizeBoundedLeadResearch(raw)
  }
  return false
}

export function projectBoundedResearchInvestmentState(input: {
  resourceClass: string
  costTier: "low_cost" | "billable" | "outbound"
  admissionState: string
  allowAutoResearch?: boolean | null
  projection: GrowthBoundedResearchSignalProjection
}): {
  investmentState: "increase_investment" | "pending_investment" | "stop_investment" | null
  reason: string | null
  blocking: string[]
} {
  const { projection } = input
  const decision = projection.researchSufficiencyDecision
  const auth = projection.boundedResearchAuthorization
  const blocking: string[] = []

  if (decision === "terminal_reject") {
    blocking.push("research_sufficiency_terminal_reject")
    return {
      investmentState: "stop_investment",
      reason: "Research Sufficiency terminal reject — Stop Investment.",
      blocking,
    }
  }

  if (
    decision === "targeted_research_required" &&
    auth?.authorized === true &&
    auth.investmentRemaining > 0 &&
    input.allowAutoResearch !== false
  ) {
    if (input.costTier === "low_cost" || input.resourceClass === "website_research") {
      blocking.push("bounded_targeted_research_authorized")
      return {
        investmentState: "increase_investment",
        reason:
          "Bounded targeted research authorized — increase low-cost research investment within explicit pass budget.",
        blocking,
      }
    }
    blocking.push("admission_review_billable_deferred")
    return {
      investmentState: "pending_investment",
      reason:
        "Bounded research authorized for low-cost evidence only — billable investment remains pending until package-ready.",
      blocking,
    }
  }

  if (decision === "operator_review_required") {
    blocking.push("operator_review_required")
    return {
      investmentState: "pending_investment",
      reason: "Operator review required — Pending Investment without autonomous spend.",
      blocking,
    }
  }

  if (
    decision === "targeted_research_required" &&
    (!auth?.authorized || auth.investmentRemaining <= 0)
  ) {
    blocking.push("bounded_research_exhausted")
    return {
      investmentState: "pending_investment",
      reason: "Targeted research budget exhausted — Pending Investment pending re-evaluation.",
      blocking,
    }
  }

  return { investmentState: null, reason: null, blocking }
}

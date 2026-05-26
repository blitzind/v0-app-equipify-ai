import {
  GROWTH_LEAD_ENGINE_APPROVAL_PRIORITIES,
  GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES,
  GROWTH_LEAD_ENGINE_APPROVAL_STATUSES,
  GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_RECOMMENDED_HUMAN_ACTIONS,
  GROWTH_LEAD_ENGINE_REQUIRED_REVIEW_AREAS,
  type GrowthLeadEngineApprovalBlocker,
  type GrowthLeadEngineApprovalPriority,
  type GrowthLeadEngineApprovalReasonCode,
  type GrowthLeadEngineApprovalStatus,
  type GrowthLeadEngineHumanApprovalOutput,
  type GrowthLeadEngineHumanApprovalSourceAttribution,
  type GrowthLeadEngineRecommendedHumanAction,
  type GrowthLeadEngineRequiredReviewArea,
} from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

const ALLOWED_STATUSES = new Set<string>(GROWTH_LEAD_ENGINE_APPROVAL_STATUSES)
const ALLOWED_PRIORITIES = new Set<string>(GROWTH_LEAD_ENGINE_APPROVAL_PRIORITIES)
const ALLOWED_REASON_CODES = new Set<string>(GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES)
const ALLOWED_REVIEW_AREAS = new Set<string>(GROWTH_LEAD_ENGINE_REQUIRED_REVIEW_AREAS)
const ALLOWED_ACTIONS = new Set<string>(GROWTH_LEAD_ENGINE_RECOMMENDED_HUMAN_ACTIONS)

const UNSUPPORTED_EVIDENCE = /\b(assumed|invented|guess|speculated|fabricated)\b/i

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
}

function asReasonCodes(value: unknown): GrowthLeadEngineApprovalReasonCode[] {
  const raw = asStringArray(value).map((code) => code.toUpperCase())
  const filtered = raw.filter((code): code is GrowthLeadEngineApprovalReasonCode =>
    ALLOWED_REASON_CODES.has(code),
  )
  return [...new Set(filtered)]
}

function asReviewAreas(value: unknown): GrowthLeadEngineRequiredReviewArea[] {
  const raw = asStringArray(value).map((area) => area.toLowerCase())
  const filtered = raw.filter((area): area is GrowthLeadEngineRequiredReviewArea =>
    ALLOWED_REVIEW_AREAS.has(area),
  )
  return [...new Set(filtered)]
}

function asHumanActions(value: unknown): GrowthLeadEngineRecommendedHumanAction[] {
  const raw = asStringArray(value).map((action) => action.toLowerCase())
  const filtered = raw.filter((action): action is GrowthLeadEngineRecommendedHumanAction =>
    ALLOWED_ACTIONS.has(action),
  )
  return [...new Set(filtered)]
}

function asBlockers(value: unknown): GrowthLeadEngineApprovalBlocker[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const code = asString(row.code)
      const evidence = asString(row.evidence)
      const source = asString(row.source)
      const confidence = asConfidence(row.confidence)
      if (!code || !evidence || !source) return null
      if (confidence <= 0) return null
      if (UNSUPPORTED_EVIDENCE.test(evidence)) return null
      return { code, evidence, source, confidence }
    })
    .filter((row): row is GrowthLeadEngineApprovalBlocker => row !== null)
}

function asSourceAttribution(value: unknown): GrowthLeadEngineHumanApprovalSourceAttribution[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const section = asString(row.section)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = asConfidence(row.confidence)
      if (!source || !section || !signal || !evidence) return null
      if (confidence <= 0) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthLeadEngineHumanApprovalSourceAttribution => row !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

export type GrowthLeadEngineHumanApprovalUpstreamContext = {
  leadScore?: number
  leadPriority?: string | null
  disqualificationReasons?: string[]
  leadScoreHumanReview?: boolean
  verificationDisposition?: string | null
  verificationRiskScore?: number | null
  verificationReasonCodes?: string[]
  verificationHumanReview?: boolean
  accountBriefHumanReview?: boolean
  accountBriefCompleteness?: number | null
  personalizationHumanReview?: boolean
  personalizationCompleteness?: number | null
}

export function buildHumanApprovalUpstreamContext(upstream?: {
  verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief?: GrowthLeadEngineAccountBriefOutput | string
  outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput | string
  leadScore?: GrowthLeadEngineLeadScoreOutput | string
}): GrowthLeadEngineHumanApprovalUpstreamContext {
  const context: GrowthLeadEngineHumanApprovalUpstreamContext = {}

  if (upstream?.verificationTriage && typeof upstream.verificationTriage === "object") {
    const triage = upstream.verificationTriage
    context.verificationDisposition = triage.disposition
    context.verificationRiskScore = triage.risk_score
    context.verificationReasonCodes = triage.verification_reason_codes
    context.verificationHumanReview = triage.human_review_required
  }

  if (upstream?.accountBrief && typeof upstream.accountBrief === "object") {
    const brief = upstream.accountBrief
    context.accountBriefHumanReview = brief.human_review_required
    context.accountBriefCompleteness = brief.brief_completeness
  }

  if (upstream?.outreachPersonalization && typeof upstream.outreachPersonalization === "object") {
    const personalization = upstream.outreachPersonalization
    context.personalizationHumanReview = personalization.human_review_required
    context.personalizationCompleteness = personalization.personalization_completeness
  }

  if (upstream?.leadScore && typeof upstream.leadScore === "object") {
    const score = upstream.leadScore
    context.leadScore = score.lead_score
    context.leadPriority = score.priority_level
    context.disqualificationReasons = score.disqualification_reasons
    context.leadScoreHumanReview = score.human_review_required
  }

  return context
}

function hasUpstreamHumanReviewFlags(context: GrowthLeadEngineHumanApprovalUpstreamContext): boolean {
  return (
    context.accountBriefHumanReview === true ||
    context.personalizationHumanReview === true ||
    context.leadScoreHumanReview === true ||
    context.verificationHumanReview === true
  )
}

function buildDeterministicBlockers(
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
): GrowthLeadEngineApprovalBlocker[] {
  const blockers: GrowthLeadEngineApprovalBlocker[] = []
  const disposition = (context.verificationDisposition ?? "").toLowerCase()

  if (disposition === "reject") {
    blockers.push({
      code: "VERIFICATION_REJECTED",
      evidence: "Verification triage disposition is reject.",
      source: "verification_triage",
      confidence: 0.95,
    })
  }

  if ((context.disqualificationReasons ?? []).length > 0) {
    blockers.push({
      code: "DISQUALIFICATION_ACTIVE",
      evidence: context.disqualificationReasons!.join(" "),
      source: "lead_score",
      confidence: 0.9,
    })
  }

  if ((context.verificationReasonCodes ?? []).includes("COMPANY_MISMATCH")) {
    blockers.push({
      code: "COMPANY_MISMATCH",
      evidence: "Verification reason code COMPANY_MISMATCH present.",
      source: "verification_triage",
      confidence: 0.92,
    })
  }

  if ((context.verificationRiskScore ?? 0) >= 70) {
    blockers.push({
      code: "HIGH_RISK",
      evidence: `Verification risk_score ${context.verificationRiskScore} >= 70.`,
      source: "verification_triage",
      confidence: 0.88,
    })
  }

  if ((context.verificationReasonCodes ?? []).includes("DUPLICATE_POSSIBLE")) {
    blockers.push({
      code: "DUPLICATE_RISK",
      evidence: "Verification reason code DUPLICATE_POSSIBLE present.",
      source: "verification_triage",
      confidence: 0.85,
    })
  }

  if ((context.leadScore ?? 0) < 25 || context.leadPriority === "disqualified") {
    blockers.push({
      code: "LEAD_SCORE_DISQUALIFIED",
      evidence: `Lead score ${context.leadScore ?? 0} below threshold or priority disqualified.`,
      source: "lead_score",
      confidence: 0.9,
    })
  }

  return blockers
}

export function computeDeterministicApprovalStatus(
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
  attributionCount: number,
): GrowthLeadEngineApprovalStatus {
  const deterministicBlockers = buildDeterministicBlockers(context)
  if (deterministicBlockers.length > 0) return "blocked"
  if (attributionCount < 2) return "blocked"

  const disposition = (context.verificationDisposition ?? "").toLowerCase()
  const leadScore = context.leadScore ?? 0

  if (disposition === "reject" || leadScore < 25) return "blocked"
  if (hasUpstreamHumanReviewFlags(context)) return "conditional"
  if (disposition === "risky") return "conditional"
  if (leadScore < 70) return "conditional"

  const briefCompleteness = context.accountBriefCompleteness
  const personalizationCompleteness = context.personalizationCompleteness
  if (
    (briefCompleteness != null && briefCompleteness < 60) ||
    (personalizationCompleteness != null && personalizationCompleteness < 60)
  ) {
    return "conditional"
  }

  if (
    leadScore >= 70 &&
    disposition !== "reject" &&
    !hasUpstreamHumanReviewFlags(context) &&
    attributionCount >= 2 &&
    (context.verificationRiskScore ?? 0) < 50
  ) {
    return "approved"
  }

  return "conditional"
}

function resolveApprovalPriority(
  status: GrowthLeadEngineApprovalStatus,
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
  escalationRequired: boolean,
): GrowthLeadEngineApprovalPriority {
  if (escalationRequired || status === "blocked") {
    const disposition = (context.verificationDisposition ?? "").toLowerCase()
    if (disposition === "reject" || (context.verificationRiskScore ?? 0) >= 70) {
      return "urgent"
    }
    return status === "blocked" ? "urgent" : "normal"
  }
  if (status === "conditional") return "normal"
  const leadScore = context.leadScore ?? 0
  if (leadScore >= 85) return "normal"
  if (leadScore >= 70) return "normal"
  return "low"
}

function resolveRecommendedActions(
  status: GrowthLeadEngineApprovalStatus,
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
): GrowthLeadEngineRecommendedHumanAction[] {
  if (status === "blocked") {
    if ((context.verificationDisposition ?? "") === "reject") return ["disqualify"]
    return ["deprioritize", "disqualify"]
  }
  if (status === "conditional") {
    const actions: GrowthLeadEngineRecommendedHumanAction[] = ["request_review"]
    if ((context.verificationDisposition ?? "") === "risky") actions.push("verify_contact")
    if ((context.leadScore ?? 0) < 70) actions.push("enrich")
    return [...new Set(actions)]
  }
  return ["approve", "request_review"]
}

function resolveReviewAreas(
  status: GrowthLeadEngineApprovalStatus,
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
  attributionCount: number,
): GrowthLeadEngineRequiredReviewArea[] {
  const areas: GrowthLeadEngineRequiredReviewArea[] = []

  if ((context.verificationDisposition ?? "") !== "validated") areas.push("verification")
  if (attributionCount < 3) areas.push("attribution")
  if ((context.leadScore ?? 0) < 70) areas.push("scoring")
  if (context.accountBriefHumanReview) areas.push("account_brief")
  if (context.personalizationHumanReview) areas.push("personalization")
  if ((context.verificationRiskScore ?? 0) >= 50) areas.push("risk")
  if ((context.verificationReasonCodes ?? []).includes("DUPLICATE_POSSIBLE")) {
    areas.push("duplicate_review")
  }
  if (status === "conditional") areas.push("contact_quality")

  return [...new Set(areas)].filter((area) => ALLOWED_REVIEW_AREAS.has(area))
}

function buildReasonCodes(
  status: GrowthLeadEngineApprovalStatus,
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
  attributionCount: number,
): GrowthLeadEngineApprovalReasonCode[] {
  const codes: GrowthLeadEngineApprovalReasonCode[] = []

  const leadScore = context.leadScore ?? 0
  if (leadScore >= 70) codes.push("LEAD_SCORE_STRONG")
  else codes.push("LEAD_SCORE_WEAK")

  const disposition = (context.verificationDisposition ?? "").toLowerCase()
  if (disposition === "validated") codes.push("VERIFICATION_VALIDATED")
  if (disposition === "risky") codes.push("VERIFICATION_RISKY")
  if (disposition === "reject") codes.push("VERIFICATION_REJECTED")

  if (attributionCount < 2) codes.push("ATTRIBUTION_INSUFFICIENT")
  if (
    (context.accountBriefCompleteness != null && context.accountBriefCompleteness < 60) ||
    (context.personalizationCompleteness != null && context.personalizationCompleteness < 60)
  ) {
    codes.push("EVIDENCE_INCOMPLETE")
  }

  if (hasUpstreamHumanReviewFlags(context)) codes.push("HUMAN_REVIEW_FLAGGED")
  if ((context.verificationRiskScore ?? 0) >= 70) codes.push("HIGH_RISK")
  if ((context.verificationReasonCodes ?? []).includes("DUPLICATE_POSSIBLE")) {
    codes.push("DUPLICATE_RISK")
  }
  if ((context.verificationReasonCodes ?? []).includes("COMPANY_MISMATCH")) {
    codes.push("COMPANY_MISMATCH")
  }
  if ((context.disqualificationReasons ?? []).length > 0) codes.push("DISQUALIFICATION_ACTIVE")
  if (leadScore < 70 && status !== "blocked") codes.push("ENRICHMENT_NEEDED")

  if (status === "approved") codes.push("READY_FOR_HUMAN_APPROVAL")
  if (status === "blocked") codes.push("BLOCKED_BY_POLICY")

  return asReasonCodes(codes)
}

function mergeBlockers(
  modelBlockers: GrowthLeadEngineApprovalBlocker[],
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
): GrowthLeadEngineApprovalBlocker[] {
  const deterministic = buildDeterministicBlockers(context)
  const byCode = new Map<string, GrowthLeadEngineApprovalBlocker>()
  for (const blocker of [...deterministic, ...modelBlockers]) {
    byCode.set(blocker.code.toUpperCase(), blocker)
  }
  return [...byCode.values()]
}

function enforceHumanApproval(
  output: GrowthLeadEngineHumanApprovalOutput,
  context: GrowthLeadEngineHumanApprovalUpstreamContext,
): GrowthLeadEngineHumanApprovalOutput {
  const approval_status = computeDeterministicApprovalStatus(
    context,
    output.source_attribution.length,
  )

  const approval_blockers =
    approval_status === "blocked" ? mergeBlockers(output.approval_blockers, context) : []

  let escalation_required = output.escalation_required
  let escalation_reason = output.escalation_reason
  if (escalation_required && !escalation_reason) {
    escalation_required = false
    escalation_reason = ""
  }
  if (approval_status === "blocked" && (context.verificationDisposition ?? "") === "reject") {
    escalation_required = true
    escalation_reason =
      escalation_reason || "Verification reject requires manager review before any outreach."
  }

  const approval_priority = resolveApprovalPriority(approval_status, context, escalation_required)
  const required_review_areas = resolveReviewAreas(
    approval_status,
    context,
    output.source_attribution.length,
  )
  const recommended_human_actions = resolveRecommendedActions(approval_status, context)
  const approval_reason_codes = buildReasonCodes(
    approval_status,
    context,
    output.source_attribution.length,
  )

  let approval_confidence = output.approval_confidence
  if (approval_status === "blocked") {
    approval_confidence = Math.min(approval_confidence, 0.45)
  } else if (approval_status === "conditional") {
    approval_confidence = Math.min(approval_confidence, 0.75)
  }

  const human_review_required = true
  const review_notes_required =
    approval_status !== "approved" || output.review_notes_required || hasUpstreamHumanReviewFlags(context)

  return {
    ...output,
    approval_status,
    approval_reason_codes,
    approval_confidence,
    approval_priority,
    human_review_required,
    required_review_areas,
    recommended_human_actions,
    approval_blockers: approval_status === "blocked" ? approval_blockers : [],
    review_notes_required,
    escalation_required,
    escalation_reason: escalation_required ? escalation_reason : "",
  }
}

export function parseGrowthLeadEngineHumanApprovalOutput(
  raw: string,
  options?: { upstream?: GrowthLeadEngineHumanApprovalUpstreamContext },
): { ok: true; output: GrowthLeadEngineHumanApprovalOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Human approval response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>
    const context = options?.upstream ?? {}

    const source_attribution = asSourceAttribution(record.source_attribution)
    if (source_attribution.length === 0) {
      return {
        ok: false,
        message: "Human approval response must include source_attribution with evidence.",
      }
    }

    const rawStatus = asString(record.approval_status).toLowerCase()
    const approval_status = ALLOWED_STATUSES.has(rawStatus)
      ? (rawStatus as GrowthLeadEngineApprovalStatus)
      : "conditional"

    const output: GrowthLeadEngineHumanApprovalOutput = {
      approval_status,
      approval_reason_codes: asReasonCodes(record.approval_reason_codes),
      approval_confidence: asConfidence(record.approval_confidence),
      approval_priority: ALLOWED_PRIORITIES.has(asString(record.approval_priority).toLowerCase())
        ? (asString(record.approval_priority).toLowerCase() as GrowthLeadEngineApprovalPriority)
        : "normal",
      human_review_required: record.human_review_required !== false,
      required_review_areas: asReviewAreas(record.required_review_areas),
      recommended_human_actions: asHumanActions(record.recommended_human_actions),
      approval_blockers: asBlockers(record.approval_blockers),
      approval_summary: asString(record.approval_summary),
      review_notes_required: record.review_notes_required === true,
      escalation_required: record.escalation_required === true,
      escalation_reason: asString(record.escalation_reason),
      evidence_summary: asString(record.evidence_summary),
      source_attribution,
    }

    if (!output.approval_summary) {
      return { ok: false, message: "Human approval response missing approval_summary." }
    }
    if (!output.evidence_summary) {
      return { ok: false, message: "Human approval response missing evidence_summary." }
    }

    const enforced = enforceHumanApproval(output, context)

    if (enforced.approval_status === "approved" && enforced.recommended_human_actions.includes("approve")) {
      const leadScore = context.leadScore ?? 0
      if (
        leadScore < 70 ||
        (context.verificationDisposition ?? "") === "reject" ||
        hasUpstreamHumanReviewFlags(context) ||
        enforced.source_attribution.length < 2
      ) {
        return {
          ok: false,
          message: "Approved status failed deterministic approval requirements.",
        }
      }
    }

    if (enforced.escalation_required && !enforced.escalation_reason) {
      return { ok: false, message: "Escalation required but escalation_reason is missing." }
    }

    if (enforced.approval_status !== computeDeterministicApprovalStatus(context, enforced.source_attribution.length)) {
      return { ok: false, message: "Enforced approval_status mismatch after deterministic pass." }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse human approval JSON.",
    }
  }
}

export function parseGrowthLeadEngineHumanApprovalFromUpstream(
  raw: string,
  upstream?: {
    verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
    accountBrief?: GrowthLeadEngineAccountBriefOutput | string
    outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput | string
    leadScore?: GrowthLeadEngineLeadScoreOutput | string
  },
): ReturnType<typeof parseGrowthLeadEngineHumanApprovalOutput> {
  return parseGrowthLeadEngineHumanApprovalOutput(raw, {
    upstream: buildHumanApprovalUpstreamContext(upstream),
  })
}

export function assertGrowthLeadEngineHumanApprovalOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_OUTPUT_JSON_KEYS
}

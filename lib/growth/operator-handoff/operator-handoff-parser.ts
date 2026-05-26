import {
  GROWTH_OPERATOR_HANDOFF_CHANNELS,
  GROWTH_OPERATOR_HANDOFF_LEAD_PRIORITIES,
  GROWTH_OPERATOR_HANDOFF_MOTIONS,
  GROWTH_OPERATOR_HANDOFF_OUTPUT_JSON_KEYS,
  GROWTH_OPERATOR_HANDOFF_OWNERS,
  GROWTH_OPERATOR_HANDOFF_URGENCIES,
  type GrowthOperatorHandoffAttribution,
  type GrowthOperatorHandoffChannel,
  type GrowthOperatorHandoffEvidenceItem,
  type GrowthOperatorHandoffInput,
  type GrowthOperatorHandoffLeadPriority,
  type GrowthOperatorHandoffMotion,
  type GrowthOperatorHandoffOutput,
  type GrowthOperatorHandoffOwner,
  type GrowthOperatorHandoffUrgency,
} from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  computeOperatorHandoffPriorityHints,
  type GrowthOperatorHandoffPriorityHints,
} from "@/lib/growth/operator-handoff/operator-handoff-priority"
const ALLOWED_MOTIONS = new Set<string>(GROWTH_OPERATOR_HANDOFF_MOTIONS)
const ALLOWED_OWNERS = new Set<string>(GROWTH_OPERATOR_HANDOFF_OWNERS)
const ALLOWED_URGENCIES = new Set<string>(GROWTH_OPERATOR_HANDOFF_URGENCIES)
const ALLOWED_CHANNELS = new Set<string>(GROWTH_OPERATOR_HANDOFF_CHANNELS)
const ALLOWED_PRIORITIES = new Set<string>(GROWTH_OPERATOR_HANDOFF_LEAD_PRIORITIES)

const MESSAGE_COPY =
  /\b(dear |hi |hello |hey |subject:|unsubscribe|click here|book a demo|schedule a call with me|best regards|sincerely,|call script:|sent from my iphone)\b/i

const UNSUPPORTED_EVIDENCE = /\b(assumed|invented|guess|speculated|fabricated|probably urgent|likely urgent)\b/i

const FABRICATED_URGENCY = /\b(act now|limited time|urgent deadline|expires today)\b/i

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

function asEvidenceItems(value: unknown): GrowthOperatorHandoffEvidenceItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const claim = asString(row.claim)
      const evidence = asString(row.evidence)
      const source = asString(row.source)
      const confidence = asConfidence(row.confidence)
      if (!claim || !evidence || !source) return null
      if (confidence <= 0) return null
      if (UNSUPPORTED_EVIDENCE.test(evidence) || UNSUPPORTED_EVIDENCE.test(claim)) return null
      if (MESSAGE_COPY.test(claim) || MESSAGE_COPY.test(evidence)) return null
      return { claim, evidence, source, confidence }
    })
    .filter((row): row is GrowthOperatorHandoffEvidenceItem => row !== null)
}

function asAttribution(value: unknown): GrowthOperatorHandoffAttribution[] {
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
      if (UNSUPPORTED_EVIDENCE.test(evidence)) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthOperatorHandoffAttribution => row !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

function looksLikeMessageCopy(value: string): boolean {
  return MESSAGE_COPY.test(value) || value.length > 320
}

function sanitizeGuidance(value: string): string {
  if (!value || looksLikeMessageCopy(value)) return ""
  if (FABRICATED_URGENCY.test(value)) return ""
  return value
}

function asMotion(value: unknown, fallback: GrowthOperatorHandoffMotion): GrowthOperatorHandoffMotion {
  const raw = asString(value).toLowerCase()
  return ALLOWED_MOTIONS.has(raw) ? (raw as GrowthOperatorHandoffMotion) : fallback
}

function asOwner(value: unknown, fallback: GrowthOperatorHandoffOwner): GrowthOperatorHandoffOwner {
  const raw = asString(value).toLowerCase()
  return ALLOWED_OWNERS.has(raw) ? (raw as GrowthOperatorHandoffOwner) : fallback
}

function asUrgency(value: unknown, fallback: GrowthOperatorHandoffUrgency): GrowthOperatorHandoffUrgency {
  const raw = asString(value).toLowerCase()
  return ALLOWED_URGENCIES.has(raw) ? (raw as GrowthOperatorHandoffUrgency) : fallback
}

function asChannel(value: unknown, fallback: GrowthOperatorHandoffChannel): GrowthOperatorHandoffChannel {
  const raw = asString(value).toUpperCase().replace(/\s+/g, "_")
  return ALLOWED_CHANNELS.has(raw) ? (raw as GrowthOperatorHandoffChannel) : fallback
}

function asLeadPriority(
  value: unknown,
  fallback: GrowthOperatorHandoffLeadPriority,
): GrowthOperatorHandoffLeadPriority {
  const raw = asString(value).toLowerCase()
  return ALLOWED_PRIORITIES.has(raw) ? (raw as GrowthOperatorHandoffLeadPriority) : fallback
}

export type GrowthOperatorHandoffUpstreamContext = {
  verificationDisposition?: string | null
  verificationRiskScore?: number | null
  verificationHumanReview?: boolean
  approvalStatus?: string | null
  approvalPriority?: string | null
  leadScore?: number | null
  leadPriority?: string | null
  accountBriefHumanReview?: boolean
  personalizationHumanReview?: boolean
  leadScoreHumanReview?: boolean
  inboxCandidatePriority?: string | null
  executionHumanRequired?: boolean
}

export function buildOperatorHandoffUpstreamContext(
  upstream?: GrowthOperatorHandoffInput,
): GrowthOperatorHandoffUpstreamContext {
  const context: GrowthOperatorHandoffUpstreamContext = {}

  if (upstream?.leadInbox) {
    context.inboxCandidatePriority = upstream.leadInbox.candidate_priority
  }

  if (upstream?.verificationTriage && typeof upstream.verificationTriage === "object") {
    const triage = upstream.verificationTriage
    context.verificationDisposition = triage.disposition
    context.verificationRiskScore = triage.risk_score
    context.verificationHumanReview = triage.human_review_required
  }

  if (upstream?.humanApproval && typeof upstream.humanApproval === "object") {
    const approval = upstream.humanApproval
    context.approvalStatus = approval.approval_status
    context.approvalPriority = approval.approval_priority
  }

  if (upstream?.leadScore && typeof upstream.leadScore === "object") {
    const score = upstream.leadScore
    context.leadScore = score.lead_score
    context.leadPriority = score.priority_level
    context.leadScoreHumanReview = score.human_review_required
  }

  if (upstream?.accountBrief && typeof upstream.accountBrief === "object") {
    context.accountBriefHumanReview = upstream.accountBrief.human_review_required
  }

  if (upstream?.outreachPersonalization && typeof upstream.outreachPersonalization === "object") {
    context.personalizationHumanReview = upstream.outreachPersonalization.human_review_required
  }

  if (upstream?.revenueExecution && typeof upstream.revenueExecution === "object") {
    context.executionHumanRequired = upstream.revenueExecution.human_execution_required
  }

  return context
}

function hasUpstreamHumanReviewFlags(context: GrowthOperatorHandoffUpstreamContext): boolean {
  return (
    context.accountBriefHumanReview === true ||
    context.personalizationHumanReview === true ||
    context.leadScoreHumanReview === true ||
    context.verificationHumanReview === true ||
    context.executionHumanRequired === true
  )
}

function resolveUrgencyFromUpstream(
  modelUrgency: GrowthOperatorHandoffUrgency,
  context: GrowthOperatorHandoffUpstreamContext,
  hints: GrowthOperatorHandoffPriorityHints,
): GrowthOperatorHandoffUrgency {
  const disposition = (context.verificationDisposition ?? "").toLowerCase()
  const approval = (context.approvalStatus ?? "").toLowerCase()

  if (disposition === "reject" || approval === "blocked") return "monitor"
  if (disposition === "risky" && modelUrgency === "immediate") return "today"

  const hasUrgentSignal =
    context.inboxCandidatePriority === "urgent" || context.approvalPriority === "urgent"

  if (modelUrgency === "immediate" && !hasUrgentSignal) {
    const leadScore = context.leadScore ?? 0
    if (leadScore < 80 || disposition !== "validated") return hints.recommended_urgency
  }

  return modelUrgency
}

function computeHumanReviewRequired(
  context: GrowthOperatorHandoffUpstreamContext,
  attributionCount: number,
): boolean {
  const disposition = (context.verificationDisposition ?? "").toLowerCase()
  if (disposition === "reject" || disposition === "risky") return true
  if ((context.approvalStatus ?? "").toLowerCase() !== "approved") return true
  if (attributionCount < 2) return true
  if (hasUpstreamHumanReviewFlags(context)) return true
  if ((context.verificationRiskScore ?? 0) >= 50) return true
  return true
}

function applyConfidenceCaps(
  confidence: number,
  context: GrowthOperatorHandoffUpstreamContext,
  attributionCount: number,
): number {
  let capped = confidence
  const disposition = (context.verificationDisposition ?? "").toLowerCase()

  if (disposition === "reject") capped = Math.min(capped, 0.4)
  else if (disposition === "risky") capped = Math.min(capped, 0.65)
  else if ((context.verificationRiskScore ?? 0) >= 70) capped = Math.min(capped, 0.6)

  if (attributionCount < 2) capped = Math.min(capped, 0.55)
  if (attributionCount < 3) capped = Math.min(capped, 0.72)

  if ((context.approvalStatus ?? "").toLowerCase() === "blocked") capped = Math.min(capped, 0.45)
  else if ((context.approvalStatus ?? "").toLowerCase() === "conditional") capped = Math.min(capped, 0.75)

  return Number(capped.toFixed(3))
}

function enforceOperatorHandoff(
  output: GrowthOperatorHandoffOutput,
  context: GrowthOperatorHandoffUpstreamContext,
  hints: GrowthOperatorHandoffPriorityHints,
): GrowthOperatorHandoffOutput {
  const attributionCount = output.operator_attribution.length

  const recommended_motion = asMotion(output.recommended_motion, hints.recommended_motion)
  const recommended_owner = asOwner(output.recommended_owner, hints.recommended_owner)
  const recommended_channel = asChannel(output.recommended_channel, hints.recommended_channel)
  let recommended_urgency = resolveUrgencyFromUpstream(
    asUrgency(output.recommended_urgency, hints.recommended_urgency),
    context,
    hints,
  )

  const disposition = (context.verificationDisposition ?? "").toLowerCase()
  if (disposition === "reject") {
    recommended_urgency = "monitor"
  }

  const lead_priority = asLeadPriority(output.lead_priority, hints.lead_priority)
  const human_review_required = computeHumanReviewRequired(context, attributionCount)

  let operator_confidence = applyConfidenceCaps(
    output.operator_confidence,
    context,
    attributionCount,
  )

  let operator_confidence_reasoning = sanitizeGuidance(output.operator_confidence_reasoning)
  if (attributionCount < 2 && !operator_confidence_reasoning) {
    operator_confidence_reasoning =
      "Operator confidence capped — attribution below two entries."
  }
  if (disposition === "risky" && !operator_confidence_reasoning.includes("risky")) {
    operator_confidence_reasoning = [
      operator_confidence_reasoning,
      "Verification disposition risky — confidence capped.",
    ]
      .filter(Boolean)
      .join(" ")
  }

  const handoff_summary = sanitizeGuidance(output.handoff_summary)
  const why_this_matters = sanitizeGuidance(output.why_this_matters)
  const recommended_next_action = sanitizeGuidance(output.recommended_next_action) || hints.recommended_next_action
  const talking_point_summary = sanitizeGuidance(output.talking_point_summary)
  const recommended_followup_window =
    sanitizeGuidance(output.recommended_followup_window) || hints.recommended_followup_window

  const human_notes = asStringArray(output.human_notes)
    .map(sanitizeGuidance)
    .filter((note) => note.length > 0 && !looksLikeMessageCopy(note))

  let recommended_motionFinal = recommended_motion
  if (disposition === "reject" || (context.approvalStatus ?? "") === "blocked") {
    recommended_motionFinal = "disqualify"
  }

  return {
    ...output,
    handoff_summary,
    why_this_matters,
    lead_priority,
    recommended_motion: recommended_motionFinal,
    recommended_owner,
    recommended_channel,
    recommended_urgency,
    recommended_next_action,
    objection_preparation: output.objection_preparation,
    missing_information: output.missing_information,
    human_notes,
    recommended_followup_window,
    talking_point_summary,
    operator_confidence,
    operator_confidence_reasoning,
    human_review_required,
  }
}

export function parseGrowthOperatorHandoffOutput(
  raw: string,
  options?: {
    upstream?: GrowthOperatorHandoffUpstreamContext
    priorityHints?: GrowthOperatorHandoffPriorityHints
  },
): { ok: true; output: GrowthOperatorHandoffOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Operator handoff response is not a JSON object." }
    }

    const record = parsed as Record<string, unknown>
    const context = options?.upstream ?? {}
    const hints = options?.priorityHints ?? {
      lead_priority: "medium",
      recommended_motion: "review",
      recommended_owner: "sales",
      recommended_channel: "NONE",
      recommended_urgency: "this_week",
      recommended_next_action: "Review handoff package before any outreach.",
      recommended_followup_window: "Within 5 business days",
    }

    const operator_attribution = asAttribution(record.operator_attribution)
    if (operator_attribution.length === 0) {
      return {
        ok: false,
        message: "Operator handoff must include operator_attribution with evidence.",
      }
    }

    const operator_evidence = asEvidenceItems(record.operator_evidence)
    if (operator_evidence.length === 0) {
      return {
        ok: false,
        message: "Operator handoff must include operator_evidence with evidence.",
      }
    }

    const handoff_summary = sanitizeGuidance(asString(record.handoff_summary))
    const why_this_matters = sanitizeGuidance(asString(record.why_this_matters))
    if (!handoff_summary) {
      return { ok: false, message: "Operator handoff missing handoff_summary." }
    }
    if (!why_this_matters) {
      return { ok: false, message: "Operator handoff missing why_this_matters." }
    }

    const recommended_next_action = sanitizeGuidance(asString(record.recommended_next_action))
    if (!recommended_next_action) {
      return { ok: false, message: "Operator handoff missing recommended_next_action." }
    }

    const output: GrowthOperatorHandoffOutput = {
      handoff_summary,
      why_this_matters,
      lead_priority: asLeadPriority(record.lead_priority, hints.lead_priority),
      recommended_motion: asMotion(record.recommended_motion, hints.recommended_motion),
      recommended_owner: asOwner(record.recommended_owner, hints.recommended_owner),
      recommended_channel: asChannel(record.recommended_channel, hints.recommended_channel),
      recommended_urgency: asUrgency(record.recommended_urgency, hints.recommended_urgency),
      recommended_next_action,
      objection_preparation: asEvidenceItems(record.objection_preparation),
      missing_information: asEvidenceItems(record.missing_information),
      human_notes: asStringArray(record.human_notes).map(sanitizeGuidance).filter(Boolean),
      recommended_followup_window:
        sanitizeGuidance(asString(record.recommended_followup_window)) ||
        hints.recommended_followup_window,
      talking_point_summary: sanitizeGuidance(asString(record.talking_point_summary)),
      operator_confidence: asConfidence(record.operator_confidence),
      operator_confidence_reasoning: sanitizeGuidance(asString(record.operator_confidence_reasoning)),
      operator_evidence,
      operator_attribution,
      human_review_required: record.human_review_required !== false,
    }

    if (!output.talking_point_summary) {
      return { ok: false, message: "Operator handoff missing talking_point_summary." }
    }

    const enforced = enforceOperatorHandoff(output, context, hints)

    if (!ALLOWED_MOTIONS.has(enforced.recommended_motion)) {
      return { ok: false, message: "recommended_motion failed allowlist validation." }
    }
    if (!ALLOWED_OWNERS.has(enforced.recommended_owner)) {
      return { ok: false, message: "recommended_owner failed allowlist validation." }
    }
    if (!ALLOWED_URGENCIES.has(enforced.recommended_urgency)) {
      return { ok: false, message: "recommended_urgency failed allowlist validation." }
    }

    if (!enforced.human_review_required) {
      return { ok: false, message: "human_review_required must remain true for operator handoff." }
    }

    if (enforced.operator_confidence <= 0) {
      return { ok: false, message: "operator_confidence must be greater than zero." }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse operator handoff JSON.",
    }
  }
}

export function parseGrowthOperatorHandoffFromUpstream(
  raw: string,
  upstream?: GrowthOperatorHandoffInput,
): ReturnType<typeof parseGrowthOperatorHandoffOutput> {
  const input = upstream ?? ({} as GrowthOperatorHandoffInput)
  return parseGrowthOperatorHandoffOutput(raw, {
    upstream: buildOperatorHandoffUpstreamContext(input),
    priorityHints: computeOperatorHandoffPriorityHints(input),
  })
}

export function assertGrowthOperatorHandoffOutputKeys(): readonly string[] {
  return GROWTH_OPERATOR_HANDOFF_OUTPUT_JSON_KEYS
}

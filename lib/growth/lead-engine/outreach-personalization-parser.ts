import {
  GROWTH_LEAD_ENGINE_OUTREACH_CASE_STUDY_TYPES,
  GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES,
  GROWTH_LEAD_ENGINE_OUTREACH_CTA_STRATEGY_CATEGORIES,
  GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_OUTREACH_SEQUENCE_PRIORITIES,
  GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES,
  type GrowthLeadEngineOutreachCaseStudyType,
  type GrowthLeadEngineOutreachChannelPriority,
  type GrowthLeadEngineOutreachEvidenceBackedItem,
  type GrowthLeadEngineOutreachPersonalizationOutput,
  type GrowthLeadEngineOutreachPersonalizationSourceAttribution,
  type GrowthLeadEngineOutreachSequencePriority,
  type GrowthLeadEngineOutreachSocialProofType,
} from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

const MESSAGE_COPY =
  /\b(dear |hi |hello |hey |subject:|unsubscribe|click here|book a demo|schedule a call with me|best regards|sincerely,|sent from my iphone)\b/i

const UNSUPPORTED_EVIDENCE =
  /\b(assumed|invented|guess|speculated|probably|likely urgent|fabricated)\b/i

const CUSTOMER_NAME_PATTERN =
  /\b(customer|client)\s+(named|called)\s+[A-Z][a-z]+/i

const ALLOWED_CHANNELS = new Set<string>(GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES)
const ALLOWED_SEQUENCES = new Set<string>(GROWTH_LEAD_ENGINE_OUTREACH_SEQUENCE_PRIORITIES)
const ALLOWED_SOCIAL_PROOF = new Set<string>(GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES)
const ALLOWED_CASE_STUDIES = new Set<string>(GROWTH_LEAD_ENGINE_OUTREACH_CASE_STUDY_TYPES)
const ALLOWED_CTA_CATEGORIES = new Set<string>(GROWTH_LEAD_ENGINE_OUTREACH_CTA_STRATEGY_CATEGORIES)

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

function asCompleteness(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asEvidenceItems(value: unknown): GrowthLeadEngineOutreachEvidenceBackedItem[] {
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
      return { claim, evidence, source, confidence }
    })
    .filter((row): row is GrowthLeadEngineOutreachEvidenceBackedItem => row !== null)
}

function asSourceAttribution(
  value: unknown,
): GrowthLeadEngineOutreachPersonalizationSourceAttribution[] {
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
    .filter((row): row is GrowthLeadEngineOutreachPersonalizationSourceAttribution => row !== null)
}

function asChannelPriority(value: unknown): GrowthLeadEngineOutreachChannelPriority[] {
  const raw = asStringArray(value)
  const normalized = raw
    .map((entry) => entry.toUpperCase().replace(/\s+/g, "_"))
    .filter((entry): entry is GrowthLeadEngineOutreachChannelPriority =>
      ALLOWED_CHANNELS.has(entry),
    )
  return [...new Set(normalized)]
}

function asSequencePriority(value: unknown): GrowthLeadEngineOutreachSequencePriority {
  const raw = asString(value).toUpperCase().replace(/\s+/g, "_")
  return ALLOWED_SEQUENCES.has(raw)
    ? (raw as GrowthLeadEngineOutreachSequencePriority)
    : "EMAIL_BEFORE_PHONE"
}

function asSocialProofTypes(value: unknown): GrowthLeadEngineOutreachSocialProofType[] {
  const raw = asStringArray(value)
  const normalized = raw
    .map((entry) => entry.toUpperCase().replace(/\s+/g, "_"))
    .filter((entry): entry is GrowthLeadEngineOutreachSocialProofType =>
      ALLOWED_SOCIAL_PROOF.has(entry),
    )
  return [...new Set(normalized)]
}

function asCaseStudyTypes(value: unknown): GrowthLeadEngineOutreachCaseStudyType[] {
  const raw = asStringArray(value)
  const normalized = raw
    .map((entry) => entry.toUpperCase().replace(/\s+/g, "_"))
    .filter((entry): entry is GrowthLeadEngineOutreachCaseStudyType =>
      ALLOWED_CASE_STUDIES.has(entry),
    )
  return [...new Set(normalized)]
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

function sanitizeGuidanceString(value: string): string {
  if (!value || looksLikeMessageCopy(value) || CUSTOMER_NAME_PATTERN.test(value)) {
    return ""
  }
  return value
}

function claimSupportedByAttribution(
  claim: GrowthLeadEngineOutreachEvidenceBackedItem,
  attributions: GrowthLeadEngineOutreachPersonalizationSourceAttribution[],
): boolean {
  const needle = claim.claim.toLowerCase()
  const evidenceNeedle = claim.evidence.toLowerCase()
  return attributions.some((row) => {
    const hay = `${row.signal} ${row.evidence}`.toLowerCase()
    return hay.includes(needle) || hay.includes(evidenceNeedle)
  })
}

function filterEvidenceItems(
  items: GrowthLeadEngineOutreachEvidenceBackedItem[],
  attributions: GrowthLeadEngineOutreachPersonalizationSourceAttribution[],
): GrowthLeadEngineOutreachEvidenceBackedItem[] {
  return items.filter(
    (item) =>
      item.confidence >= 0.4 &&
      item.evidence.length > 0 &&
      !UNSUPPORTED_EVIDENCE.test(item.evidence) &&
      !UNSUPPORTED_EVIDENCE.test(item.claim) &&
      !looksLikeMessageCopy(item.claim) &&
      (claimSupportedByAttribution(item, attributions) || item.source.length > 0),
  )
}

function filterUrgencySignals(
  items: GrowthLeadEngineOutreachEvidenceBackedItem[],
  attributions: GrowthLeadEngineOutreachPersonalizationSourceAttribution[],
): GrowthLeadEngineOutreachEvidenceBackedItem[] {
  return filterEvidenceItems(items, attributions).filter(
    (item) =>
      !/\b(urgent|asap|immediate|act now|limited time)\b/i.test(item.claim) ||
      claimSupportedByAttribution(item, attributions),
  )
}

function normalizeCtaStrategy(value: string): string {
  const trimmed = sanitizeGuidanceString(value)
  if (!trimmed) {
    return "DISCOVERY_VALIDATION — confirm evidenced fit before any outreach copy."
  }
  const upper = trimmed.toUpperCase().replace(/\s+/g, "_")
  const matched = [...ALLOWED_CTA_CATEGORIES].find((category) => upper.includes(category))
  if (matched) {
    return `${matched} — informational guidance only; no generated messages.`
  }
  if (looksLikeMessageCopy(trimmed)) {
    return "DISCOVERY_VALIDATION — informational guidance only; no generated messages."
  }
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed
}

function enforceOutreachPersonalization(
  output: GrowthLeadEngineOutreachPersonalizationOutput,
  options: {
    verificationDisposition: string | null
    accountBriefHumanReview: boolean
  },
): GrowthLeadEngineOutreachPersonalizationOutput {
  let personalization_confidence = output.personalization_confidence
  let personalization_completeness = output.personalization_completeness
  let human_review_required = output.human_review_required

  const recommended_talking_points = filterEvidenceItems(
    output.recommended_talking_points,
    output.source_attribution,
  )
  const recommended_problem_alignment = filterEvidenceItems(
    output.recommended_problem_alignment,
    output.source_attribution,
  )
  const recommended_objection_categories = filterEvidenceItems(
    output.recommended_objection_categories,
    output.source_attribution,
  )
  const urgency_signals = filterUrgencySignals(output.urgency_signals, output.source_attribution)
  const timing_signals = filterEvidenceItems(output.timing_signals, output.source_attribution)

  let recommended_cta_strategy = normalizeCtaStrategy(output.recommended_cta_strategy)
  if (looksLikeMessageCopy(output.recommended_cta_strategy)) {
    human_review_required = true
  }

  let recommended_channel_priority = output.recommended_channel_priority
  if (recommended_channel_priority.length === 0) {
    recommended_channel_priority = ["EMAIL"]
    human_review_required = true
  }

  const recommended_business_outcomes = output.recommended_business_outcomes
    .map((entry) => sanitizeGuidanceString(entry))
    .filter((entry) => entry.length > 0)
    .slice(0, 8)

  if (output.source_attribution.length === 0) {
    personalization_confidence = Math.min(personalization_confidence, 0.45)
    personalization_completeness = Math.min(personalization_completeness, 40)
    human_review_required = true
  }

  if (personalization_confidence < 0.7) {
    human_review_required = true
  }
  if (personalization_completeness < 60) {
    human_review_required = true
  }
  if (options.verificationDisposition === "reject" || options.verificationDisposition === "risky") {
    human_review_required = true
    if (options.verificationDisposition === "reject") {
      personalization_confidence = Math.min(personalization_confidence, 0.49)
    }
  }
  if (options.accountBriefHumanReview) {
    human_review_required = true
  }

  if (!output.personalization_summary) {
    personalization_completeness = Math.min(personalization_completeness, 30)
    human_review_required = true
  }

  return {
    ...output,
    personalization_summary: sanitizeGuidanceString(output.personalization_summary),
    contact_context: sanitizeGuidanceString(output.contact_context),
    company_context: sanitizeGuidanceString(output.company_context),
    recommended_talking_points,
    recommended_problem_alignment,
    recommended_business_outcomes,
    recommended_objection_categories,
    recommended_cta_strategy,
    urgency_signals,
    timing_signals,
    recommended_channel_priority,
    personalization_confidence,
    personalization_completeness,
    human_review_required,
  }
}

export function parseGrowthLeadEngineOutreachPersonalizationOutput(
  raw: string,
  options?: {
    verificationDisposition?: string | null
    accountBriefHumanReview?: boolean
  },
): { ok: true; output: GrowthLeadEngineOutreachPersonalizationOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Outreach personalization response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const source_attribution = asSourceAttribution(record.source_attribution)
    if (source_attribution.length === 0) {
      return {
        ok: false,
        message: "Outreach personalization response must include source_attribution with evidence.",
      }
    }

    const output: GrowthLeadEngineOutreachPersonalizationOutput = {
      personalization_summary: asString(record.personalization_summary),
      contact_context: asString(record.contact_context),
      company_context: asString(record.company_context),
      recommended_talking_points: asEvidenceItems(record.recommended_talking_points),
      recommended_problem_alignment: asEvidenceItems(record.recommended_problem_alignment),
      recommended_business_outcomes: asStringArray(record.recommended_business_outcomes),
      recommended_social_proof_types: asSocialProofTypes(record.recommended_social_proof_types),
      recommended_case_study_types: asCaseStudyTypes(record.recommended_case_study_types),
      recommended_objection_categories: asEvidenceItems(record.recommended_objection_categories),
      recommended_cta_strategy: asString(record.recommended_cta_strategy),
      urgency_signals: asEvidenceItems(record.urgency_signals),
      timing_signals: asEvidenceItems(record.timing_signals),
      recommended_channel_priority: asChannelPriority(record.recommended_channel_priority),
      recommended_sequence_priority: asSequencePriority(record.recommended_sequence_priority),
      personalization_confidence: asConfidence(record.personalization_confidence),
      personalization_completeness: asCompleteness(record.personalization_completeness),
      human_review_required: record.human_review_required === true,
      evidence_summary: asString(record.evidence_summary),
      source_attribution,
    }

    if (!output.personalization_summary) {
      return { ok: false, message: "Outreach personalization response missing personalization_summary." }
    }
    if (!output.contact_context) {
      return { ok: false, message: "Outreach personalization response missing contact_context." }
    }
    if (!output.company_context) {
      return { ok: false, message: "Outreach personalization response missing company_context." }
    }
    if (!output.recommended_cta_strategy) {
      return { ok: false, message: "Outreach personalization response missing recommended_cta_strategy." }
    }

    const enforced = enforceOutreachPersonalization(output, {
      verificationDisposition: options?.verificationDisposition ?? null,
      accountBriefHumanReview: options?.accountBriefHumanReview ?? false,
    })

    if (
      enforced.personalization_confidence > 0.85 &&
      enforced.human_review_required &&
      enforced.personalization_completeness < 50
    ) {
      return {
        ok: false,
        message:
          "Outreach personalization marked high confidence but completeness too low for human review flag.",
      }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not parse outreach personalization JSON.",
    }
  }
}

export function parseGrowthLeadEngineOutreachPersonalizationFromUpstream(
  raw: string,
  upstream?: {
    verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
    accountBrief?: GrowthLeadEngineAccountBriefOutput | string
  },
): ReturnType<typeof parseGrowthLeadEngineOutreachPersonalizationOutput> {
  let verificationDisposition: string | null = null
  let accountBriefHumanReview = false

  if (upstream?.verificationTriage && typeof upstream.verificationTriage === "object") {
    verificationDisposition = upstream.verificationTriage.disposition
  }
  if (upstream?.accountBrief && typeof upstream.accountBrief === "object") {
    accountBriefHumanReview = upstream.accountBrief.human_review_required === true
  }

  return parseGrowthLeadEngineOutreachPersonalizationOutput(raw, {
    verificationDisposition,
    accountBriefHumanReview,
  })
}

export function assertGrowthLeadEngineOutreachPersonalizationOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_OUTPUT_JSON_KEYS
}

/**
 * GE-IRE-6D — deterministic contact-level engagement prediction.
 * Uses Email Learning observations and heuristics. No LLM or external providers.
 */

import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import {
  aggregateEmailLearningByDomain,
  inferEmailLocalPartPattern,
  type EmailLearningObservation,
  type EmailLearningOutcomeType,
} from "@/lib/growth/contact-verification/email-learning"
import { normalizeIdentityResolutionIndustry } from "@/lib/growth/contact-verification/identity-resolution-engine"
import { normalizeEmail, parseEmailDomain } from "@/lib/growth/import/normalize"

export const GROWTH_CONTACT_ENGAGEMENT_PREDICTION_QA_MARKER =
  "contact-engagement-prediction-v1" as const

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

const REPLY_OUTCOMES = new Set<EmailLearningOutcomeType>([
  "replied",
  "positive_reply",
  "negative_reply",
])

const MEETING_OUTCOMES = new Set<EmailLearningOutcomeType>(["meeting_booked"])

const POSITIVE_OUTCOMES = new Set<EmailLearningOutcomeType>([
  "replied",
  "positive_reply",
  "meeting_booked",
  "opened",
  "clicked",
])

const INDUSTRY_REPLY_BASELINE: Record<
  ReturnType<typeof normalizeIdentityResolutionIndustry>,
  number
> = {
  healthcare: 0.14,
  manufacturing: 0.11,
  construction: 0.1,
  software: 0.16,
  government: 0.08,
  education: 0.09,
  professional_services: 0.15,
  default: 0.12,
}

const INDUSTRY_MEETING_BASELINE: Record<
  ReturnType<typeof normalizeIdentityResolutionIndustry>,
  number
> = {
  healthcare: 0.04,
  manufacturing: 0.03,
  construction: 0.025,
  software: 0.05,
  government: 0.02,
  education: 0.025,
  professional_services: 0.045,
  default: 0.035,
}

const TITLE_REPLY_BOOSTS: Array<{ pattern: RegExp; boost: number; label: string }> = [
  { pattern: /\b(director|vp|vice president|head of)\b/i, boost: 0.04, label: "Leadership title reply lift" },
  { pattern: /\b(operations|procurement|facilities|service)\b/i, boost: 0.03, label: "Operations-facing title reply lift" },
  { pattern: /\b(manager|supervisor|coordinator)\b/i, boost: 0.02, label: "Manager-level title reply lift" },
]

const DEPARTMENT_REPLY_BOOSTS: Record<string, number> = {
  operations: 0.035,
  procurement: 0.03,
  facilities: 0.025,
  service: 0.02,
  executive: 0.04,
}

export type ContactEngagementPredictionInput = {
  companyName?: string
  domain?: string
  industry?: string
  contact: {
    firstName?: string
    lastName?: string
    fullName?: string
    email?: string
    jobTitle?: string
    department?: string
    seniority?: string
    source?: string
    sourceConfidence?: number
  }
  historicalLearning?: EmailLearningObservation[]
  roleSignals?: unknown
  relationshipSignals?: unknown
}

export type ContactEngagementPrediction = {
  qa_marker: typeof GROWTH_CONTACT_ENGAGEMENT_PREDICTION_QA_MARKER
  reply_probability: number
  meeting_probability: number
  engagement_score: number
  engagement_tier: "high" | "medium" | "low" | "unknown"
  confidence: number
  reasons: string[]
  evidence: string[]
  warnings: string[]
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0
  return roundScore(Math.max(0, Math.min(1, value)))
}

function slugPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function normalizeDomain(domain: string | null | undefined): string | null {
  const trimmed = (domain ?? "").trim().toLowerCase()
  if (!trimmed) return null
  return trimmed.replace(/^www\./, "")
}

function computeOutcomeRate(input: {
  observations: readonly EmailLearningObservation[]
  filter: (row: EmailLearningObservation) => boolean
  numeratorOutcomes: Set<EmailLearningOutcomeType>
  denominatorOutcomes?: Set<EmailLearningOutcomeType>
}): number | null {
  const filtered = input.observations.filter(input.filter)
  if (filtered.length === 0) return null

  const denominatorEvents = filtered.filter((row) =>
    input.denominatorOutcomes
      ? input.denominatorOutcomes.has(row.event_type)
      : row.event_type === "sent" || row.event_type === "delivered",
  ).length

  const denominator =
    denominatorEvents > 0
      ? denominatorEvents
      : filtered.filter((row) => row.event_type === "sent" || row.event_type === "delivered").length ||
        filtered.length

  if (denominator <= 0) return null

  const numerator = filtered.filter((row) => input.numeratorOutcomes.has(row.event_type)).length
  return clampProbability(numerator / denominator)
}

function readRelationshipBoost(signals: unknown): {
  replyBoost: number
  meetingBoost: number
  reasons: string[]
} {
  if (!signals || typeof signals !== "object") {
    return { replyBoost: 0, meetingBoost: 0, reasons: [] }
  }

  const record = signals as Record<string, unknown>
  const reasons: string[] = []
  let replyBoost = 0
  let meetingBoost = 0

  if (record.prior_positive_reply === true) {
    replyBoost += 0.12
    reasons.push("Prior positive reply on record")
  }
  if (record.prior_meeting === true) {
    meetingBoost += 0.1
    reasons.push("Prior meeting on record")
  }
  if (record.active_conversation === true) {
    replyBoost += 0.08
    reasons.push("Active conversation placeholder")
  }
  if (record.known_relationship === true) {
    replyBoost += 0.05
    meetingBoost += 0.04
    reasons.push("Known relationship placeholder")
  }

  return { replyBoost, meetingBoost, reasons }
}

export function deriveEngagementTier(score: number, hasData: boolean): ContactEngagementPrediction["engagement_tier"] {
  if (!hasData && score <= 0) return "unknown"
  if (score >= 0.75) return "high"
  if (score >= 0.5) return "medium"
  if (score > 0) return "low"
  return "unknown"
}

export function computeEngagementPredictionConfidence(input: {
  observationCount: number
  hasContactHistory: boolean
  hasDomainHistory: boolean
  hasTitleHeuristics: boolean
}): number {
  let confidence = 25
  if (input.hasDomainHistory) confidence += 25
  if (input.hasContactHistory) confidence += 30
  if (input.hasTitleHeuristics) confidence += 10
  if (input.observationCount >= 10) confidence += 10
  return Math.max(0, Math.min(100, confidence))
}

export function predictContactEngagement(
  input: ContactEngagementPredictionInput,
): ContactEngagementPrediction {
  const reasons: string[] = []
  const evidence: string[] = []
  const warnings: string[] = []

  const industry = normalizeIdentityResolutionIndustry(input.industry)
  const domain = normalizeDomain(input.domain) ?? normalizeDomain(parseEmailDomain(input.contact.email))
  const email = normalizeEmail(input.contact.email)
  const observations = input.historicalLearning ?? []
  const domainObservations = domain
    ? observations.filter((row) => row.domain === domain)
    : observations

  const domainStats = domain ? aggregateEmailLearningByDomain(observations).find((row) => row.domain === domain) : null

  let replyProbability = INDUSTRY_REPLY_BASELINE[industry]
  let meetingProbability = INDUSTRY_MEETING_BASELINE[industry]
  reasons.push(`${industry.replace(/_/g, " ")} industry baseline`)

  let signalCount = 0
  let hasDomainHistory = false
  let hasContactHistory = false

  if (domainStats?.reply_rate != null) {
    replyProbability = clampProbability(replyProbability * 0.4 + domainStats.reply_rate * 0.6)
    hasDomainHistory = true
    signalCount += 1
    evidence.push("domain_reply_rate_observed")
    reasons.push("Historical domain reply rate applied")
  }

  if (domainStats && domainStats.messages_sent > 0) {
    const domainMeetingRate = clampProbability(domainStats.meetings / domainStats.messages_sent)
    meetingProbability = clampProbability(meetingProbability * 0.45 + domainMeetingRate * 0.55)
    hasDomainHistory = true
    evidence.push("domain_meeting_rate_observed")
    reasons.push("Historical domain meeting rate applied")
  }

  if (email) {
    const contactReplyRate = computeOutcomeRate({
      observations: domainObservations,
      filter: (row) => row.normalized_email === email,
      numeratorOutcomes: REPLY_OUTCOMES,
      denominatorOutcomes: new Set(["sent", "delivered", "opened", "clicked"]),
    })
    if (contactReplyRate != null) {
      replyProbability = clampProbability(replyProbability * 0.5 + contactReplyRate * 0.5)
      hasContactHistory = true
      signalCount += 1
      evidence.push("contact_email_reply_history")
      reasons.push("Contact email reply history applied")
    }

    const contactMeetingRate = computeOutcomeRate({
      observations: domainObservations,
      filter: (row) => row.normalized_email === email,
      numeratorOutcomes: MEETING_OUTCOMES,
    })
    if (contactMeetingRate != null) {
      meetingProbability = clampProbability(meetingProbability * 0.5 + contactMeetingRate * 0.5)
      hasContactHistory = true
      evidence.push("contact_email_meeting_history")
      reasons.push("Contact email meeting history applied")
    }
  }

  const titleContext = [input.contact.jobTitle, input.contact.department, input.contact.seniority]
    .filter(Boolean)
    .join(" ")

  let hasTitleHeuristics = false
  for (const rule of TITLE_REPLY_BOOSTS) {
    if (rule.pattern.test(titleContext)) {
      replyProbability = clampProbability(replyProbability + rule.boost)
      hasTitleHeuristics = true
      reasons.push(rule.label)
    }
  }

  const departmentKey = slugPart(input.contact.department)
  if (departmentKey && DEPARTMENT_REPLY_BOOSTS[departmentKey]) {
    replyProbability = clampProbability(replyProbability + DEPARTMENT_REPLY_BOOSTS[departmentKey])
    hasTitleHeuristics = true
    reasons.push(`${input.contact.department} department reply heuristic`)
  }

  if (email) {
    const pattern = inferEmailLocalPartPattern(email, {
      firstName: input.contact.firstName,
      lastName: input.contact.lastName,
    })
    const patternReplyRate = computeOutcomeRate({
      observations: domainObservations,
      filter: (row) => row.email_pattern === pattern,
      numeratorOutcomes: REPLY_OUTCOMES,
    })
    if (patternReplyRate != null) {
      replyProbability = clampProbability(replyProbability * 0.7 + patternReplyRate * 0.3)
      evidence.push("pattern_reply_history")
      reasons.push("Email pattern reply history applied")
    }
  }

  const titleReplyRate = computeOutcomeRate({
    observations: domainObservations,
    filter: (row) => {
      const title =
        typeof row.metadata.contact_title === "string" ? row.metadata.contact_title : ""
      return title && titleContext && new RegExp(titleContext.split(/\s+/)[0] ?? "", "i").test(title)
    },
    numeratorOutcomes: REPLY_OUTCOMES,
  })
  if (titleReplyRate != null) {
    replyProbability = clampProbability(replyProbability * 0.85 + titleReplyRate * 0.15)
    evidence.push("title_reply_history")
  }

  if (typeof input.contact.sourceConfidence === "number") {
    replyProbability = clampProbability(replyProbability * 0.9 + input.contact.sourceConfidence * 0.1)
    reasons.push("Discovery source confidence considered")
  }

  const relationship = readRelationshipBoost(input.relationshipSignals)
  replyProbability = clampProbability(replyProbability + relationship.replyBoost)
  meetingProbability = clampProbability(meetingProbability + relationship.meetingBoost)
  reasons.push(...relationship.reasons)

  const positiveSignalCount = domainObservations.filter((row) => POSITIVE_OUTCOMES.has(row.event_type)).length
  if (positiveSignalCount > 0) {
    evidence.push(`positive_domain_signals:${positiveSignalCount}`)
  }

  if (observations.length === 0) {
    warnings.push("insufficient_historical_learning")
  }
  if (!email) {
    warnings.push("contact_email_missing_for_history")
  }

  const engagementScore = clampProbability(replyProbability * 0.55 + meetingProbability * 0.35 + (hasTitleHeuristics ? 0.1 : 0.05))
  const hasData = hasDomainHistory || hasContactHistory || observations.length > 0 || hasTitleHeuristics
  const tier = deriveEngagementTier(engagementScore, hasData)
  const confidence = computeEngagementPredictionConfidence({
    observationCount: domainObservations.length,
    hasContactHistory,
    hasDomainHistory,
    hasTitleHeuristics,
  })

  return {
    qa_marker: GROWTH_CONTACT_ENGAGEMENT_PREDICTION_QA_MARKER,
    reply_probability: replyProbability,
    meeting_probability: meetingProbability,
    engagement_score: engagementScore,
    engagement_tier: tier,
    confidence,
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)],
    warnings: [...new Set(warnings)],
  }
}

/** CRE integration helper — blends prediction with legacy heuristics and optional IRE signal. */
export function resolveContactEngagementScore(input: {
  prediction: ContactEngagementPrediction
  legacyScore?: number
  ireEngagement?: number | null
}): { score: number; reasons: string[] } {
  const reasons = [...input.prediction.reasons]
  let score = input.prediction.engagement_score

  if (input.legacyScore != null) {
    score = clampProbability(score * 0.75 + input.legacyScore * 0.25)
    reasons.push("Legacy engagement heuristics blended")
  }

  if (input.ireEngagement != null) {
    score = clampProbability(score * 0.8 + input.ireEngagement * 0.2)
    reasons.push("Identity engagement probability blended")
  }

  return { score: clampProbability(score), reasons }
}

export function maskEmailForPreview(email: string | null | undefined): string | null {
  if (!email?.trim()) return null
  return "***@***"
}

export function sanitizePreviewValue(value: unknown): unknown {
  if (typeof value === "string") {
    return PLAINTEXT_EMAIL_PATTERN.test(value) ? maskEmailForPreview(value) : value
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePreviewValue(item))
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const sanitized: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(record)) {
      if (key === "email" || key === "recommended_email") {
        sanitized[`${key}_present`] = typeof nested === "string" && nested.trim().length > 0
        if (key === "recommended_email" && typeof nested === "string") {
          sanitized.recommended_email_masked = maskEmailForPreview(nested)
        }
        continue
      }
      sanitized[key] = sanitizePreviewValue(nested)
    }
    return sanitized
  }
  return value
}

export function assertContactEngagementPreviewHasNoPlaintextEmails(output: unknown): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}

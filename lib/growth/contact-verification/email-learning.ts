/**
 * AI OS Email Intelligence Learning foundation (GE-EI-IMP-4A).
 * Normalizes outbound evidence into deterministic learning observations.
 * Does not score, promote, suppress, or persist — capture model only.
 * Client-safe.
 */

import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"
import { normalizeEmail, parseEmailDomain, parseEmailLocalPart } from "@/lib/growth/import/normalize"

export const GROWTH_EMAIL_LEARNING_QA_MARKER = "growth-email-learning-v1" as const

export const EMAIL_LEARNING_OUTCOME_TYPES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "positive_reply",
  "negative_reply",
  "meeting_booked",
  "bounce_hard",
  "bounce_soft",
  "complaint",
  "unsubscribe",
  "manual_verified",
  "manual_rejected",
] as const

export type EmailLearningOutcomeType = (typeof EMAIL_LEARNING_OUTCOME_TYPES)[number]

export const EMAIL_LEARNING_EVENT_SOURCES = [
  "outbound_send",
  "provider_webhook",
  "reply_intelligence",
  "meeting_booked",
  "manual_verification",
  "suppression",
  "compliance",
] as const

export type EmailLearningEventSource = (typeof EMAIL_LEARNING_EVENT_SOURCES)[number]

/** Placeholder pattern keys — future discovery learning (not consumed yet). */
export const EMAIL_LOCAL_PART_PATTERN_KEYS = [
  "first_dot_last",
  "first_last_concat",
  "first_initial_last",
  "first_only",
  "first_initial_dot_last",
  "first_dot_last_initial",
  "last_only",
  "unknown",
] as const

export type EmailLocalPartPatternKey = (typeof EMAIL_LOCAL_PART_PATTERN_KEYS)[number]

const OUTCOME_ALIASES: Record<string, EmailLearningOutcomeType> = {
  send: "sent",
  sent: "sent",
  delivery: "delivered",
  delivered: "delivered",
  open: "opened",
  opened: "opened",
  click: "clicked",
  clicked: "clicked",
  reply: "replied",
  replied: "replied",
  positive: "positive_reply",
  positive_reply: "positive_reply",
  interested: "positive_reply",
  negative: "negative_reply",
  negative_reply: "negative_reply",
  not_interested: "negative_reply",
  meeting: "meeting_booked",
  meeting_booked: "meeting_booked",
  demo_request: "meeting_booked",
  hard_bounce: "bounce_hard",
  bounce_hard: "bounce_hard",
  bounced: "bounce_hard",
  soft_bounce: "bounce_soft",
  bounce_soft: "bounce_soft",
  spam_complaint: "complaint",
  complaint: "complaint",
  complained: "complaint",
  unsubscribed: "unsubscribe",
  unsubscribe: "unsubscribe",
  verified: "manual_verified",
  manual_verified: "manual_verified",
  rejected: "manual_rejected",
  manual_rejected: "manual_rejected",
}

const OUTCOMES_REQUIRING_EMAIL = new Set<EmailLearningOutcomeType>([
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "positive_reply",
  "negative_reply",
  "meeting_booked",
  "bounce_hard",
  "bounce_soft",
  "complaint",
  "unsubscribe",
  "manual_verified",
  "manual_rejected",
])

export type EmailLearningObservationInput = {
  email?: string | null
  organizationId?: string | null
  company?: string | null
  contactId?: string | null
  campaignId?: string | null
  sequenceId?: string | null
  provider?: string | null
  outcome: string
  eventTimestamp?: string | null
  source: string
  dedupeKey?: string | null
  metadata?: Record<string, unknown>
  firstName?: string | null
  lastName?: string | null
}

export type EmailLearningObservation = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_QA_MARKER
  observation_id: string
  email: string | null
  normalized_email: string | null
  domain: string | null
  organization_id: string | null
  company: string | null
  contact_id: string | null
  campaign_id: string | null
  sequence_id: string | null
  provider: string | null
  event_type: EmailLearningOutcomeType
  event_timestamp: string
  source: EmailLearningEventSource
  email_pattern: EmailLocalPartPatternKey | null
  metadata: Record<string, unknown>
}

export type EmailLearningBuildResult = {
  ok: boolean
  observation: EmailLearningObservation | null
  rejection_reason: string | null
}

export type EmailPatternLearningRecord = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_QA_MARKER
  pattern_key: EmailLocalPartPatternKey
  domain: string
  normalized_email: string
  proved_correct: boolean
  observed_at: string
  source: EmailLearningEventSource
  metadata: Record<string, unknown>
}

export type EmailDomainLearningStats = {
  domain: string
  messages_sent: number
  deliveries: number
  opens: number
  replies: number
  meetings: number
  hard_bounces: number
  complaints: number
  unsubscribe_count: number
  reply_rate: number | null
  bounce_rate: number | null
  unsubscribe_rate: number | null
}

function slugPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function isEmailLearningOutcomeType(value: string): value is EmailLearningOutcomeType {
  return (EMAIL_LEARNING_OUTCOME_TYPES as readonly string[]).includes(value)
}

function isEmailLearningEventSource(value: string): value is EmailLearningEventSource {
  return (EMAIL_LEARNING_EVENT_SOURCES as readonly string[]).includes(value)
}

function resolveOutcome(raw: string): EmailLearningOutcomeType | null {
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (isEmailLearningOutcomeType(normalized)) return normalized
  return OUTCOME_ALIASES[normalized] ?? null
}

function resolveEventTimestamp(raw: string | null | undefined): string | null {
  const value = asTrimmedString(raw)
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}

function hashObservationId(parts: string[]): string {
  let hash = 2166136261
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      hash ^= part.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function buildEmailLearningDedupeKey(input: {
  normalizedEmail: string | null
  eventType: EmailLearningOutcomeType
  eventTimestamp: string
  source: EmailLearningEventSource
  dedupeKey?: string | null
  campaignId?: string | null
  contactId?: string | null
}): string {
  if (input.dedupeKey) return input.dedupeKey.trim()
  return [
    input.normalizedEmail ?? "_",
    input.eventType,
    input.eventTimestamp,
    input.source,
    input.campaignId ?? "_",
    input.contactId ?? "_",
  ].join("|")
}

export function inferEmailLocalPartPattern(
  email: string,
  hint?: { firstName?: string | null; lastName?: string | null },
): EmailLocalPartPatternKey {
  const local = parseEmailLocalPart(email)
  if (!local) return "unknown"

  const first = slugPart(hint?.firstName)
  const last = slugPart(hint?.lastName)
  if (first && last) {
    const fi = first[0] ?? ""
    const li = last[0] ?? ""
    if (local === first) return "first_only"
    if (local === `${first}.${last}`) return "first_dot_last"
    if (local === `${first}${last}`) return "first_last_concat"
    if (local === `${fi}${last}`) return "first_initial_last"
    if (local === `${fi}.${last}`) return "first_initial_dot_last"
    if (local === `${first}.${li}`) return "first_dot_last_initial"
    if (local === last) return "last_only"
  }

  if (/^[a-z]+$/.test(local)) return "first_only"
  if (/^[a-z]+\.[a-z]+$/.test(local)) return "first_dot_last"
  if (/^[a-z][a-z]+$/.test(local) && local.length > 3) return "first_last_concat"
  if (/^[a-z][a-z]+$/.test(local)) return "first_initial_last"
  return "unknown"
}

export function validateEmailLearningObservationInput(
  input: EmailLearningObservationInput,
): { valid: boolean; reason: string | null; outcome: EmailLearningOutcomeType | null } {
  const outcome = resolveOutcome(input.outcome)
  if (!outcome) {
    return { valid: false, reason: "invalid_outcome", outcome: null }
  }

  const source = asTrimmedString(input.source)?.toLowerCase() ?? ""
  if (!isEmailLearningEventSource(source)) {
    return { valid: false, reason: "invalid_source", outcome }
  }

  const eventTimestamp = resolveEventTimestamp(input.eventTimestamp)
  if (!eventTimestamp) {
    return { valid: false, reason: "invalid_event_timestamp", outcome }
  }

  const normalizedEmail = normalizeEmail(input.email)
  if (OUTCOMES_REQUIRING_EMAIL.has(outcome) && !normalizedEmail) {
    return { valid: false, reason: "email_required", outcome }
  }

  if (normalizedEmail && !isValidGrowthEmailFormat(normalizedEmail)) {
    return { valid: false, reason: "invalid_email_format", outcome }
  }

  return { valid: true, reason: null, outcome }
}

export function normalizeEmailLearningObservationInput(
  input: EmailLearningObservationInput,
): EmailLearningObservationInput {
  return {
    ...input,
    email: normalizeEmail(input.email),
    organizationId: asTrimmedString(input.organizationId),
    company: asTrimmedString(input.company),
    contactId: asTrimmedString(input.contactId),
    campaignId: asTrimmedString(input.campaignId),
    sequenceId: asTrimmedString(input.sequenceId),
    provider: asTrimmedString(input.provider),
    source: (asTrimmedString(input.source)?.toLowerCase() ?? input.source) as string,
    dedupeKey: asTrimmedString(input.dedupeKey),
    firstName: asTrimmedString(input.firstName),
    lastName: asTrimmedString(input.lastName),
    metadata: input.metadata ?? {},
  }
}

export function buildEmailLearningObservation(
  input: EmailLearningObservationInput,
): EmailLearningBuildResult {
  try {
    const normalizedInput = normalizeEmailLearningObservationInput(input)
    const validation = validateEmailLearningObservationInput(normalizedInput)
    if (!validation.valid || !validation.outcome) {
      return {
        ok: false,
        observation: null,
        rejection_reason: validation.reason ?? "invalid_observation",
      }
    }

    const source = normalizedInput.source as EmailLearningEventSource
    const normalizedEmail = normalizeEmail(normalizedInput.email)
    const domain = normalizedEmail ? parseEmailDomain(normalizedEmail) : null
    const eventTimestamp = resolveEventTimestamp(normalizedInput.eventTimestamp)!
    const emailPattern = normalizedEmail
      ? inferEmailLocalPartPattern(normalizedEmail, {
          firstName: normalizedInput.firstName,
          lastName: normalizedInput.lastName,
        })
      : null

    const dedupeKey = buildEmailLearningDedupeKey({
      normalizedEmail,
      eventType: validation.outcome,
      eventTimestamp,
      source,
      dedupeKey: normalizedInput.dedupeKey,
      campaignId: normalizedInput.campaignId,
      contactId: normalizedInput.contactId,
    })

    const observation: EmailLearningObservation = {
      qa_marker: GROWTH_EMAIL_LEARNING_QA_MARKER,
      observation_id: hashObservationId([dedupeKey, GROWTH_EMAIL_LEARNING_QA_MARKER]),
      email: normalizedEmail,
      normalized_email: normalizedEmail,
      domain,
      organization_id: normalizedInput.organizationId,
      company: normalizedInput.company,
      contact_id: normalizedInput.contactId,
      campaign_id: normalizedInput.campaignId,
      sequence_id: normalizedInput.sequenceId,
      provider: normalizedInput.provider,
      event_type: validation.outcome,
      event_timestamp: eventTimestamp,
      source,
      email_pattern: emailPattern,
      metadata: normalizedInput.metadata ?? {},
    }

    return { ok: true, observation, rejection_reason: null }
  } catch {
    return { ok: false, observation: null, rejection_reason: "build_failed" }
  }
}

export function isDuplicateEmailLearningObservation(
  observation: EmailLearningObservation,
  seenKeys: ReadonlySet<string>,
): boolean {
  const key = buildEmailLearningDedupeKey({
    normalizedEmail: observation.normalized_email,
    eventType: observation.event_type,
    eventTimestamp: observation.event_timestamp,
    source: observation.source,
    dedupeKey: null,
    campaignId: observation.campaign_id,
    contactId: observation.contact_id,
  })
  return seenKeys.has(key)
}

export function buildEmailLearningObservations(
  inputs: EmailLearningObservationInput[],
): EmailLearningObservation[] {
  const seen = new Set<string>()
  const observations: EmailLearningObservation[] = []

  for (const input of inputs) {
    const result = buildEmailLearningObservation(input)
    if (!result.ok || !result.observation) continue

    const dedupeKey = buildEmailLearningDedupeKey({
      normalizedEmail: result.observation.normalized_email,
      eventType: result.observation.event_type,
      eventTimestamp: result.observation.event_timestamp,
      source: result.observation.source,
      dedupeKey: input.dedupeKey,
      campaignId: result.observation.campaign_id,
      contactId: result.observation.contact_id,
    })

    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    observations.push(result.observation)
  }

  return observations
}

export function recordEmailPatternLearningPlaceholder(input: {
  email: string
  provedCorrect: boolean
  observedAt?: string | null
  source: EmailLearningEventSource
  firstName?: string | null
  lastName?: string | null
  metadata?: Record<string, unknown>
}): EmailPatternLearningRecord | null {
  try {
    const normalizedEmail = normalizeEmail(input.email)
    const domain = normalizedEmail ? parseEmailDomain(normalizedEmail) : null
    const observedAt = resolveEventTimestamp(input.observedAt) ?? new Date().toISOString()
    if (!normalizedEmail || !domain) return null

    return {
      qa_marker: GROWTH_EMAIL_LEARNING_QA_MARKER,
      pattern_key: inferEmailLocalPartPattern(normalizedEmail, {
        firstName: input.firstName,
        lastName: input.lastName,
      }),
      domain,
      normalized_email: normalizedEmail,
      proved_correct: Boolean(input.provedCorrect),
      observed_at: observedAt,
      source: input.source,
      metadata: input.metadata ?? {},
    }
  } catch {
    return null
  }
}

function emptyDomainStats(domain: string): EmailDomainLearningStats {
  return {
    domain,
    messages_sent: 0,
    deliveries: 0,
    opens: 0,
    replies: 0,
    meetings: 0,
    hard_bounces: 0,
    complaints: 0,
    unsubscribe_count: 0,
    reply_rate: null,
    bounce_rate: null,
    unsubscribe_rate: null,
  }
}

function incrementDomainStat(stats: EmailDomainLearningStats, outcome: EmailLearningOutcomeType): void {
  switch (outcome) {
    case "sent":
      stats.messages_sent += 1
      break
    case "delivered":
      stats.deliveries += 1
      break
    case "opened":
      stats.opens += 1
      break
    case "replied":
    case "positive_reply":
    case "negative_reply":
      stats.replies += 1
      break
    case "meeting_booked":
      stats.meetings += 1
      break
    case "bounce_hard":
      stats.hard_bounces += 1
      break
    case "complaint":
      stats.complaints += 1
      break
    case "unsubscribe":
      stats.unsubscribe_count += 1
      break
    default:
      break
  }
}

export function computeDomainLearningRates(stats: EmailDomainLearningStats): EmailDomainLearningStats {
  const denominator = stats.messages_sent > 0 ? stats.messages_sent : stats.deliveries
  if (denominator <= 0) {
    return { ...stats, reply_rate: null, bounce_rate: null, unsubscribe_rate: null }
  }

  return {
    ...stats,
    reply_rate: roundRate(stats.replies / denominator),
    bounce_rate: roundRate(stats.hard_bounces / denominator),
    unsubscribe_rate: roundRate(stats.unsubscribe_count / denominator),
  }
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export function reduceEmailLearningObservationsToDomainStats(
  observations: readonly EmailLearningObservation[],
): EmailDomainLearningStats[] {
  const byDomain = new Map<string, EmailDomainLearningStats>()

  for (const observation of observations) {
    if (!observation.domain) continue
    const existing = byDomain.get(observation.domain) ?? emptyDomainStats(observation.domain)
    incrementDomainStat(existing, observation.event_type)
    byDomain.set(observation.domain, existing)
  }

  return [...byDomain.values()]
    .map((stats) => computeDomainLearningRates(stats))
    .sort((a, b) => a.domain.localeCompare(b.domain))
}

export function aggregateEmailLearningByDomain(
  observations: readonly EmailLearningObservation[],
): EmailDomainLearningStats[] {
  return reduceEmailLearningObservationsToDomainStats(observations)
}

export function emailLearningObservationFromOutboundSend(input: {
  email: string
  provider?: string | null
  campaignId?: string | null
  sequenceId?: string | null
  contactId?: string | null
  organizationId?: string | null
  company?: string | null
  sentAt?: string | null
  deliveryAttemptId?: string | null
}): EmailLearningBuildResult {
  return buildEmailLearningObservation({
    email: input.email,
    provider: input.provider,
    campaignId: input.campaignId,
    sequenceId: input.sequenceId,
    contactId: input.contactId,
    organizationId: input.organizationId,
    company: input.company,
    outcome: "sent",
    eventTimestamp: input.sentAt,
    source: "outbound_send",
    dedupeKey: input.deliveryAttemptId ? `delivery_attempt:${input.deliveryAttemptId}:sent` : null,
  })
}

export function emailLearningObservationFromProviderWebhook(input: {
  email: string
  normalizedEventType: string
  provider?: string | null
  campaignId?: string | null
  contactId?: string | null
  occurredAt?: string | null
  providerEventId?: string | null
}): EmailLearningBuildResult {
  const outcomeMap: Record<string, EmailLearningOutcomeType> = {
    delivered: "delivered",
    opened: "opened",
    clicked: "clicked",
    bounced: "bounce_hard",
    deferred: "bounce_soft",
    complained: "complaint",
    unsubscribed: "unsubscribe",
    failed: "bounce_hard",
    dropped: "bounce_hard",
    unknown: "sent",
  }
  const outcome = outcomeMap[input.normalizedEventType.trim().toLowerCase()] ?? "delivered"

  return buildEmailLearningObservation({
    email: input.email,
    provider: input.provider,
    campaignId: input.campaignId,
    contactId: input.contactId,
    outcome,
    eventTimestamp: input.occurredAt,
    source: "provider_webhook",
    dedupeKey: input.providerEventId ? `provider_event:${input.providerEventId}` : null,
  })
}

export function emailLearningObservationFromReplyIntelligence(input: {
  email: string
  intent?: string | null
  classification?: string | null
  contactId?: string | null
  campaignId?: string | null
  receivedAt?: string | null
  replyId?: string | null
}): EmailLearningBuildResult {
  let outcome: EmailLearningOutcomeType = "replied"
  const intent = (input.intent ?? "").trim().toLowerCase()
  const classification = (input.classification ?? "").trim().toLowerCase()

  if (intent === "meeting_request" || intent === "demo_request") outcome = "meeting_booked"
  else if (intent === "unsubscribe") outcome = "unsubscribe"
  else if (classification === "interested" || intent === "interested") outcome = "positive_reply"
  else if (classification === "not_interested" || intent === "not_interested") outcome = "negative_reply"

  return buildEmailLearningObservation({
    email: input.email,
    contactId: input.contactId,
    campaignId: input.campaignId,
    outcome,
    eventTimestamp: input.receivedAt,
    source: "reply_intelligence",
    dedupeKey: input.replyId ? `reply:${input.replyId}` : null,
  })
}

export function emailLearningObservationFromManualVerification(input: {
  email: string
  verified: boolean
  contactId?: string | null
  verifiedAt?: string | null
  verificationId?: string | null
}): EmailLearningBuildResult {
  return buildEmailLearningObservation({
    email: input.email,
    contactId: input.contactId,
    outcome: input.verified ? "manual_verified" : "manual_rejected",
    eventTimestamp: input.verifiedAt,
    source: "manual_verification",
    dedupeKey: input.verificationId ? `verification:${input.verificationId}` : null,
  })
}

export function emailLearningObservationFromCompliance(input: {
  email: string
  reason: string
  occurredAt?: string | null
  leadId?: string | null
}): EmailLearningBuildResult {
  const reason = input.reason.trim().toLowerCase()
  let outcome: EmailLearningOutcomeType = "unsubscribe"
  if (reason.includes("bounce")) outcome = "bounce_hard"
  else if (reason.includes("complaint")) outcome = "complaint"
  else if (reason.includes("unsubscribe")) outcome = "unsubscribe"

  return buildEmailLearningObservation({
    email: input.email,
    contactId: input.leadId,
    outcome,
    eventTimestamp: input.occurredAt,
    source: "compliance",
    dedupeKey: input.leadId ? `compliance:${input.leadId}:${outcome}:${input.occurredAt ?? ""}` : null,
  })
}

export function emailLearningObservationFromSuppression(input: {
  email: string
  reason: string
  suppressedAt?: string | null
  contactId?: string | null
}): EmailLearningBuildResult {
  const reason = input.reason.trim().toLowerCase()
  let outcome: EmailLearningOutcomeType = "unsubscribe"
  if (reason.includes("bounce")) outcome = "bounce_hard"
  else if (reason.includes("complaint") || reason.includes("spam")) outcome = "complaint"

  return buildEmailLearningObservation({
    email: input.email,
    contactId: input.contactId,
    outcome,
    eventTimestamp: input.suppressedAt,
    source: "suppression",
  })
}

export function emailLearningObservationFromMeetingBooked(input: {
  email: string
  contactId?: string | null
  campaignId?: string | null
  bookedAt?: string | null
  bookingId?: string | null
}): EmailLearningBuildResult {
  return buildEmailLearningObservation({
    email: input.email,
    contactId: input.contactId,
    campaignId: input.campaignId,
    outcome: "meeting_booked",
    eventTimestamp: input.bookedAt,
    source: "meeting_booked",
    dedupeKey: input.bookingId ? `booking:${input.bookingId}` : null,
  })
}

export function emailLearningObservationFromMessageEvent(input: {
  email: string
  eventType: string
  provider?: string | null
  leadId?: string | null
  campaignId?: string | null
  occurredAt?: string | null
  messageEventId?: string | null
}): EmailLearningBuildResult {
  const map: Record<string, EmailLearningOutcomeType> = {
    sent: "sent",
    delivered: "delivered",
    opened: "opened",
    clicked: "clicked",
    replied: "replied",
    bounced: "bounce_hard",
    unsubscribed: "unsubscribe",
    failed: "bounce_hard",
    spam_complaint: "complaint",
  }
  const outcome = map[input.eventType.trim().toLowerCase()] ?? "sent"

  return buildEmailLearningObservation({
    email: input.email,
    provider: input.provider,
    contactId: input.leadId,
    campaignId: input.campaignId,
    outcome,
    eventTimestamp: input.occurredAt,
    source: "provider_webhook",
    dedupeKey: input.messageEventId ? `message_event:${input.messageEventId}` : null,
  })
}

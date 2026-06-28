/**
 * GE-EI-IMP-4B — Historical Email Intelligence learning reconstruction.
 * Transforms existing production record shapes into deterministic learning observations.
 * Read-only / in-memory — no persistence, no runtime consumption.
 * Client-safe.
 */

import {
  aggregateEmailLearningByDomain,
  buildEmailLearningDedupeKey,
  buildEmailLearningObservations,
  emailLearningObservationFromCompliance,
  emailLearningObservationFromManualVerification,
  emailLearningObservationFromProviderWebhook,
  emailLearningObservationFromReplyIntelligence,
  GROWTH_EMAIL_LEARNING_QA_MARKER,
  inferEmailLocalPartPattern,
  type EmailDomainLearningStats,
  type EmailLearningObservation,
  type EmailLearningObservationInput,
  type EmailLocalPartPatternKey,
} from "@/lib/growth/contact-verification/email-learning"
import { normalizeEmail } from "@/lib/growth/import/normalize"

export const GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER = "growth-email-learning-reconstruction-v1" as const

const PATTERN_DISPLAY_LABELS: Record<EmailLocalPartPatternKey, string> = {
  first_dot_last: "firstname.lastname",
  first_last_concat: "firstlast",
  first_initial_last: "flast",
  first_only: "first",
  first_initial_dot_last: "f.last",
  first_dot_last_initial: "first.l",
  last_only: "last",
  unknown: "unknown",
}

const TIMELINE_EVENT_OUTCOME_MAP: Record<string, string> = {
  email_sent: "sent",
  email_delivered: "delivered",
  email_opened: "opened",
  email_clicked: "clicked",
  email_replied: "replied",
  email_bounced: "bounce_hard",
  email_unsubscribed: "unsubscribe",
  email_spam_complaint: "complaint",
  hard_bounce_detected: "bounce_hard",
  bounce_detected: "bounce_soft",
  complaint_detected: "complaint",
  unsubscribe_detected: "unsubscribe",
}

export type HistoricalDeliveryAttemptRecord = {
  id: string
  status?: string | null
  lead_id?: string | null
  leadId?: string | null
  sequence_enrollment_id?: string | null
  sequenceEnrollmentId?: string | null
  provider_id?: string | null
  providerId?: string | null
  sent_at?: string | null
  sentAt?: string | null
  failed_at?: string | null
  failedAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  failure_reason?: string | null
  failureReason?: string | null
  metadata?: Record<string, unknown> | null
  recipient_email?: string | null
  recipientEmail?: string | null
}

export type HistoricalProviderDeliveryEventRecord = {
  id: string
  normalized_event_type?: string | null
  normalizedEventType?: string | null
  provider_family?: string | null
  providerFamily?: string | null
  lead_id?: string | null
  leadId?: string | null
  delivery_attempt_id?: string | null
  deliveryAttemptId?: string | null
  occurred_at?: string | null
  occurredAt?: string | null
  recipient_email?: string | null
  recipientEmail?: string | null
}

export type HistoricalOutboundMessageRecord = {
  id: string
  lead_id?: string | null
  leadId?: string | null
  contact_id?: string | null
  contactId?: string | null
  campaign_id?: string | null
  campaignId?: string | null
  status?: string | null
  sent_at?: string | null
  sentAt?: string | null
  delivered_at?: string | null
  deliveredAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  email?: string | null
  recipient_email?: string | null
  recipientEmail?: string | null
}

export type HistoricalOutboundReplyRecord = {
  id: string
  lead_id?: string | null
  leadId?: string | null
  contact_id?: string | null
  contactId?: string | null
  received_at?: string | null
  receivedAt?: string | null
  classification?: string | null
  intent?: string | null
  email?: string | null
  sender_email?: string | null
  senderEmail?: string | null
}

export type HistoricalReplyIngestionEventRecord = {
  id: string
  sender_email?: string | null
  senderEmail?: string | null
  lead_id?: string | null
  leadId?: string | null
  campaign_id?: string | null
  campaignId?: string | null
  received_at?: string | null
  receivedAt?: string | null
  normalized_payload?: Record<string, unknown> | null
  normalizedPayload?: Record<string, unknown> | null
  outbound_reply_id?: string | null
  outboundReplyId?: string | null
}

export type HistoricalEmailBounceRecord = {
  id: string
  lead_id?: string | null
  leadId?: string | null
  bounce_type?: string | null
  bounceType?: string | null
  occurred_at?: string | null
  occurredAt?: string | null
  recipient_email?: string | null
  recipientEmail?: string | null
}

export type HistoricalEmailComplaintRecord = {
  id: string
  lead_id?: string | null
  leadId?: string | null
  complaint_type?: string | null
  complaintType?: string | null
  occurred_at?: string | null
  occurredAt?: string | null
  recipient_email?: string | null
  recipientEmail?: string | null
}

export type HistoricalContactVerificationRecord = {
  id: string
  contact_candidate_id?: string | null
  contactCandidateId?: string | null
  email_status?: string | null
  emailStatus?: string | null
  created_at?: string | null
  createdAt?: string | null
  email?: string | null
  normalized_email?: string | null
  normalizedEmail?: string | null
  metadata?: Record<string, unknown> | null
  source_attribution?: Array<{ source?: string | null; signal?: string | null }> | null
  sourceAttribution?: Array<{ source?: string | null; signal?: string | null }> | null
}

export type HistoricalTimelineEventRecord = {
  id: string
  lead_id?: string | null
  leadId?: string | null
  event_type?: string | null
  eventType?: string | null
  occurred_at?: string | null
  occurredAt?: string | null
  payload?: Record<string, unknown> | null
  email?: string | null
  recipient_email?: string | null
  recipientEmail?: string | null
}

export type EmailLearningHistoricalBatchInput = {
  deliveryAttempts?: HistoricalDeliveryAttemptRecord[]
  providerEvents?: HistoricalProviderDeliveryEventRecord[]
  outboundMessages?: HistoricalOutboundMessageRecord[]
  outboundReplies?: HistoricalOutboundReplyRecord[]
  replyIngestionEvents?: HistoricalReplyIngestionEventRecord[]
  emailBounces?: HistoricalEmailBounceRecord[]
  emailComplaints?: HistoricalEmailComplaintRecord[]
  contactVerifications?: HistoricalContactVerificationRecord[]
  timelineEvents?: HistoricalTimelineEventRecord[]
}

export type EmailLearningReconstructionSummary = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER
  observations_created: number
  duplicates_removed: number
  unsupported_events_skipped: number
  invalid_records_skipped: number
  domains_discovered: string[]
  email_patterns_identified: EmailLocalPartPatternKey[]
}

export type EmailLearningReconstructionBatchResult = {
  observations: EmailLearningObservation[]
  summary: EmailLearningReconstructionSummary
}

export type EmailDomainIntelligencePreview = {
  domain: string
  messages_sent: number
  replies: number
  reply_rate: string | null
  hard_bounces: number
  complaint_rate: string | null
  most_successful_pattern: string | null
  best_discovery_source: string | null
}

export type EmailPatternIntelligenceSummary = {
  pattern_key: EmailLocalPartPatternKey
  pattern_label: string
  observed_count: number
  verification_success_count: number
  reply_success_count: number
  meeting_success_count: number
}

export type EmailLearningObservationComparison = {
  matched: boolean
  left_count: number
  right_count: number
  only_in_left: string[]
  only_in_right: string[]
}

function readField<T>(record: Record<string, unknown>, ...keys: string[]): T | null {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) return value as T
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function extractRecipientEmail(
  record: Record<string, unknown>,
  metadata?: Record<string, unknown> | null,
): string | null {
  const direct =
    readField<string>(record, "recipientEmail", "recipient_email", "email", "senderEmail", "sender_email") ??
    null
  if (direct) return direct

  const meta = metadata ?? asRecord(record.metadata)
  if (!meta) return null
  return (
    readField<string>(meta, "to", "recipient_email", "recipientEmail", "email", "normalized_email") ?? null
  )
}

function formatRate(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null
  return `${(value * 100).toFixed(1)}%`
}

function patternLabel(key: EmailLocalPartPatternKey | null | undefined): string | null {
  if (!key) return null
  return PATTERN_DISPLAY_LABELS[key] ?? key
}

function collectInputs(
  inputs: EmailLearningObservationInput[],
): { observations: EmailLearningObservation[]; invalid: number } {
  const observations: EmailLearningObservation[] = []
  let invalid = 0
  for (const input of inputs) {
    const built = buildEmailLearningObservations([input])
    if (built.length === 0) invalid += 1
    observations.push(...built)
  }
  return { observations, invalid }
}

function dedupeObservations(observations: EmailLearningObservation[]): {
  observations: EmailLearningObservation[]
  duplicates_removed: number
} {
  const seen = new Set<string>()
  const unique: EmailLearningObservation[] = []
  let duplicates = 0

  for (const observation of observations) {
    const key = buildEmailLearningDedupeKey({
      normalizedEmail: observation.normalized_email,
      eventType: observation.event_type,
      eventTimestamp: observation.event_timestamp,
      source: observation.source,
      dedupeKey: null,
      campaignId: observation.campaign_id,
      contactId: observation.contact_id,
    })
    if (seen.has(key)) {
      duplicates += 1
      continue
    }
    seen.add(key)
    unique.push(observation)
  }

  return { observations: unique, duplicates_removed: duplicates }
}

export function reconstructEmailLearningFromDeliveryAttempt(
  record: HistoricalDeliveryAttemptRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email = extractRecipientEmail(row, record.metadata)
    if (!email) return []

    const status = String(readField<string>(row, "status") ?? "").toLowerCase()
    const leadId = readField<string>(row, "leadId", "lead_id")
    const sequenceId = readField<string>(row, "sequenceEnrollmentId", "sequence_enrollment_id")
    const provider = readField<string>(row, "providerId", "provider_id")
    const attemptId = readField<string>(row, "id") ?? ""
    const sentAt = readField<string>(row, "sentAt", "sent_at", "createdAt", "created_at")
    const failedAt = readField<string>(row, "failedAt", "failed_at")
    const failureReason = readField<string>(row, "failureReason", "failure_reason")

    const inputs: EmailLearningObservationInput[] = []

    if (status === "sent" || status === "queued") {
      inputs.push({
        email,
        outcome: "sent",
        source: "outbound_send",
        eventTimestamp: sentAt,
        sequenceId,
        contactId: leadId,
        provider,
        dedupeKey: `delivery_attempt:${attemptId}:sent`,
        metadata: { reconstruction_source: "delivery_attempts" },
      })
    }

    if (status === "failed") {
      const bounceLike = /bounce|suppression|invalid|blocked/i.test(failureReason ?? "")
      inputs.push({
        email,
        outcome: bounceLike ? "bounce_hard" : "sent",
        source: "outbound_send",
        eventTimestamp: failedAt ?? sentAt,
        sequenceId,
        contactId: leadId,
        provider,
        dedupeKey: `delivery_attempt:${attemptId}:failed`,
        metadata: { reconstruction_source: "delivery_attempts", status, failure_reason: failureReason },
      })
    }

    return collectInputs(inputs).observations
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromProviderEvent(
  record: HistoricalProviderDeliveryEventRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email = extractRecipientEmail(row)
    const normalizedEventType =
      readField<string>(row, "normalizedEventType", "normalized_event_type") ?? "unknown"
    if (!email) return []

    const result = emailLearningObservationFromProviderWebhook({
      email,
      normalizedEventType,
      provider: readField<string>(row, "providerFamily", "provider_family"),
      contactId: readField<string>(row, "leadId", "lead_id"),
      occurredAt: readField<string>(row, "occurredAt", "occurred_at"),
      providerEventId: readField<string>(row, "id") ?? undefined,
    })

    return result.ok && result.observation ? [result.observation] : []
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromOutboundMessage(
  record: HistoricalOutboundMessageRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email = extractRecipientEmail(row, asRecord(record.metadata))
    if (!email) return []

    const messageId = readField<string>(row, "id") ?? ""
    const leadId = readField<string>(row, "leadId", "lead_id")
    const campaignId = readField<string>(row, "campaignId", "campaign_id")
    const contactId = readField<string>(row, "contactId", "contact_id")
    const sentAt = readField<string>(row, "sentAt", "sent_at")
    const deliveredAt = readField<string>(row, "deliveredAt", "delivered_at")
    const status = String(readField<string>(row, "status") ?? "").toLowerCase()
    const inputs: EmailLearningObservationInput[] = []

    if (sentAt || status === "sent" || status === "delivered" || status === "pending") {
      inputs.push({
        email,
        outcome: "sent",
        source: "outbound_send",
        eventTimestamp: sentAt ?? readField<string>(row, "createdAt", "created_at"),
        contactId: contactId ?? leadId,
        campaignId,
        dedupeKey: `outbound_message:${messageId}:sent`,
        metadata: { reconstruction_source: "outbound_messages" },
      })
    }

    if (deliveredAt || status === "delivered") {
      inputs.push({
        email,
        outcome: "delivered",
        source: "provider_webhook",
        eventTimestamp: deliveredAt ?? sentAt,
        contactId: contactId ?? leadId,
        campaignId,
        dedupeKey: `outbound_message:${messageId}:delivered`,
        metadata: { reconstruction_source: "outbound_messages" },
      })
    }

    if (status === "bounced") {
      inputs.push({
        email,
        outcome: "bounce_hard",
        source: "compliance",
        eventTimestamp: deliveredAt ?? sentAt,
        contactId: contactId ?? leadId,
        campaignId,
        dedupeKey: `outbound_message:${messageId}:bounced`,
        metadata: { reconstruction_source: "outbound_messages" },
      })
    }

    return collectInputs(inputs).observations
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromReply(
  record: HistoricalOutboundReplyRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email = extractRecipientEmail(row)
    if (!email) return []

    const result = emailLearningObservationFromReplyIntelligence({
      email,
      intent: readField<string>(row, "intent"),
      classification: readField<string>(row, "classification"),
      contactId: readField<string>(row, "contactId", "contact_id") ?? readField<string>(row, "leadId", "lead_id"),
      receivedAt: readField<string>(row, "receivedAt", "received_at"),
      replyId: readField<string>(row, "id") ?? undefined,
    })

    return result.ok && result.observation ? [result.observation] : []
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromReplyIngestion(
  record: HistoricalReplyIngestionEventRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const normalizedPayload = asRecord(record.normalizedPayload ?? record.normalized_payload)
    const email =
      extractRecipientEmail(row) ??
      (normalizedPayload ? readField<string>(normalizedPayload, "sender_email", "email") : null)
    if (!email) return []

    const intent = normalizedPayload ? readField<string>(normalizedPayload, "intent") : null
    const classification = normalizedPayload ? readField<string>(normalizedPayload, "classification") : null

    const result = emailLearningObservationFromReplyIntelligence({
      email,
      intent,
      classification,
      contactId: readField<string>(row, "leadId", "lead_id"),
      campaignId: readField<string>(row, "campaignId", "campaign_id"),
      receivedAt: readField<string>(row, "receivedAt", "received_at"),
      replyId: readField<string>(row, "outboundReplyId", "outbound_reply_id") ?? readField<string>(row, "id") ?? undefined,
    })

    if (result.ok && result.observation) {
      return [
        {
          ...result.observation,
          metadata: {
            ...result.observation.metadata,
            reconstruction_source: "reply_ingestion_events",
            ingestion_event_id: readField<string>(row, "id"),
          },
        },
      ]
    }

    return []
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromBounce(
  record: HistoricalEmailBounceRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email = extractRecipientEmail(row)
    if (!email) return []

    const bounceType = String(readField<string>(row, "bounceType", "bounce_type") ?? "hard").toLowerCase()
    const reason =
      bounceType === "soft" || bounceType === "transient"
        ? "Soft bounce (soft)"
        : `Hard bounce (${bounceType || "hard"})`

    const result = emailLearningObservationFromCompliance({
      email,
      reason,
      occurredAt: readField<string>(row, "occurredAt", "occurred_at"),
      leadId: readField<string>(row, "leadId", "lead_id"),
    })

    if (result.ok && result.observation) {
      return [
        {
          ...result.observation,
          event_type: bounceType === "soft" || bounceType === "transient" ? "bounce_soft" : "bounce_hard",
          metadata: {
            ...result.observation.metadata,
            reconstruction_source: "email_bounces",
            bounce_id: readField<string>(row, "id"),
          },
        },
      ]
    }

    return []
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromComplaint(
  record: HistoricalEmailComplaintRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email = extractRecipientEmail(row)
    if (!email) return []

    const complaintType = readField<string>(row, "complaintType", "complaint_type") ?? "complaint"
    const result = emailLearningObservationFromCompliance({
      email,
      reason: `Complaint (${complaintType})`,
      occurredAt: readField<string>(row, "occurredAt", "occurred_at"),
      leadId: readField<string>(row, "leadId", "lead_id"),
    })

    return result.ok && result.observation
      ? [
          {
            ...result.observation,
            metadata: {
              ...result.observation.metadata,
              reconstruction_source: "email_complaints",
              complaint_id: readField<string>(row, "id"),
            },
          },
        ]
      : []
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromVerification(
  record: HistoricalContactVerificationRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const email =
      extractRecipientEmail(row) ??
      readField<string>(row, "normalizedEmail", "normalized_email") ??
      readField<string>(asRecord(record.metadata) ?? {}, "email", "normalized_email")
    if (!email) return []

    const emailStatus = String(readField<string>(row, "emailStatus", "email_status") ?? "").toLowerCase()
    const verified =
      emailStatus === "operator_verified" || emailStatus === "verified" || emailStatus === "observed"
    const rejected = emailStatus === "rejected"

    if (!verified && !rejected) return []

    const attribution = record.sourceAttribution ?? record.source_attribution ?? []
    const discoverySource =
      attribution.find((entry) => entry.source)?.source ??
      readField<string>(asRecord(record.metadata) ?? {}, "discovery_source")

    const result = emailLearningObservationFromManualVerification({
      email,
      verified,
      contactId: readField<string>(row, "contactCandidateId", "contact_candidate_id"),
      verifiedAt: readField<string>(row, "createdAt", "created_at"),
      verificationId: readField<string>(row, "id") ?? undefined,
    })

    return result.ok && result.observation
      ? [
          {
            ...result.observation,
            metadata: {
              ...result.observation.metadata,
              reconstruction_source: "contact_verifications",
              discovery_source: discoverySource,
            },
          },
        ]
      : []
  } catch {
    return []
  }
}

export function reconstructEmailLearningFromTimeline(
  record: HistoricalTimelineEventRecord,
): EmailLearningObservation[] {
  try {
    const row = record as Record<string, unknown>
    const eventType = String(readField<string>(row, "eventType", "event_type") ?? "").toLowerCase()
    const outcome = TIMELINE_EVENT_OUTCOME_MAP[eventType]
    if (!outcome) return []

    const payload = asRecord(record.payload)
    const email =
      extractRecipientEmail(row) ??
      (payload ? readField<string>(payload, "email", "recipient_email", "to") : null)
    if (!email) return []

    const built = buildEmailLearningObservations([
      {
        email,
        outcome,
        source: eventType.includes("bounce") || eventType.includes("complaint") || eventType.includes("unsubscribe")
          ? "compliance"
          : "provider_webhook",
        eventTimestamp: readField<string>(row, "occurredAt", "occurred_at"),
        contactId: readField<string>(row, "leadId", "lead_id"),
        dedupeKey: `timeline:${readField<string>(row, "id")}:${eventType}`,
        metadata: { reconstruction_source: "lead_timeline_events", timeline_event_type: eventType },
      },
    ])

    return built
  } catch {
    return []
  }
}

export function reconstructEmailLearningBatch(
  input: EmailLearningHistoricalBatchInput,
): EmailLearningReconstructionBatchResult {
  let unsupported = 0
  let invalid = 0
  const rawObservations: EmailLearningObservation[] = []

  const pushSlice = (observations: EmailLearningObservation[], expectedProduced: boolean) => {
    if (expectedProduced && observations.length === 0) invalid += 1
    rawObservations.push(...observations)
  }

  for (const record of input.deliveryAttempts ?? []) {
    pushSlice(reconstructEmailLearningFromDeliveryAttempt(record), true)
  }

  for (const record of input.providerEvents ?? []) {
    pushSlice(reconstructEmailLearningFromProviderEvent(record), true)
  }

  for (const record of input.outboundMessages ?? []) {
    pushSlice(reconstructEmailLearningFromOutboundMessage(record), true)
  }

  for (const record of input.outboundReplies ?? []) {
    pushSlice(reconstructEmailLearningFromReply(record), true)
  }

  for (const record of input.replyIngestionEvents ?? []) {
    pushSlice(reconstructEmailLearningFromReplyIngestion(record), true)
  }

  for (const record of input.emailBounces ?? []) {
    pushSlice(reconstructEmailLearningFromBounce(record), true)
  }

  for (const record of input.emailComplaints ?? []) {
    pushSlice(reconstructEmailLearningFromComplaint(record), true)
  }

  for (const record of input.contactVerifications ?? []) {
    const produced = reconstructEmailLearningFromVerification(record)
    if (produced.length === 0) {
      const status = String(
        readField<string>(record as Record<string, unknown>, "emailStatus", "email_status") ?? "",
      ).toLowerCase()
      if (!status || status === "unverified" || status === "not_present") unsupported += 1
      else invalid += 1
    } else {
      rawObservations.push(...produced)
    }
  }

  for (const record of input.timelineEvents ?? []) {
    const eventType = String(
      readField<string>(record as Record<string, unknown>, "eventType", "event_type") ?? "",
    ).toLowerCase()
    const produced = reconstructEmailLearningFromTimeline(record)
    if (produced.length === 0) {
      if (TIMELINE_EVENT_OUTCOME_MAP[eventType]) invalid += 1
      else unsupported += 1
    } else {
      rawObservations.push(...produced)
    }
  }

  const deduped = dedupeObservations(rawObservations)
  const domains = [...new Set(deduped.observations.map((row) => row.domain).filter(Boolean) as string[])].sort()
  const patterns = [
    ...new Set(
      deduped.observations.map((row) => row.email_pattern).filter(Boolean) as EmailLocalPartPatternKey[],
    ),
  ].sort()

  return {
    observations: deduped.observations,
    summary: {
      qa_marker: GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER,
      observations_created: deduped.observations.length,
      duplicates_removed: deduped.duplicates_removed,
      unsupported_events_skipped: unsupported,
      invalid_records_skipped: invalid,
      domains_discovered: domains,
      email_patterns_identified: patterns,
    },
  }
}

export function compareReconstructedObservations(
  left: readonly EmailLearningObservation[],
  right: readonly EmailLearningObservation[],
): EmailLearningObservationComparison {
  const leftIds = left.map((row) => row.observation_id).sort()
  const rightIds = right.map((row) => row.observation_id).sort()
  const leftSet = new Set(leftIds)
  const rightSet = new Set(rightIds)

  return {
    matched: leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]),
    left_count: left.length,
    right_count: right.length,
    only_in_left: leftIds.filter((id) => !rightSet.has(id)),
    only_in_right: rightIds.filter((id) => !leftSet.has(id)),
  }
}

export function summarizeLearningReconstruction(
  result: EmailLearningReconstructionBatchResult,
): EmailLearningReconstructionSummary {
  return result.summary
}

export function buildDomainIntelligencePreview(
  observations: readonly EmailLearningObservation[],
  domain: string,
): EmailDomainIntelligencePreview | null {
  const stats = aggregateEmailLearningByDomain(observations).find((row) => row.domain === domain)
  if (!stats) return null

  const domainObservations = observations.filter((row) => row.domain === domain)
  const patternScores = new Map<EmailLocalPartPatternKey, number>()
  const discoverySources = new Map<string, number>()

  for (const observation of domainObservations) {
    if (observation.email_pattern) {
      const weight =
        observation.event_type === "meeting_booked"
          ? 4
          : observation.event_type === "positive_reply" || observation.event_type === "replied"
            ? 3
            : observation.event_type === "manual_verified"
              ? 2
              : observation.event_type === "delivered" || observation.event_type === "opened"
                ? 1
                : 0
      if (weight > 0) {
        patternScores.set(
          observation.email_pattern,
          (patternScores.get(observation.email_pattern) ?? 0) + weight,
        )
      }
    }

    const discoverySource =
      typeof observation.metadata.discovery_source === "string"
        ? observation.metadata.discovery_source
        : null
    if (discoverySource) {
      discoverySources.set(discoverySource, (discoverySources.get(discoverySource) ?? 0) + 1)
    }
  }

  const bestPattern = [...patternScores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  const bestDiscovery = [...discoverySources.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]

  return {
    domain,
    messages_sent: stats.messages_sent,
    replies: stats.replies,
    reply_rate: formatRate(stats.reply_rate),
    hard_bounces: stats.hard_bounces,
    complaint_rate: formatRate(
      stats.messages_sent > 0 ? stats.complaints / stats.messages_sent : stats.complaints > 0 ? 1 : null,
    ),
    most_successful_pattern: patternLabel(bestPattern ?? null),
    best_discovery_source: bestDiscovery ? capitalizeDiscoverySource(bestDiscovery) : null,
  }
}

function capitalizeDiscoverySource(value: string): string {
  if (value === "website") return "Website"
  if (value === "pattern") return "Pattern"
  if (value === "pdl") return "PDL"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function buildPatternIntelligencePreview(
  observations: readonly EmailLearningObservation[],
): EmailPatternIntelligenceSummary[] {
  const grouped = new Map<EmailLocalPartPatternKey, EmailPatternIntelligenceSummary>()

  for (const observation of observations) {
    if (!observation.email_pattern) continue
    const key = observation.email_pattern
    const existing =
      grouped.get(key) ??
      ({
        pattern_key: key,
        pattern_label: patternLabel(key) ?? key,
        observed_count: 0,
        verification_success_count: 0,
        reply_success_count: 0,
        meeting_success_count: 0,
      } satisfies EmailPatternIntelligenceSummary)

    existing.observed_count += 1
    if (observation.event_type === "manual_verified") existing.verification_success_count += 1
    if (
      observation.event_type === "replied" ||
      observation.event_type === "positive_reply" ||
      observation.event_type === "negative_reply"
    ) {
      existing.reply_success_count += 1
    }
    if (observation.event_type === "meeting_booked") existing.meeting_success_count += 1
    grouped.set(key, existing)
  }

  return [...grouped.values()].sort((a, b) => a.pattern_key.localeCompare(b.pattern_key))
}

export function previewDomainStatsFromObservations(
  observations: readonly EmailLearningObservation[],
): EmailDomainLearningStats[] {
  return aggregateEmailLearningByDomain(observations)
}

export function observationIdentityFingerprint(observation: EmailLearningObservation): string {
  const email = observation.normalized_email ?? "_"
  return `${email}|${observation.event_type}|${observation.event_timestamp}|${observation.source}`
}

export function isValidHistoricalRecipientEmail(value: string | null | undefined): boolean {
  return Boolean(normalizeEmail(value))
}

export function inferPatternFromHistoricalEmail(
  email: string,
  hint?: { firstName?: string | null; lastName?: string | null },
): EmailLocalPartPatternKey {
  return inferEmailLocalPartPattern(email, hint)
}

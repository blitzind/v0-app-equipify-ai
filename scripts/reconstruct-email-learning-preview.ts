/**
 * GE-EI-IMP-4C — read-only Email Intelligence learning preview.
 *
 * Fixture mode (CI-safe):
 *   pnpm test:growth-email-learning-preview
 *
 * Live read-only mode:
 *   pnpm growth:email-learning-preview -- --limit=500
 */

import {
  buildDomainIntelligencePreview,
  buildPatternIntelligencePreview,
  GROWTH_EMAIL_LEARNING_RECONSTRUCTION_QA_MARKER,
  reconstructEmailLearningBatch,
  reconstructEmailLearningFromBounce,
  reconstructEmailLearningFromComplaint,
  reconstructEmailLearningFromDeliveryAttempt,
  reconstructEmailLearningFromProviderEvent,
  reconstructEmailLearningFromReply,
  reconstructEmailLearningFromTimeline,
  reconstructEmailLearningFromVerification,
  type EmailLearningHistoricalBatchInput,
  type HistoricalContactVerificationRecord,
  type HistoricalDeliveryAttemptRecord,
  type HistoricalEmailBounceRecord,
  type HistoricalEmailComplaintRecord,
  type HistoricalOutboundReplyRecord,
  type HistoricalProviderDeliveryEventRecord,
  type HistoricalTimelineEventRecord,
} from "../lib/growth/contact-verification/email-learning-reconstruction"
import {
  emailLearningObservationFromMessageEvent,
  type EmailLearningObservation,
} from "../lib/growth/contact-verification/email-learning"

export const GROWTH_EMAIL_LEARNING_PREVIEW_QA_MARKER = "growth-email-learning-preview-v1" as const

const DEFAULT_LIMIT = 250
const MAX_LIMIT = 5000

const SOURCE_KEYS = [
  "delivery_attempts",
  "provider_delivery_events",
  "message_events",
  "outbound_replies",
  "email_bounces",
  "email_complaints",
  "contact_verifications",
  "lead_timeline_events",
] as const

export type EmailLearningPreviewSourceKey = (typeof SOURCE_KEYS)[number]

export type EmailLearningPreviewSourceStats = {
  rows: number
  observations: number
  skipped: number
}

export type EmailLearningPreviewOutput = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_PREVIEW_QA_MARKER
  mode: "fixture" | "live"
  limit: number
  sources: Record<EmailLearningPreviewSourceKey, EmailLearningPreviewSourceStats>
  summary: {
    observations_created: number
    duplicates_removed: number
    invalid_records_skipped: number
    unsupported_events_skipped: number
    domains_discovered: number
  }
  top_domains: Array<{
    domain: string
    messages_sent: number
    replies: number
    reply_rate: string | null
    hard_bounces: number
    complaint_rate: string | null
    most_successful_pattern: string | null
    best_discovery_source: string | null
  }>
  pattern_preview: ReturnType<typeof buildPatternIntelligencePreview>
  skipped_sources: string[]
  warnings: string[]
}

type ParsedArgs = {
  fixture: boolean
  limit: number
}

function parseArgs(argv: string[]): ParsedArgs {
  let fixture = false
  let limit = DEFAULT_LIMIT

  for (const arg of argv) {
    if (arg === "--fixture") fixture = true
    if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT)
      }
    }
  }

  return { fixture, limit }
}

function emptySourceStats(): Record<EmailLearningPreviewSourceKey, EmailLearningPreviewSourceStats> {
  return {
    delivery_attempts: { rows: 0, observations: 0, skipped: 0 },
    provider_delivery_events: { rows: 0, observations: 0, skipped: 0 },
    message_events: { rows: 0, observations: 0, skipped: 0 },
    outbound_replies: { rows: 0, observations: 0, skipped: 0 },
    email_bounces: { rows: 0, observations: 0, skipped: 0 },
    email_complaints: { rows: 0, observations: 0, skipped: 0 },
    contact_verifications: { rows: 0, observations: 0, skipped: 0 },
    lead_timeline_events: { rows: 0, observations: 0, skipped: 0 },
  }
}

function extractMetadataEmail(metadata: unknown): string | null {
  const record = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null
  if (!record) return null
  const value = record.to ?? record.email ?? record.recipient_email
  return typeof value === "string" ? value : null
}

function trackSourceObservations(
  stats: EmailLearningPreviewSourceStats,
  observations: EmailLearningObservation[],
): void {
  stats.rows += 1
  if (observations.length === 0) stats.skipped += 1
  else stats.observations += observations.length
}

function buildFixtureBatch(): EmailLearningHistoricalBatchInput {
  const ts = "2026-06-19T12:00:00.000Z"

  return {
    deliveryAttempts: [
      {
        id: "fixture-attempt-1",
        status: "sent",
        lead_id: "lead-1",
        sent_at: ts,
        metadata: { to: "jane.doe@acme.com" },
      },
      {
        id: "fixture-attempt-2",
        status: "sent",
        sent_at: new Date(Date.parse(ts) + 60_000).toISOString(),
        metadata: { to: "bob.smith@acme.com" },
      },
    ],
    providerEvents: [
      {
        id: "fixture-provider-1",
        normalized_event_type: "opened",
        provider_family: "google",
        occurred_at: ts,
        recipient_email: "jane.doe@acme.com",
      },
      {
        id: "fixture-provider-2",
        normalized_event_type: "delivered",
        occurred_at: ts,
        recipient_email: "bob.smith@acme.com",
      },
    ],
    outboundReplies: [
      {
        id: "fixture-reply-1",
        lead_id: "lead-1",
        received_at: ts,
        classification: "interested",
        intent: "meeting_request",
        sender_email: "jane.doe@acme.com",
      },
    ],
    emailBounces: [
      {
        id: "fixture-bounce-1",
        bounce_type: "hard",
        occurred_at: ts,
        recipient_email: "bad@other.com",
      },
    ],
    emailComplaints: [
      {
        id: "fixture-complaint-1",
        complaint_type: "spam",
        occurred_at: ts,
        recipient_email: "angry@other.com",
      },
    ],
    contactVerifications: [
      {
        id: "fixture-verification-1",
        contact_candidate_id: "candidate-1",
        email_status: "operator_verified",
        created_at: ts,
        email: "jane.doe@acme.com",
        source_attribution: [{ source: "website" }],
      },
    ],
    timelineEvents: [
      {
        id: "fixture-timeline-1",
        event_type: "email_clicked",
        occurred_at: ts,
        lead_id: "lead-1",
        payload: { email: "jane.doe@acme.com" },
      },
      {
        id: "fixture-timeline-2",
        event_type: "notes_updated",
        occurred_at: ts,
        payload: { email: "jane.doe@acme.com" },
      },
    ],
  }
}

function buildFixtureMessageObservations(): EmailLearningObservation[] {
  const ts = "2026-06-19T12:00:00.000Z"
  const result = emailLearningObservationFromMessageEvent({
    email: "jane.doe@acme.com",
    eventType: "delivered",
    provider: "lemlist",
    leadId: "lead-1",
    occurredAt: ts,
    messageEventId: "fixture-message-1",
  })
  return result.ok && result.observation ? [result.observation] : []
}

function collectFixtureSourceStats(
  batch: EmailLearningHistoricalBatchInput,
): Record<EmailLearningPreviewSourceKey, EmailLearningPreviewSourceStats> {
  const stats = emptySourceStats()

  for (const row of batch.deliveryAttempts ?? []) {
    trackSourceObservations(stats.delivery_attempts, reconstructEmailLearningFromDeliveryAttempt(row))
  }
  for (const row of batch.providerEvents ?? []) {
    trackSourceObservations(
      stats.provider_delivery_events,
      reconstructEmailLearningFromProviderEvent(row),
    )
  }
  for (const row of batch.outboundReplies ?? []) {
    trackSourceObservations(stats.outbound_replies, reconstructEmailLearningFromReply(row))
  }
  for (const row of batch.emailBounces ?? []) {
    trackSourceObservations(stats.email_bounces, reconstructEmailLearningFromBounce(row))
  }
  for (const row of batch.emailComplaints ?? []) {
    trackSourceObservations(stats.email_complaints, reconstructEmailLearningFromComplaint(row))
  }
  for (const row of batch.contactVerifications ?? []) {
    trackSourceObservations(stats.contact_verifications, reconstructEmailLearningFromVerification(row))
  }
  for (const row of batch.timelineEvents ?? []) {
    trackSourceObservations(stats.lead_timeline_events, reconstructEmailLearningFromTimeline(row))
  }

  const messageObservations = buildFixtureMessageObservations()
  stats.message_events.rows = 1
  stats.message_events.observations = messageObservations.length
  stats.message_events.skipped = messageObservations.length === 0 ? 1 : 0

  return stats
}

type SupabaseLike = {
  schema: (name: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
        }
      }
    }
  }
}

async function queryTable(
  admin: SupabaseLike,
  table: string,
  columns: string,
  limit: number,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const { data, error } = await admin
    .schema("growth")
    .from(table)
    .select(columns)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as Record<string, unknown>[], error: null }
}

async function loadLiveBatch(
  admin: SupabaseLike,
  limit: number,
  sourceStats: Record<EmailLearningPreviewSourceKey, EmailLearningPreviewSourceStats>,
  skippedSources: string[],
  warnings: string[],
): Promise<{ batch: EmailLearningHistoricalBatchInput; messageObservations: EmailLearningObservation[] }> {
  const batch: EmailLearningHistoricalBatchInput = {}
  const attemptEmailById = new Map<string, string>()
  const leadEmailById = new Map<string, string>()

  const deliveryQuery = await queryTable(
    admin,
    "delivery_attempts",
    "id, status, lead_id, sequence_enrollment_id, provider_id, sent_at, failed_at, failure_reason, metadata, created_at",
    limit,
  )
  if (deliveryQuery.error) {
    skippedSources.push("delivery_attempts")
    warnings.push(`delivery_attempts_unavailable:${deliveryQuery.error}`)
  } else {
    batch.deliveryAttempts = deliveryQuery.rows.map((row) => {
      const email = extractMetadataEmail(row.metadata)
      if (email && typeof row.id === "string") attemptEmailById.set(row.id, email)
      const record: HistoricalDeliveryAttemptRecord = {
        id: String(row.id),
        status: typeof row.status === "string" ? row.status : null,
        lead_id: typeof row.lead_id === "string" ? row.lead_id : null,
        sequence_enrollment_id:
          typeof row.sequence_enrollment_id === "string" ? row.sequence_enrollment_id : null,
        provider_id: typeof row.provider_id === "string" ? row.provider_id : null,
        sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
        failed_at: typeof row.failed_at === "string" ? row.failed_at : null,
        failure_reason: typeof row.failure_reason === "string" ? row.failure_reason : null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: typeof row.created_at === "string" ? row.created_at : null,
      }
      trackSourceObservations(sourceStats.delivery_attempts, reconstructEmailLearningFromDeliveryAttempt(record))
      return record
    })
    sourceStats.delivery_attempts.rows = batch.deliveryAttempts.length
  }

  const providerQuery = await queryTable(
    admin,
    "provider_delivery_events",
    "id, normalized_event_type, provider_family, lead_id, delivery_attempt_id, occurred_at, sanitized_payload",
    limit,
  )
  if (providerQuery.error) {
    skippedSources.push("provider_delivery_events")
    warnings.push(`provider_delivery_events_unavailable:${providerQuery.error}`)
  } else {
    batch.providerEvents = providerQuery.rows.map((row) => {
      const attemptId = typeof row.delivery_attempt_id === "string" ? row.delivery_attempt_id : null
      const payloadEmail = extractMetadataEmail(row.sanitized_payload)
      const recipientEmail = (attemptId ? attemptEmailById.get(attemptId) : null) ?? payloadEmail
      const record: HistoricalProviderDeliveryEventRecord = {
        id: String(row.id),
        normalized_event_type:
          typeof row.normalized_event_type === "string" ? row.normalized_event_type : "unknown",
        provider_family: typeof row.provider_family === "string" ? row.provider_family : null,
        lead_id: typeof row.lead_id === "string" ? row.lead_id : null,
        delivery_attempt_id: attemptId,
        occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
        recipient_email: recipientEmail,
      }
      trackSourceObservations(
        sourceStats.provider_delivery_events,
        reconstructEmailLearningFromProviderEvent(record),
      )
      return record
    })
    sourceStats.provider_delivery_events.rows = batch.providerEvents.length
  }

  const messageQuery = await queryTable(
    admin,
    "message_events",
    "id, lead_id, event_type, provider, occurred_at, payload",
    limit,
  )
  const messageObservations: EmailLearningObservation[] = []
  if (messageQuery.error) {
    skippedSources.push("message_events")
    warnings.push(`message_events_unavailable:${messageQuery.error}`)
  } else {
    for (const row of messageQuery.rows) {
      sourceStats.message_events.rows += 1
      const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {}
      const email = extractMetadataEmail(payload)
      if (!email) {
        sourceStats.message_events.skipped += 1
        continue
      }
      const result = emailLearningObservationFromMessageEvent({
        email,
        eventType: typeof row.event_type === "string" ? row.event_type : "sent",
        provider: typeof row.provider === "string" ? row.provider : null,
        leadId: typeof row.lead_id === "string" ? row.lead_id : null,
        occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : null,
        messageEventId: typeof row.id === "string" ? row.id : null,
      })
      if (result.ok && result.observation) {
        messageObservations.push(result.observation)
        sourceStats.message_events.observations += 1
      } else {
        sourceStats.message_events.skipped += 1
      }
    }
  }

  const repliesQuery = await queryTable(
    admin,
    "outbound_replies",
    "id, lead_id, contact_id, received_at, classification, intent, leads(contact_email), outbound_contacts(email)",
    limit,
  )
  if (repliesQuery.error) {
    skippedSources.push("outbound_replies")
    warnings.push(`outbound_replies_unavailable:${repliesQuery.error}`)
  } else {
    batch.outboundReplies = repliesQuery.rows.map((row) => {
      const leads = row.leads && typeof row.leads === "object" ? (row.leads as Record<string, unknown>) : null
      const contacts =
        row.outbound_contacts && typeof row.outbound_contacts === "object"
          ? (row.outbound_contacts as Record<string, unknown>)
          : null
      const email =
        (typeof contacts?.email === "string" ? contacts.email : null) ??
        (typeof leads?.contact_email === "string" ? leads.contact_email : null)
      if (email && typeof row.lead_id === "string") leadEmailById.set(row.lead_id, email)
      const record: HistoricalOutboundReplyRecord = {
        id: String(row.id),
        lead_id: typeof row.lead_id === "string" ? row.lead_id : null,
        contact_id: typeof row.contact_id === "string" ? row.contact_id : null,
        received_at: typeof row.received_at === "string" ? row.received_at : null,
        classification: typeof row.classification === "string" ? row.classification : null,
        intent: typeof row.intent === "string" ? row.intent : null,
        sender_email: email,
      }
      trackSourceObservations(sourceStats.outbound_replies, reconstructEmailLearningFromReply(record))
      return record
    })
    sourceStats.outbound_replies.rows = batch.outboundReplies.length
  }

  const bouncesQuery = await queryTable(
    admin,
    "email_bounces",
    "id, delivery_attempt_id, lead_id, bounce_type, occurred_at",
    limit,
  )
  if (bouncesQuery.error) {
    skippedSources.push("email_bounces")
    warnings.push(`email_bounces_unavailable:${bouncesQuery.error}`)
  } else {
    batch.emailBounces = bouncesQuery.rows.map((row) => {
      const attemptId = typeof row.delivery_attempt_id === "string" ? row.delivery_attempt_id : null
      const record: HistoricalEmailBounceRecord = {
        id: String(row.id),
        delivery_attempt_id: attemptId,
        lead_id: typeof row.lead_id === "string" ? row.lead_id : null,
        bounce_type: typeof row.bounce_type === "string" ? row.bounce_type : null,
        occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
        recipient_email: attemptId ? attemptEmailById.get(attemptId) ?? null : null,
      }
      trackSourceObservations(sourceStats.email_bounces, reconstructEmailLearningFromBounce(record))
      return record
    })
    sourceStats.email_bounces.rows = batch.emailBounces.length
  }

  const complaintsQuery = await queryTable(
    admin,
    "email_complaints",
    "id, delivery_attempt_id, lead_id, complaint_type, occurred_at",
    limit,
  )
  if (complaintsQuery.error) {
    skippedSources.push("email_complaints")
    warnings.push(`email_complaints_unavailable:${complaintsQuery.error}`)
  } else {
    batch.emailComplaints = complaintsQuery.rows.map((row) => {
      const attemptId = typeof row.delivery_attempt_id === "string" ? row.delivery_attempt_id : null
      const record: HistoricalEmailComplaintRecord = {
        id: String(row.id),
        delivery_attempt_id: attemptId,
        lead_id: typeof row.lead_id === "string" ? row.lead_id : null,
        complaint_type: typeof row.complaint_type === "string" ? row.complaint_type : null,
        occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
        recipient_email: attemptId ? attemptEmailById.get(attemptId) ?? null : null,
      }
      trackSourceObservations(sourceStats.email_complaints, reconstructEmailLearningFromComplaint(record))
      return record
    })
    sourceStats.email_complaints.rows = batch.emailComplaints.length
  }

  const verificationsQuery = await queryTable(
    admin,
    "contact_verifications",
    "id, contact_candidate_id, email_status, created_at, metadata, source_attribution, contact_candidates(email)",
    limit,
  )
  if (verificationsQuery.error) {
    skippedSources.push("contact_verifications")
    warnings.push(`contact_verifications_unavailable:${verificationsQuery.error}`)
  } else {
    batch.contactVerifications = verificationsQuery.rows.map((row) => {
      const candidate =
        row.contact_candidates && typeof row.contact_candidates === "object"
          ? (row.contact_candidates as Record<string, unknown>)
          : null
      const record: HistoricalContactVerificationRecord = {
        id: String(row.id),
        contact_candidate_id:
          typeof row.contact_candidate_id === "string" ? row.contact_candidate_id : null,
        email_status: typeof row.email_status === "string" ? row.email_status : null,
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        source_attribution: Array.isArray(row.source_attribution)
          ? (row.source_attribution as HistoricalContactVerificationRecord["source_attribution"])
          : [],
        email: typeof candidate?.email === "string" ? candidate.email : null,
      }
      trackSourceObservations(
        sourceStats.contact_verifications,
        reconstructEmailLearningFromVerification(record),
      )
      return record
    })
    sourceStats.contact_verifications.rows = batch.contactVerifications.length
  }

  const timelineQuery = await queryTable(
    admin,
    "lead_timeline_events",
    "id, lead_id, event_type, occurred_at, payload",
    limit,
  )
  if (timelineQuery.error) {
    skippedSources.push("lead_timeline_events")
    warnings.push(`lead_timeline_events_unavailable:${timelineQuery.error}`)
  } else {
    batch.timelineEvents = timelineQuery.rows.map((row) => {
      const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {}
      const leadId = typeof row.lead_id === "string" ? row.lead_id : null
      const record: HistoricalTimelineEventRecord = {
        id: String(row.id),
        lead_id: leadId,
        event_type: typeof row.event_type === "string" ? row.event_type : null,
        occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : null,
        payload,
        recipient_email:
          extractMetadataEmail(payload) ?? (leadId ? leadEmailById.get(leadId) ?? null : null),
      }
      trackSourceObservations(sourceStats.lead_timeline_events, reconstructEmailLearningFromTimeline(record))
      return record
    })
    sourceStats.lead_timeline_events.rows = batch.timelineEvents.length
  }

  return { batch, messageObservations }
}

export function collectEmailLearningPreviewObservations(input: {
  batch: EmailLearningHistoricalBatchInput
  extraObservations?: EmailLearningObservation[]
}): EmailLearningObservation[] {
  const reconstructed = reconstructEmailLearningBatch(input.batch)
  const merged = [...reconstructed.observations, ...(input.extraObservations ?? [])]
  const uniqueById = new Map<string, EmailLearningObservation>()
  for (const observation of merged) {
    uniqueById.set(observation.observation_id, observation)
  }
  return [...uniqueById.values()].sort((a, b) => a.observation_id.localeCompare(b.observation_id))
}

export function buildEmailLearningPreviewOutput(input: {
  mode: "fixture" | "live"
  limit: number
  batch: EmailLearningHistoricalBatchInput
  sourceStats: Record<EmailLearningPreviewSourceKey, EmailLearningPreviewSourceStats>
  skippedSources: string[]
  warnings: string[]
  extraObservations?: EmailLearningObservation[]
}): EmailLearningPreviewOutput {
  const finalObservations = collectEmailLearningPreviewObservations({
    batch: input.batch,
    extraObservations: input.extraObservations,
  })
  const reconstructed = reconstructEmailLearningBatch(input.batch)
  const merged = [...reconstructed.observations, ...(input.extraObservations ?? [])]
  const extraDuplicatesRemoved = merged.length - finalObservations.length

  const patternPreview = buildPatternIntelligencePreview(finalObservations).slice(0, 10)
  const domainCandidates = [...new Set(finalObservations.map((row) => row.domain).filter(Boolean) as string[])]
  const topDomains = domainCandidates
    .map((domain) => buildDomainIntelligencePreview(finalObservations, domain))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.messages_sent - a.messages_sent || a.domain.localeCompare(b.domain))
    .slice(0, 10)

  return {
    qa_marker: GROWTH_EMAIL_LEARNING_PREVIEW_QA_MARKER,
    mode: input.mode,
    limit: input.limit,
    sources: input.sourceStats,
    summary: {
      observations_created: finalObservations.length,
      duplicates_removed: reconstructed.summary.duplicates_removed + extraDuplicatesRemoved,
      invalid_records_skipped: reconstructed.summary.invalid_records_skipped,
      unsupported_events_skipped: reconstructed.summary.unsupported_events_skipped,
      domains_discovered: domainCandidates.length,
    },
    top_domains: topDomains,
    pattern_preview: patternPreview,
    skipped_sources: input.skippedSources,
    warnings: input.warnings,
  }
}

export function assertPreviewOutputHasNoPlaintextEmails(output: unknown): boolean {
  const text = JSON.stringify(output)
  return !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)
}

async function runFixturePreview(limit: number): Promise<EmailLearningPreviewOutput> {
  const diagnostics = await runFixturePreviewDiagnostics(limit)
  return diagnostics.preview
}

async function runFixturePreviewDiagnostics(limit: number): Promise<EmailLearningPreviewDiagnostics> {
  const batch = buildFixtureBatch()
  const sourceStats = collectFixtureSourceStats(batch)
  const messageObservations = buildFixtureMessageObservations()
  const preview = buildEmailLearningPreviewOutput({
    mode: "fixture",
    limit,
    batch,
    sourceStats,
    skippedSources: [],
    warnings: [],
    extraObservations: messageObservations,
  })
  const observations = collectEmailLearningPreviewObservations({
    batch,
    extraObservations: messageObservations,
  })
  return { preview, observations }
}

export type EmailLearningPreviewDiagnostics = {
  preview: EmailLearningPreviewOutput
  observations: EmailLearningObservation[]
}

async function runLivePreview(limit: number): Promise<EmailLearningPreviewOutput> {
  const diagnostics = await runLivePreviewDiagnostics(limit)
  return diagnostics.preview
}

async function runLivePreviewDiagnostics(limit: number): Promise<EmailLearningPreviewDiagnostics> {
  const warnings: string[] = []
  const skippedSources: string[] = []
  const sourceStats = emptySourceStats()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    warnings.push("supabase_credentials_missing")
    const preview = buildEmailLearningPreviewOutput({
      mode: "live",
      limit,
      batch: {},
      sourceStats,
      skippedSources: [...SOURCE_KEYS],
      warnings,
    })
    return { preview, observations: [] }
  }

  const { createClient } = await import("@supabase/supabase-js")
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { batch, messageObservations } = await loadLiveBatch(admin, limit, sourceStats, skippedSources, warnings)
  const preview = buildEmailLearningPreviewOutput({
    mode: "live",
    limit,
    batch,
    sourceStats,
    skippedSources,
    warnings,
    extraObservations: messageObservations,
  })
  const observations = collectEmailLearningPreviewObservations({
    batch,
    extraObservations: messageObservations,
  })
  return { preview, observations }
}

export async function runEmailLearningPreviewDiagnostics(argv: string[]): Promise<EmailLearningPreviewDiagnostics> {
  const args = parseArgs(argv)
  if (args.fixture) return runFixturePreviewDiagnostics(args.limit)
  return runLivePreviewDiagnostics(args.limit)
}

export async function runEmailLearningPreview(argv: string[]): Promise<EmailLearningPreviewOutput> {
  const args = parseArgs(argv)
  if (args.fixture) return runFixturePreview(args.limit)
  return runLivePreview(args.limit)
}

async function main(): Promise<void> {
  const output = await runEmailLearningPreview(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

const isDirectExecution = process.argv[1]?.includes("reconstruct-email-learning-preview")
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}

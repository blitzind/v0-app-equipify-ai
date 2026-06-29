/**
 * GE-AIOS-SDR-2C — Canonical revenue execution outcome (client-safe).
 * Single schema for all execution runtime completions → Learning Engine.
 */

export const GROWTH_REVENUE_OUTCOME_QA_MARKER = "revenue-outcome-integration-v1" as const

export const GROWTH_REVENUE_OUTCOME_EVENT = "revenue.outcome.recorded" as const

export const REVENUE_OUTCOME_CHANNELS = [
  "email",
  "sms",
  "call",
  "voice_drop",
  "meeting",
  "campaign",
  "lead",
  "human",
  "linkedin",
  "video",
] as const

export type RevenueOutcomeChannel = (typeof REVENUE_OUTCOME_CHANNELS)[number]

export const REVENUE_OUTCOME_RESULTS = [
  "sent",
  "delivered",
  "bounced",
  "opened",
  "clicked",
  "replied",
  "unsubscribed",
  "connected",
  "voicemail",
  "no_answer",
  "busy",
  "declined",
  "failed",
  "booked",
  "rescheduled",
  "completed",
  "cancelled",
  "no_show",
  "enrolled",
  "exited",
  "qualified",
  "disqualified",
  "suppressed",
  "customer",
  "approved",
  "rejected",
  "skipped",
] as const

export type RevenueOutcomeResult = (typeof REVENUE_OUTCOME_RESULTS)[number]

export type RevenueOutcomePayload = {
  qa_marker: typeof GROWTH_REVENUE_OUTCOME_QA_MARKER
  lead_id: string
  company_id?: string | null
  channel: RevenueOutcomeChannel
  action?: string | null
  outcome: RevenueOutcomeResult
  timestamp: string
  execution_id: string
  runtime: string
  campaign_id?: string | null
  sequence_id?: string | null
  meeting_id?: string | null
  confidence?: number | null
  metadata?: Record<string, unknown>
}

export type RevenueOutcomeEmitInput = {
  leadId: string
  companyId?: string | null
  channel: RevenueOutcomeChannel
  action?: string | null
  outcome: RevenueOutcomeResult
  executionId: string
  runtime: string
  occurredAt?: string
  campaignId?: string | null
  sequenceId?: string | null
  meetingId?: string | null
  confidence?: number | null
  metadata?: Record<string, unknown>
}

export function buildRevenueOutcomePayload(input: RevenueOutcomeEmitInput): RevenueOutcomePayload {
  return {
    qa_marker: GROWTH_REVENUE_OUTCOME_QA_MARKER,
    lead_id: input.leadId,
    company_id: input.companyId ?? null,
    channel: input.channel,
    action: input.action ?? null,
    outcome: input.outcome,
    timestamp: input.occurredAt ?? new Date().toISOString(),
    execution_id: input.executionId,
    runtime: input.runtime,
    campaign_id: input.campaignId ?? null,
    sequence_id: input.sequenceId ?? null,
    meeting_id: input.meetingId ?? null,
    confidence: input.confidence ?? null,
    metadata: input.metadata,
  }
}

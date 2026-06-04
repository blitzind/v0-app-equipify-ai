import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildOutreachPerformanceDataAudit } from "@/lib/growth/outreach/performance/performance-data-audit"
import { buildExecutiveSummary } from "@/lib/growth/outreach/performance/performance-aggregator"
import { attachOutreachPerformanceOutcomes } from "@/lib/growth/outreach/performance/performance-outcome-resolver"
import { aggregateCtaPerformance } from "@/lib/growth/outreach/performance/cta-performance"
import { aggregateOpenerPerformance } from "@/lib/growth/outreach/performance/opener-performance"
import { aggregatePersonalizationPerformance } from "@/lib/growth/outreach/performance/personalization-performance"
import { listOutreachPerformanceAttributions } from "@/lib/growth/outreach/performance/performance-attribution-repository"
import {
  GROWTH_OUTREACH_PERFORMANCE_QA_MARKER,
  OUTREACH_PERFORMANCE_OUTCOME_WINDOW_DAYS,
  type OutreachPerformanceAttributedSend,
  type OutreachPerformanceDashboard,
} from "@/lib/growth/outreach/performance/performance-types"
import { aggregateSubjectPerformance } from "@/lib/growth/outreach/performance/subject-performance"

const POSITIVE_REPLY_INTENTS = new Set([
  "positive_interest",
  "meeting_request",
  "demo_request",
  "pricing_question",
  "referral",
])

type Row = Record<string, unknown>

function daysAgoIso(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

async function loadSentGenerations(
  admin: SupabaseClient,
  since: string,
): Promise<Array<{ id: string; leadId: string; sentAt: string | null }>> {
  const { data, error } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .select("id, lead_id, sent_at, status")
    .not("sent_at", "is", null)
    .gte("sent_at", since)
    .limit(500)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: String((row as Row).id),
    leadId: String((row as Row).lead_id),
    sentAt: (row as Row).sent_at ? String((row as Row).sent_at) : null,
  }))
}

async function loadReplyOutcomes(
  admin: SupabaseClient,
  leadIds: string[],
  since: string,
): Promise<Map<string, { replied: boolean; positiveInterest: boolean }>> {
  const result = new Map<string, { replied: boolean; positiveInterest: boolean }>()
  if (leadIds.length === 0) return result

  const { data, error } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("lead_id, intent, received_at")
    .in("lead_id", leadIds)
    .gte("received_at", since)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const record = row as Row
    const leadId = String(record.lead_id)
    const intent = String(record.intent ?? "")
    const existing = result.get(leadId) ?? { replied: false, positiveInterest: false }
    existing.replied = true
    if (POSITIVE_REPLY_INTENTS.has(intent)) existing.positiveInterest = true
    result.set(leadId, existing)
  }

  return result
}

async function loadMeetingOutcomes(admin: SupabaseClient, leadIds: string[], since: string): Promise<Set<string>> {
  const result = new Set<string>()
  if (leadIds.length === 0) return result

  const { data, error } = await admin
    .schema("growth")
    .from("booking_intent_signals")
    .select("lead_id, detected_at")
    .in("lead_id", leadIds)
    .gte("detected_at", since)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    result.add(String((row as Row).lead_id))
  }

  return result
}

async function loadOpportunityOutcomes(admin: SupabaseClient, leadIds: string[], since: string): Promise<Set<string>> {
  const result = new Set<string>()
  if (leadIds.length === 0) return result

  const { data, error } = await admin
    .schema("growth")
    .from("opportunities")
    .select("lead_id, created_at")
    .in("lead_id", leadIds)
    .gte("created_at", since)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    result.add(String((row as Row).lead_id))
  }

  return result
}

export async function loadOutreachPerformanceAttributedSends(
  admin: SupabaseClient,
  input?: { measurementWindowDays?: number },
): Promise<OutreachPerformanceAttributedSend[]> {
  const measurementWindowDays = input?.measurementWindowDays ?? OUTREACH_PERFORMANCE_OUTCOME_WINDOW_DAYS
  const since = daysAgoIso(measurementWindowDays)

  const [attributions, sentGenerations] = await Promise.all([
    listOutreachPerformanceAttributions(admin, { since, limit: 500 }),
    loadSentGenerations(admin, since),
  ])

  const sentByGenerationId = new Map(sentGenerations.map((entry) => [entry.id, entry]))
  const leadIds = [...new Set(attributions.map((entry) => entry.leadId).filter(Boolean) as string[])]

  const [replyOutcomes, meetingOutcomes, opportunityOutcomes] = await Promise.all([
    loadReplyOutcomes(admin, leadIds, since),
    loadMeetingOutcomes(admin, leadIds, since),
    loadOpportunityOutcomes(admin, leadIds, since),
  ])

  return attributions.map((attribution) => {
    const sentMeta = attribution.generationId ? sentByGenerationId.get(attribution.generationId) : undefined
    const leadId = attribution.leadId ?? sentMeta?.leadId ?? null
    const reply = leadId ? replyOutcomes.get(leadId) : undefined

    return attachOutreachPerformanceOutcomes(attribution, {
      sent: Boolean(sentMeta?.sentAt),
      sentAt: sentMeta?.sentAt ?? null,
      replied: reply?.replied ?? false,
      positiveInterest: reply?.positiveInterest ?? false,
      meetingBooked: leadId ? meetingOutcomes.has(leadId) : false,
      opportunityCreated: leadId ? opportunityOutcomes.has(leadId) : false,
    })
  })
}

export async function fetchOutreachPerformanceDashboard(
  admin: SupabaseClient,
  input?: { measurementWindowDays?: number },
): Promise<OutreachPerformanceDashboard> {
  const measurementWindowDays = input?.measurementWindowDays ?? OUTREACH_PERFORMANCE_OUTCOME_WINDOW_DAYS
  const attributedSends = await loadOutreachPerformanceAttributedSends(admin, { measurementWindowDays })
  const sentRows = attributedSends.filter((row) => row.sent)
  const dataAudit = buildOutreachPerformanceDataAudit()

  return {
    qa_marker: GROWTH_OUTREACH_PERFORMANCE_QA_MARKER,
    generatedAt: new Date().toISOString(),
    measurementWindowDays,
    executiveSummary: buildExecutiveSummary(sentRows, measurementWindowDays),
    subjectIntelligence: aggregateSubjectPerformance(sentRows),
    openerIntelligence: aggregateOpenerPerformance(sentRows),
    ctaIntelligence: aggregateCtaPerformance(sentRows),
    personalizationIntelligence: aggregatePersonalizationPerformance(sentRows),
    dataAudit: {
      availableMetrics: [...dataAudit.availableMetrics],
      missingMetrics: [...dataAudit.missingMetrics],
      attributionLimitations: [...dataAudit.attributionLimitations],
    },
  }
}

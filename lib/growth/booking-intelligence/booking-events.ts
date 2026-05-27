import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { formatAvailabilityHint, suggestAvailabilityFoundation } from "@/lib/growth/booking-intelligence/availability-suggestion"
import { recordBookingAttributionEvent } from "@/lib/growth/booking-intelligence/booking-attribution"
import {
  detectBookingIntentFromInbox,
  detectBookingIntentFromOpportunitySignals,
  detectBookingIntentFromReplyDraftOutcome,
  hasMinimumBookingEvidence,
} from "@/lib/growth/booking-intelligence/booking-intent-detector"
import { generateBookingRecommendations } from "@/lib/growth/booking-intelligence/booking-recommendation"
import {
  resolveRoutingRuleType,
  selectCalendarRoutingRule,
  suggestedOwnerLabelFromRule,
} from "@/lib/growth/booking-intelligence/calendar-routing"
import type {
  GrowthBookingIntentSignal,
  GrowthBookingRecommendation,
  GrowthCalendarRoutingRule,
  GrowthMeetingConversionEvent,
  GrowthSequenceMeetingExitCandidate,
} from "@/lib/growth/booking-intelligence/booking-types"
import { maskBookingLeadLabel } from "@/lib/growth/booking-intelligence/booking-types"
import { detectSequenceMeetingExitCandidates } from "@/lib/growth/booking-intelligence/sequence-meeting-exit"

type Row = Record<string, unknown>

function intentSignalsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("booking_intent_signals")
}

function recommendationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("booking_recommendations")
}

function routingRulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("calendar_routing_rules")
}

function conversionEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("meeting_conversion_events")
}

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

async function resolveLeadLabel(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data } = await admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
  return maskBookingLeadLabel(leadId, (data as Row | null)?.company_name as string | null)
}

async function leadHasActiveSequence(admin: SupabaseClient, leadId: string): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("status", "active")
  if (error) return false
  return (count ?? 0) > 0
}

async function resolveRoutingContext(
  admin: SupabaseClient,
  input: { leadId: string; inboxThreadId?: string | null },
): Promise<{
  hasLeadOwner: boolean
  hasThreadOwner: boolean
  territory: string | null
  industry: string | null
  accountPriority: "low" | "medium" | "high" | null
}> {
  const { data: leadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("owner_user_id, state, industry")
    .eq("id", input.leadId)
    .maybeSingle()
  let hasThreadOwner = false
  if (input.inboxThreadId) {
    const { data: threadRow } = await admin
      .schema("growth")
      .from("inbox_threads")
      .select("owner_user_id")
      .eq("id", input.inboxThreadId)
      .maybeSingle()
    hasThreadOwner = Boolean((threadRow as Row | null)?.owner_user_id)
  }
  return {
    hasLeadOwner: Boolean((leadRow as Row | null)?.owner_user_id),
    hasThreadOwner,
    territory: ((leadRow as Row | null)?.state as string | null) ?? null,
    industry: ((leadRow as Row | null)?.industry as string | null) ?? null,
    accountPriority: null,
  }
}

function mapIntentSignal(row: Row, leadLabel: string): GrowthBookingIntentSignal {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    leadLabel,
    inboxThreadId: row.inbox_thread_id ? String(row.inbox_thread_id) : null,
    intentType: String(row.intent_type) as GrowthBookingIntentSignal["intentType"],
    confidence: String(row.confidence) as GrowthBookingIntentSignal["confidence"],
    evidenceSnippet: String(row.evidence_snippet),
    source: String(row.source),
    detectedAt: String(row.detected_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

function mapRecommendation(row: Row, leadLabel: string): GrowthBookingRecommendation {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    leadLabel,
    inboxThreadId: row.inbox_thread_id ? String(row.inbox_thread_id) : null,
    intentSignalId: row.intent_signal_id ? String(row.intent_signal_id) : null,
    recommendationType: String(row.recommendation_type),
    status: String(row.status) as GrowthBookingRecommendation["status"],
    title: String(row.title),
    description: String(row.description),
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthBookingRecommendation["evidence"]) : [],
    routingRuleType: row.routing_rule_type
      ? (String(row.routing_rule_type) as GrowthBookingRecommendation["routingRuleType"])
      : null,
    suggestedOwnerLabel: row.suggested_owner_label ? String(row.suggested_owner_label) : null,
    availabilityHint: row.availability_hint ? String(row.availability_hint) : null,
    requiresHumanApproval: true,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    dismissedBy: row.dismissed_by ? String(row.dismissed_by) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

function mapRoutingRule(row: Row): GrowthCalendarRoutingRule {
  return {
    id: String(row.id),
    ruleType: String(row.rule_type) as GrowthCalendarRoutingRule["ruleType"],
    label: String(row.label),
    priority: Number(row.priority ?? 100),
    isActive: Boolean(row.is_active),
    matchCriteria: (row.match_criteria as Record<string, unknown>) ?? {},
    targetOwnerLabel: row.target_owner_label ? String(row.target_owner_label) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function insertMeetingConversionEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    recommendationId?: string | null
    eventType: string
    title: string
    description?: string
    severity?: GrowthMeetingConversionEvent["severity"]
    metadata?: Record<string, unknown>
  },
): Promise<GrowthMeetingConversionEvent> {
  const { data, error } = await conversionEventsTable(admin)
    .insert({
      lead_id: input.leadId,
      recommendation_id: input.recommendationId ?? null,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title.slice(0, 200),
      description: (input.description ?? "").slice(0, 500),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as Row
  return {
    id: String(row.id),
    leadId: input.leadId,
    recommendationId: input.recommendationId ?? null,
    eventType: String(row.event_type),
    severity: String(row.severity) as GrowthMeetingConversionEvent["severity"],
    title: String(row.title),
    description: String(row.description),
    createdAt: String(row.created_at),
  }
}

export async function recordBookingPlatformTimeline(
  admin: SupabaseClient,
  input: { eventType: string; title: string; summary: string; leadId: string },
): Promise<void> {
  await platformTimelineTable(admin)
    .insert({
      event_type: input.eventType,
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 500),
      lead_id: input.leadId,
      metadata: { source: "booking_intelligence" },
    })
    .catch(() => undefined)
}

export async function ingestBookingIntelligenceFromInbox(
  admin: SupabaseClient,
  input: {
    leadId: string
    inboxThreadId?: string | null
    subject?: string
    body?: string
    classification: import("@/lib/growth/inbox/inbox-types").GrowthInboxClassification
    engagementScore?: number
  },
): Promise<{ intents: GrowthBookingIntentSignal[]; recommendations: GrowthBookingRecommendation[] }> {
  const detected = detectBookingIntentFromInbox({
    subject: input.subject,
    body: input.body,
    classification: input.classification,
  })
  if (!hasMinimumBookingEvidence(detected)) return { intents: [], recommendations: [] }

  const leadLabel = await resolveLeadLabel(admin, input.leadId)
  const hasActiveSequence = await leadHasActiveSequence(admin, input.leadId)
  const routingRules = await listCalendarRoutingRules(admin)
  const routingContext = await resolveRoutingContext(admin, {
    leadId: input.leadId,
    inboxThreadId: input.inboxThreadId,
  })
  const selectedRule = selectCalendarRoutingRule(routingRules, routingContext)
  const availability = suggestAvailabilityFoundation()
  const intentIds: string[] = []
  const createdIntents: GrowthBookingIntentSignal[] = []

  for (const intent of detected) {
    const { data, error } = await intentSignalsTable(admin)
      .insert({
        lead_id: input.leadId,
        inbox_thread_id: input.inboxThreadId ?? null,
        intent_type: intent.intentType,
        confidence: intent.confidence,
        evidence_snippet: intent.evidenceSnippet,
        source: intent.source,
        metadata: { classification: input.classification },
      })
      .select("*")
      .single()
    if (error) continue
    const row = data as Row
    intentIds.push(String(row.id))
    createdIntents.push(mapIntentSignal(row, leadLabel))
    await insertMeetingConversionEvent(admin, {
      leadId: input.leadId,
      eventType: "booking_intent_detected",
      title: "Booking intent detected",
      description: `${intent.intentType.replace(/_/g, " ")} from inbox activity.`,
      metadata: { intent_type: intent.intentType },
    }).catch(() => undefined)
    await recordBookingPlatformTimeline(admin, {
      eventType: "booking_intent_detected",
      title: "Booking intent detected",
      summary: intent.intentType,
      leadId: input.leadId,
    }).catch(() => undefined)
  }

  const generated = generateBookingRecommendations({
    intents: detected,
    hasActiveSequence,
    engagementScore: input.engagementScore,
  })
  const createdRecommendations: GrowthBookingRecommendation[] = []

  for (const recommendation of generated) {
    const routingRuleType =
      recommendation.routingRuleType ?? resolveRoutingRuleType(routingRules, routingContext)
    const { data, error } = await recommendationsTable(admin)
      .insert({
        lead_id: input.leadId,
        inbox_thread_id: input.inboxThreadId ?? null,
        intent_signal_id: intentIds[0] ?? null,
        recommendation_type: recommendation.recommendationType,
        status: "pending_review",
        title: recommendation.title,
        description: recommendation.description,
        evidence: recommendation.evidence,
        routing_rule_type: routingRuleType,
        suggested_owner_label: suggestedOwnerLabelFromRule(selectedRule),
        availability_hint: recommendation.availabilityHint ?? formatAvailabilityHint(availability),
        requires_human_approval: true,
        metadata: { source: "inbox_classifier", no_autonomous_booking: true },
      })
      .select("*")
      .single()
    if (error) continue
    const row = data as Row
    createdRecommendations.push(mapRecommendation(row, leadLabel))
    await insertMeetingConversionEvent(admin, {
      leadId: input.leadId,
      recommendationId: String(row.id),
      eventType: "booking_recommendation_created",
      title: recommendation.title,
      description: recommendation.description,
    }).catch(() => undefined)
    await recordBookingPlatformTimeline(admin, {
      eventType: "booking_recommendation_created",
      title: recommendation.title,
      summary: recommendation.description,
      leadId: input.leadId,
    }).catch(() => undefined)
    await recordBookingAttributionEvent(admin, {
      leadId: input.leadId,
      recommendationId: String(row.id),
      intentSignalId: intentIds[0] ?? null,
      eventType: "booking_recommendation_created",
      weightedScore: recommendation.recommendationType === "book_meeting" ? 1 : 0.5,
      metadata: { source: "inbox_classifier" },
    }).catch(() => undefined)
  }

  for (const candidate of detectSequenceMeetingExitCandidates({ intents: detected, hasActiveSequence })) {
    await insertMeetingConversionEvent(admin, {
      leadId: input.leadId,
      eventType: "sequence_meeting_exit_candidate_detected",
      title: "Sequence meeting exit candidate",
      description: candidate.reason,
      severity: "medium",
      metadata: { evidence: candidate.evidenceSnippet },
    }).catch(() => undefined)
    await recordBookingPlatformTimeline(admin, {
      eventType: "sequence_meeting_exit_candidate_detected",
      title: "Sequence meeting exit candidate",
      summary: candidate.reason,
      leadId: input.leadId,
    }).catch(() => undefined)
  }

  return { intents: createdIntents, recommendations: createdRecommendations }
}

export async function ingestBookingIntelligenceFromReplyDraft(
  admin: SupabaseClient,
  input: {
    leadId: string
    inboxThreadId?: string | null
    draftId: string
    classification?: import("@/lib/growth/inbox/inbox-types").GrowthInboxClassification | null
    subject?: string
    body?: string
    draftStatus: "sent" | "approved" | "discarded" | "blocked"
  },
): Promise<void> {
  const detected = detectBookingIntentFromReplyDraftOutcome(input)
  if (!hasMinimumBookingEvidence(detected)) return
  await ingestBookingIntelligenceFromInbox(admin, {
    leadId: input.leadId,
    inboxThreadId: input.inboxThreadId,
    subject: input.subject,
    body: input.body,
    classification: input.classification ?? "unknown",
  })
}

export async function ingestBookingIntelligenceFromOpportunitySignals(
  admin: SupabaseClient,
  input: {
    leadId: string
    inboxThreadId?: string | null
    signals: Array<{ signalType: string; evidenceSnippet: string; source?: string }>
  },
): Promise<void> {
  const detected = detectBookingIntentFromOpportunitySignals(
    input.signals as Parameters<typeof detectBookingIntentFromOpportunitySignals>[0],
  )
  if (!hasMinimumBookingEvidence(detected)) return
  await ingestBookingIntelligenceFromInbox(admin, {
    leadId: input.leadId,
    inboxThreadId: input.inboxThreadId,
    body: detected.map((intent) => intent.evidenceSnippet).join(" "),
    classification: "meeting_intent",
  })
}

export async function listBookingIntentSignals(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthBookingIntentSignal[]> {
  let query = intentSignalsTable(admin).select("*").order("detected_at", { ascending: false }).limit(input?.limit ?? 100)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const labels = new Map<string, string>()
  for (const row of rows) {
    const leadId = String((row as Row).lead_id)
    if (!labels.has(leadId)) labels.set(leadId, await resolveLeadLabel(admin, leadId))
  }
  return rows.map((row) => mapIntentSignal(row as Row, labels.get(String((row as Row).lead_id)) ?? "Account"))
}

export async function listBookingRecommendations(
  admin: SupabaseClient,
  input?: { leadId?: string; status?: GrowthBookingRecommendation["status"]; limit?: number },
): Promise<GrowthBookingRecommendation[]> {
  let query = recommendationsTable(admin)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  if (input?.status) query = query.eq("status", input.status)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const labels = new Map<string, string>()
  for (const row of rows) {
    const leadId = String((row as Row).lead_id)
    if (!labels.has(leadId)) labels.set(leadId, await resolveLeadLabel(admin, leadId))
  }
  return rows.map((row) => mapRecommendation(row as Row, labels.get(String((row as Row).lead_id)) ?? "Account"))
}

export async function listCalendarRoutingRules(admin: SupabaseClient): Promise<GrowthCalendarRoutingRule[]> {
  const { data, error } = await routingRulesTable(admin)
    .select("*")
    .order("priority", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRoutingRule(row as Row))
}

export async function upsertCalendarRoutingRule(
  admin: SupabaseClient,
  input: {
    id?: string
    ruleType: GrowthCalendarRoutingRule["ruleType"]
    label: string
    priority?: number
    isActive?: boolean
    matchCriteria?: Record<string, unknown>
    targetOwnerLabel?: string | null
  },
): Promise<GrowthCalendarRoutingRule> {
  const now = new Date().toISOString()
  const payload = {
    rule_type: input.ruleType,
    label: input.label,
    priority: input.priority ?? 100,
    is_active: input.isActive ?? true,
    match_criteria: input.matchCriteria ?? {},
    target_owner_label: input.targetOwnerLabel ?? null,
    updated_at: now,
  }

  if (input.id) {
    const { data, error } = await routingRulesTable(admin).update(payload).eq("id", input.id).select("*").single()
    if (error) throw new Error(error.message)
    return mapRoutingRule(data as Row)
  }

  const { data, error } = await routingRulesTable(admin).insert(payload).select("*").single()
  if (error) throw new Error(error.message)
  return mapRoutingRule(data as Row)
}

export async function listMeetingConversionEvents(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthMeetingConversionEvent[]> {
  let query = conversionEventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      leadId: record.lead_id ? String(record.lead_id) : null,
      recommendationId: record.recommendation_id ? String(record.recommendation_id) : null,
      eventType: String(record.event_type),
      severity: String(record.severity) as GrowthMeetingConversionEvent["severity"],
      title: String(record.title),
      description: String(record.description),
      createdAt: String(record.created_at),
    }
  })
}

export async function listSequenceMeetingExitCandidates(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthSequenceMeetingExitCandidate[]> {
  let query = conversionEventsTable(admin)
    .select("*")
    .eq("event_type", "sequence_meeting_exit_candidate_detected")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 30)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const labels = new Map<string, string>()
  for (const row of rows) {
    const leadId = String((row as Row).lead_id)
    if (!labels.has(leadId)) labels.set(leadId, await resolveLeadLabel(admin, leadId))
  }

  return rows.map((row) => {
    const record = row as Row
    const metadata = (record.metadata as Record<string, unknown>) ?? {}
    return {
      id: String(record.id),
      leadId: String(record.lead_id),
      leadLabel: labels.get(String(record.lead_id)) ?? "Account",
      reason: String(record.description),
      evidenceSnippet: String(metadata.evidence ?? record.description),
      recommendationId: record.recommendation_id ? String(record.recommendation_id) : null,
      detectedAt: String(record.created_at),
    }
  })
}

export async function approveBookingRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string },
): Promise<GrowthBookingRecommendation> {
  const { data: existing, error: fetchError } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("recommendation_not_found")
  const existingRow = existing as Row
  if (existingRow.status !== "pending_review") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const { data, error } = await recommendationsTable(admin)
    .update({
      status: "approved",
      approved_by: input.actorUserId,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...((existingRow.metadata as Record<string, unknown>) ?? {}),
        approval_records_intent_only: true,
        no_autonomous_booking: true,
        no_autonomous_calendar_write: true,
      },
    })
    .eq("id", input.recommendationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const leadLabel = await resolveLeadLabel(admin, String(existingRow.lead_id))
  await insertMeetingConversionEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "booking_recommendation_approved",
    title: "Booking recommendation approved",
    description: "Human approved booking action — operator must book manually.",
    metadata: { approved_by: input.actorUserId },
  })
  await recordBookingPlatformTimeline(admin, {
    eventType: "booking_recommendation_approved",
    title: "Booking recommendation approved",
    summary: String(existingRow.title),
    leadId: String(existingRow.lead_id),
  })
  await recordBookingAttributionEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "booking_recommendation_approved",
    weightedScore: 1,
    metadata: { approved_by: input.actorUserId },
  }).catch(() => undefined)

  return mapRecommendation(data as Row, leadLabel)
}

export async function dismissBookingRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; reason?: string },
): Promise<GrowthBookingRecommendation> {
  const { data: existing, error: fetchError } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("recommendation_not_found")
  const existingRow = existing as Row
  if (existingRow.status !== "pending_review") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const { data, error } = await recommendationsTable(admin)
    .update({
      status: "dismissed",
      dismissed_by: input.actorUserId,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...((existingRow.metadata as Record<string, unknown>) ?? {}),
        dismiss_reason: input.reason ?? null,
      },
    })
    .eq("id", input.recommendationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const leadLabel = await resolveLeadLabel(admin, String(existingRow.lead_id))
  await insertMeetingConversionEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "booking_recommendation_dismissed",
    title: "Booking recommendation dismissed",
    description: input.reason ?? "Operator dismissed booking recommendation.",
  })
  await recordBookingPlatformTimeline(admin, {
    eventType: "booking_recommendation_dismissed",
    title: "Booking recommendation dismissed",
    summary: String(existingRow.title),
    leadId: String(existingRow.lead_id),
  })

  return mapRecommendation(data as Row, leadLabel)
}

export async function completeBookingRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; note?: string },
): Promise<GrowthBookingRecommendation> {
  const { data: existing, error: fetchError } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("recommendation_not_found")
  const existingRow = existing as Row
  if (existingRow.status !== "approved") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const { data, error } = await recommendationsTable(admin)
    .update({
      status: "completed",
      completed_by: input.actorUserId,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...((existingRow.metadata as Record<string, unknown>) ?? {}),
        completion_note: input.note ?? null,
        manually_booked_or_deferred: true,
      },
    })
    .eq("id", input.recommendationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const leadLabel = await resolveLeadLabel(admin, String(existingRow.lead_id))
  await insertMeetingConversionEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "booking_recommendation_completed",
    title: "Meeting booking completed",
    description: input.note ?? "Operator recorded manual booking or deferred follow-up.",
    severity: "high",
  })
  await recordBookingPlatformTimeline(admin, {
    eventType: "booking_recommendation_completed",
    title: "Meeting booking completed",
    summary: String(existingRow.title),
    leadId: String(existingRow.lead_id),
  })
  await recordBookingAttributionEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "meeting_conversion_recorded",
    weightedScore: 2,
    metadata: { completed_by: input.actorUserId },
  }).catch(() => undefined)
  await recordBookingPlatformTimeline(admin, {
    eventType: "meeting_conversion_recorded",
    title: "Meeting conversion recorded",
    summary: String(existingRow.title),
    leadId: String(existingRow.lead_id),
  }).catch(() => undefined)

  return mapRecommendation(data as Row, leadLabel)
}

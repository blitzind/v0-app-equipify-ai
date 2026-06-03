import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { detectBuyingCommitteeSignals } from "@/lib/growth/opportunity-intelligence/committee-signal"
import { generateOpportunityRecommendations } from "@/lib/growth/opportunity-intelligence/opportunity-recommendation"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import {
  insertCrmIntelligenceEvent,
  recordOpportunityIntelligencePlatformTimeline,
} from "@/lib/growth/opportunity-intelligence/opportunity-events"
import {
  detectOpportunitySignalsFromInbox,
  detectOpportunitySignalsFromReplyDraftOutcome,
  hasMinimumEvidence,
} from "@/lib/growth/opportunity-intelligence/signal-detector"
import {
  detectSequencePauseCandidates,
  detectStopSequenceCandidate,
} from "@/lib/growth/opportunity-intelligence/sequence-pause-detector"
import type {
  GrowthBuyingCommitteeSignal,
  GrowthOpportunityRecommendation,
  GrowthOpportunitySignal,
  GrowthSequencePauseCandidate,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"
import { maskOpportunityLeadLabel } from "@/lib/growth/opportunity-intelligence/opportunity-types"

type Row = Record<string, unknown>

function signalsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunity_signals")
}

function recommendationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunity_recommendations")
}

function committeeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("buying_committee_signals")
}

function pauseCandidatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_pause_candidates")
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

async function leadHasOwner(admin: SupabaseClient, leadId: string): Promise<boolean> {
  const { data } = await admin.schema("growth").from("leads").select("owner_user_id").eq("id", leadId).maybeSingle()
  return Boolean((data as Row | null)?.owner_user_id)
}

async function resolveLeadLabel(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data } = await admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
  return maskOpportunityLeadLabel(leadId, (data as Row | null)?.company_name as string | null)
}

function mapSignal(row: Row, leadLabel: string): GrowthOpportunitySignal {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    leadLabel,
    inboxThreadId: row.inbox_thread_id ? String(row.inbox_thread_id) : null,
    signalType: String(row.signal_type) as GrowthOpportunitySignal["signalType"],
    confidence: String(row.confidence) as GrowthOpportunitySignal["confidence"],
    evidenceSnippet: String(row.evidence_snippet),
    source: String(row.source),
    detectedAt: String(row.detected_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

function mapRecommendation(row: Row, leadLabel: string): GrowthOpportunityRecommendation {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    leadLabel,
    inboxThreadId: row.inbox_thread_id ? String(row.inbox_thread_id) : null,
    recommendationType: String(row.recommendation_type) as GrowthOpportunityRecommendation["recommendationType"],
    status: String(row.status) as GrowthOpportunityRecommendation["status"],
    title: String(row.title),
    description: String(row.description),
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthOpportunityRecommendation["evidence"]) : [],
    signalIds: Array.isArray(row.signal_ids) ? (row.signal_ids as string[]) : [],
    requiresHumanApproval: true,
    acceptedBy: row.accepted_by ? String(row.accepted_by) : null,
    dismissedBy: row.dismissed_by ? String(row.dismissed_by) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export async function ingestOpportunityIntelligenceFromInbox(
  admin: SupabaseClient,
  input: {
    leadId: string
    inboxThreadId?: string | null
    subject?: string
    body?: string
    classification: import("@/lib/growth/inbox/inbox-types").GrowthInboxClassification
  },
): Promise<{ signals: GrowthOpportunitySignal[]; recommendations: GrowthOpportunityRecommendation[] }> {
  const detected = detectOpportunitySignalsFromInbox({
    subject: input.subject,
    body: input.body,
    classification: input.classification,
  })
  if (!hasMinimumEvidence(detected)) return { signals: [], recommendations: [] }

  const leadLabel = await resolveLeadLabel(admin, input.leadId)
  const [hasActiveSequence, hasOwner, memory] = await Promise.all([
    leadHasActiveSequence(admin, input.leadId),
    leadHasOwner(admin, input.leadId),
    buildLeadMemoryInfluenceContext(admin, input.leadId),
  ])
  const signalIds: string[] = []
  const createdSignals: GrowthOpportunitySignal[] = []

  for (const signal of detected) {
    const { data, error } = await signalsTable(admin)
      .insert({
        lead_id: input.leadId,
        inbox_thread_id: input.inboxThreadId ?? null,
        signal_type: signal.signalType,
        confidence: signal.confidence,
        evidence_snippet: signal.evidenceSnippet,
        source: signal.source,
        metadata: { classification: input.classification },
      })
      .select("*")
      .single()
    if (error) continue
    const row = data as Row
    signalIds.push(String(row.id))
    createdSignals.push(mapSignal(row, leadLabel))
    await insertCrmIntelligenceEvent(admin, {
      leadId: input.leadId,
      signalId: String(row.id),
      eventType: "opportunity_signal_detected",
      title: "Opportunity signal detected",
      description: `${signal.signalType.replace(/_/g, " ")} from inbox activity.`,
      metadata: { signal_type: signal.signalType },
    }).catch(() => undefined)
  }

  for (const committee of detectBuyingCommitteeSignals({
    subject: input.subject,
    body: input.body,
    signals: detected,
  })) {
    await committeeTable(admin)
      .insert({
        lead_id: input.leadId,
        inbox_thread_id: input.inboxThreadId ?? null,
        contact_label: committee.contactLabel,
        role_hint: committee.roleHint,
        signal_strength: committee.signalStrength,
        evidence_snippet: committee.evidenceSnippet,
        source: committee.source,
      })
      .catch(() => undefined)
    await recordOpportunityIntelligencePlatformTimeline(admin, {
      eventType: "committee_signal_detected",
      title: "Committee signal detected",
      summary: committee.contactLabel,
      leadId: input.leadId,
    }).catch(() => undefined)
  }

  const generated = generateOpportunityRecommendations({
    signals: detected,
    hasActiveSequence,
    hasOwner,
    memory: {
      available: memory.available,
      relationshipStage: memory.relationshipStage,
      unresolvedObjectionCount: memory.unresolvedObjectionCount,
      riskFlags: memory.riskFlags,
      commitmentSummaries: memory.commitmentSummaries,
    },
  })
  const createdRecommendations: GrowthOpportunityRecommendation[] = []

  for (const recommendation of generated) {
    const { data, error } = await recommendationsTable(admin)
      .insert({
        lead_id: input.leadId,
        inbox_thread_id: input.inboxThreadId ?? null,
        recommendation_type: recommendation.recommendationType,
        status: "pending",
        title: recommendation.title,
        description: recommendation.description,
        evidence: recommendation.evidence,
        signal_ids: signalIds,
        requires_human_approval: true,
        metadata: { source: "inbox_classifier" },
      })
      .select("*")
      .single()
    if (error) continue
    const row = data as Row
    createdRecommendations.push(mapRecommendation(row, leadLabel))
    await insertCrmIntelligenceEvent(admin, {
      leadId: input.leadId,
      recommendationId: String(row.id),
      eventType: "opportunity_recommendation_created",
      title: recommendation.title,
      description: recommendation.description,
    }).catch(() => undefined)
    await recordOpportunityIntelligencePlatformTimeline(admin, {
      eventType: "opportunity_recommendation_created",
      title: recommendation.title,
      summary: recommendation.description,
      leadId: input.leadId,
    }).catch(() => undefined)
  }

  for (const candidate of detectSequencePauseCandidates({ signals: detected, hasActiveSequence })) {
    const recommendation = createdRecommendations.find((entry) => entry.recommendationType === "pause_sequence")
    await pauseCandidatesTable(admin)
      .insert({
        lead_id: input.leadId,
        recommendation_id: recommendation?.id ?? null,
        reason: candidate.reason,
        signal_type: candidate.signalType,
        status: "pending",
        evidence_snippet: candidate.evidenceSnippet,
      })
      .catch(() => undefined)
    await recordOpportunityIntelligencePlatformTimeline(admin, {
      eventType: "sequence_pause_candidate_detected",
      title: "Sequence pause candidate",
      summary: candidate.reason,
      leadId: input.leadId,
    }).catch(() => undefined)
  }

  const stopCandidate = detectStopSequenceCandidate({ signals: detected, hasActiveSequence })
  if (stopCandidate) {
    await recommendationsTable(admin)
      .insert({
        lead_id: input.leadId,
        inbox_thread_id: input.inboxThreadId ?? null,
        recommendation_type: "stop_sequence",
        status: "pending",
        title: "Stop sequence",
        description: stopCandidate.reason,
        evidence: [{ source: "inbox_classifier", snippet: stopCandidate.evidenceSnippet }],
        signal_ids: signalIds,
        requires_human_approval: true,
      })
      .catch(() => undefined)
  }

  return { signals: createdSignals, recommendations: createdRecommendations }
}

export async function ingestOpportunityIntelligenceFromReplyDraft(
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
  const detected = detectOpportunitySignalsFromReplyDraftOutcome(input)
  if (!hasMinimumEvidence(detected)) return
  await ingestOpportunityIntelligenceFromInbox(admin, {
    leadId: input.leadId,
    inboxThreadId: input.inboxThreadId,
    subject: input.subject,
    body: input.body,
    classification: input.classification ?? "unknown",
  })
}

export async function listOpportunitySignals(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthOpportunitySignal[]> {
  let query = signalsTable(admin).select("*").order("detected_at", { ascending: false }).limit(input?.limit ?? 100)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const labels = new Map<string, string>()
  for (const row of rows) {
    const leadId = String((row as Row).lead_id)
    if (!labels.has(leadId)) labels.set(leadId, await resolveLeadLabel(admin, leadId))
  }
  return rows.map((row) => mapSignal(row as Row, labels.get(String((row as Row).lead_id)) ?? "Account"))
}

export async function listOpportunityRecommendations(
  admin: SupabaseClient,
  input?: { leadId?: string; status?: GrowthOpportunityRecommendation["status"]; limit?: number },
): Promise<GrowthOpportunityRecommendation[]> {
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

export async function listBuyingCommitteeSignals(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthBuyingCommitteeSignal[]> {
  let query = committeeTable(admin).select("*").order("detected_at", { ascending: false }).limit(input?.limit ?? 50)
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
    return {
      id: String(record.id),
      leadId: String(record.lead_id),
      leadLabel: labels.get(String(record.lead_id)) ?? "Account",
      inboxThreadId: record.inbox_thread_id ? String(record.inbox_thread_id) : null,
      contactLabel: String(record.contact_label),
      roleHint: record.role_hint ? String(record.role_hint) : null,
      signalStrength: String(record.signal_strength) as GrowthBuyingCommitteeSignal["signalStrength"],
      evidenceSnippet: String(record.evidence_snippet),
      source: String(record.source),
      detectedAt: String(record.detected_at),
    }
  })
}

export async function listSequencePauseCandidates(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthSequencePauseCandidate[]> {
  let query = pauseCandidatesTable(admin)
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(input?.limit ?? 50)
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
    return {
      id: String(record.id),
      leadId: String(record.lead_id),
      leadLabel: labels.get(String(record.lead_id)) ?? "Account",
      sequenceEnrollmentId: record.sequence_enrollment_id ? String(record.sequence_enrollment_id) : null,
      recommendationId: record.recommendation_id ? String(record.recommendation_id) : null,
      reason: String(record.reason),
      signalType: record.signal_type ? (String(record.signal_type) as GrowthSequencePauseCandidate["signalType"]) : null,
      status: String(record.status) as GrowthSequencePauseCandidate["status"],
      evidenceSnippet: String(record.evidence_snippet),
      detectedAt: String(record.detected_at),
    }
  })
}

export async function acceptOpportunityRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string },
): Promise<GrowthOpportunityRecommendation> {
  const { data: existing, error: fetchError } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("recommendation_not_found")
  const existingRow = existing as Row
  if (existingRow.status !== "pending") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const { data, error } = await recommendationsTable(admin)
    .update({
      status: "accepted",
      accepted_by: input.actorUserId,
      resolved_at: now,
      updated_at: now,
      metadata: {
        ...((existingRow.metadata as Record<string, unknown>) ?? {}),
        acceptance_records_intent_only: true,
        no_autonomous_crm_mutation: true,
      },
    })
    .eq("id", input.recommendationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const leadLabel = await resolveLeadLabel(admin, String(existingRow.lead_id))
  await insertCrmIntelligenceEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "opportunity_recommendation_accepted",
    title: "Recommendation accepted",
    description: "Human accepted recommendation — no autonomous CRM mutation performed.",
    metadata: { accepted_by: input.actorUserId },
  })
  await recordOpportunityIntelligencePlatformTimeline(admin, {
    eventType: "opportunity_recommendation_accepted",
    title: "Opportunity recommendation accepted",
    summary: String(existingRow.title),
    leadId: String(existingRow.lead_id),
  })

  return mapRecommendation(data as Row, leadLabel)
}

export async function dismissOpportunityRecommendation(
  admin: SupabaseClient,
  input: { recommendationId: string; actorUserId: string; reason?: string },
): Promise<GrowthOpportunityRecommendation> {
  const { data: existing, error: fetchError } = await recommendationsTable(admin)
    .select("*")
    .eq("id", input.recommendationId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("recommendation_not_found")
  const existingRow = existing as Row
  if (existingRow.status !== "pending") throw new Error("invalid_status")

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
  await insertCrmIntelligenceEvent(admin, {
    leadId: String(existingRow.lead_id),
    recommendationId: input.recommendationId,
    eventType: "opportunity_recommendation_dismissed",
    title: "Recommendation dismissed",
    description: input.reason ?? "Operator dismissed recommendation.",
    metadata: { dismissed_by: input.actorUserId },
  })
  await recordOpportunityIntelligencePlatformTimeline(admin, {
    eventType: "opportunity_recommendation_dismissed",
    title: "Opportunity recommendation dismissed",
    summary: String(existingRow.title),
    leadId: String(existingRow.lead_id),
  })

  return mapRecommendation(data as Row, leadLabel)
}

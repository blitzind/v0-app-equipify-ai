import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { appendLeadMemoryTimelineEvent } from "@/lib/growth/lead-memory/memory-events"
import {
  hasMinimumMemoryEvidence,
  ingestMemoryCandidatesFromSource,
  type IngestedMemoryCandidate,
} from "@/lib/growth/lead-memory/memory-ingestion"
import { mapCandidateToObjection, rankObjections } from "@/lib/growth/lead-memory/objection-memory"
import { mapCandidateToPreference, rankPreferences } from "@/lib/growth/lead-memory/preference-memory"
import {
  aggregateHighestConfidence,
  computeEngagementTrend,
  computeMemoryCoverageScore,
  computeProgressionScore,
  extractRiskFlags,
  extractTopSignals,
  inferRelationshipStage,
  stageDistribution,
} from "@/lib/growth/lead-memory/relationship-context"
import { buildRelationshipSummary, buildSummaryHighlights } from "@/lib/growth/lead-memory/relationship-summary"
import {
  GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER,
  maskLeadMemoryLabel,
  type GrowthCommitteeRelationshipContext,
  type GrowthLeadMemoryDashboard,
  type GrowthLeadMemoryEvent,
  type GrowthLeadMemoryProfile,
  type GrowthLeadMemoryProfileView,
  type GrowthLeadObjectionMemory,
  type GrowthLeadPreferenceMemory,
  type GrowthMemoryConfidence,
  type GrowthRelationshipContext,
  type GrowthRelationshipStage,
  type GrowthRelationshipSummarySnapshot,
} from "@/lib/growth/lead-memory/memory-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_memory_profiles")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_memory_events")
}

function objectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_objection_memory")
}

function preferencesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_preference_memory")
}

function relationshipTable(admin: SupabaseClient) {
  return admin.schema("growth").from("relationship_context")
}

function committeeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("committee_relationship_context")
}

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("relationship_summary_snapshots")
}

function mapEvent(row: Record<string, unknown>): GrowthLeadMemoryEvent {
  return {
    id: asString(row.id),
    leadLabel: asString(row.lead_label),
    memoryCategory: asString(row.memory_category) as GrowthLeadMemoryEvent["memoryCategory"],
    confidence: asString(row.confidence) as GrowthMemoryConfidence,
    title: asString(row.title),
    evidenceSnippet: asString(row.evidence_snippet),
    sourceSystem: asString(row.source_system),
    recordedAt: asString(row.recorded_at),
  }
}

function mapProfile(row: Record<string, unknown>): GrowthLeadMemoryProfile {
  return {
    id: asString(row.id),
    leadId: asString(row.lead_id),
    leadLabel: asString(row.lead_label),
    relationshipStage: asString(row.relationship_stage) as GrowthRelationshipStage,
    memoryCoverageScore: asNumber(row.memory_coverage_score),
    eventCount: asNumber(row.event_count),
    objectionCount: asNumber(row.objection_count),
    preferenceCount: asNumber(row.preference_count),
    committeeMemberCount: asNumber(row.committee_member_count),
    buyingSignalCount: asNumber(row.buying_signal_count),
    highestConfidence: asString(row.highest_confidence) as GrowthMemoryConfidence,
    summary: asString(row.summary),
    lastRebuiltAt: asString(row.last_rebuilt_at) || null,
    updatedAt: asString(row.updated_at),
  }
}

function mapObjection(row: Record<string, unknown>): GrowthLeadObjectionMemory {
  return {
    id: asString(row.id),
    leadLabel: asString(row.lead_label),
    objectionType: asString(row.objection_type),
    objectionLabel: asString(row.objection_label),
    severity: asString(row.severity) as GrowthLeadObjectionMemory["severity"],
    confidence: asString(row.confidence) as GrowthMemoryConfidence,
    evidenceSnippet: asString(row.evidence_snippet),
    occurrenceCount: asNumber(row.occurrence_count, 1),
    resolved: Boolean(row.resolved),
    lastSeenAt: asString(row.last_seen_at),
  }
}

function mapPreference(row: Record<string, unknown>): GrowthLeadPreferenceMemory {
  return {
    id: asString(row.id),
    leadLabel: asString(row.lead_label),
    preferenceType: asString(row.preference_type) as GrowthLeadPreferenceMemory["preferenceType"],
    preferenceKey: asString(row.preference_key),
    preferenceValue: asString(row.preference_value),
    confidence: asString(row.confidence) as GrowthMemoryConfidence,
    evidenceSnippet: asString(row.evidence_snippet),
  }
}

function mapCommittee(row: Record<string, unknown>): GrowthCommitteeRelationshipContext {
  return {
    id: asString(row.id),
    leadLabel: asString(row.lead_label),
    memberLabel: asString(row.member_label),
    roleHint: asString(row.role_hint),
    influenceLevel: asString(row.influence_level) as GrowthCommitteeRelationshipContext["influenceLevel"],
    confidence: asString(row.confidence) as GrowthMemoryConfidence,
    evidenceSnippet: asString(row.evidence_snippet),
  }
}

function mapRelationship(row: Record<string, unknown>): GrowthRelationshipContext {
  const topSignals = Array.isArray(row.top_signals) ? (row.top_signals as string[]) : []
  const riskFlags = Array.isArray(row.risk_flags) ? (row.risk_flags as string[]) : []
  return {
    id: asString(row.id),
    leadLabel: asString(row.lead_label),
    accountLabel: asString(row.account_label),
    relationshipStage: asString(row.relationship_stage) as GrowthRelationshipStage,
    progressionScore: asNumber(row.progression_score),
    engagementTrend: asString(row.engagement_trend) as GrowthRelationshipContext["engagementTrend"],
    topSignals,
    riskFlags,
  }
}

function mapSnapshot(row: Record<string, unknown>): GrowthRelationshipSummarySnapshot {
  return {
    id: asString(row.id),
    leadLabel: asString(row.lead_label),
    relationshipStage: asString(row.relationship_stage) as GrowthRelationshipStage,
    summary: asString(row.summary),
    memoryCoverageScore: asNumber(row.memory_coverage_score),
    recordedAt: asString(row.recorded_at),
  }
}

async function collectSourceCandidates(
  admin: SupabaseClient,
  leadId: string,
): Promise<IngestedMemoryCandidate[]> {
  const candidates: IngestedMemoryCandidate[] = []
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [threads, replyDrafts, oppSignals, bookingSignals, engagementRows, meetings, committeeSignals] =
    await Promise.all([
      admin
        .schema("growth")
        .from("inbox_threads")
        .select("id, subject, classification")
        .eq("lead_id", leadId)
        .gte("updated_at", since)
        .limit(20),
      admin
        .schema("growth")
        .from("inbox_reply_drafts")
        .select("draft_body, classification, status")
        .eq("lead_id", leadId)
        .gte("created_at", since)
        .limit(20),
      admin
        .schema("growth")
        .from("opportunity_signals")
        .select("signal_type, evidence_snippet, confidence")
        .eq("lead_id", leadId)
        .gte("detected_at", since)
        .limit(20),
      admin
        .schema("growth")
        .from("booking_intent_signals")
        .select("intent_type, evidence_snippet")
        .eq("lead_id", leadId)
        .gte("detected_at", since)
        .limit(20),
      admin.schema("growth").from("engagement_scores").select("tier, replies, meetings").eq("lead_id", leadId).limit(1),
      admin
        .schema("growth")
        .from("meeting_conversion_events")
        .select("title, description")
        .eq("lead_id", leadId)
        .gte("created_at", since)
        .limit(10),
      admin
        .schema("growth")
        .from("buying_committee_signals")
        .select("role_hint, evidence_snippet")
        .eq("lead_id", leadId)
        .gte("detected_at", since)
        .limit(10),
    ])

  const threadIds = ((threads.data ?? []) as Array<{ id?: string }>).map((row) => asString(row.id)).filter(Boolean)
  let messagePreviews: string[] = []
  if (threadIds.length > 0) {
    const { data: messages } = await admin
      .schema("growth")
      .from("inbox_messages")
      .select("body_preview, subject, contains_meeting_language, contains_budget, contains_competitor")
      .in("thread_id", threadIds)
      .gte("message_timestamp", since)
      .order("message_timestamp", { ascending: false })
      .limit(30)
    messagePreviews = ((messages ?? []) as Array<{ body_preview?: string }>).map((row) => asString(row.body_preview))
  }

  for (const row of (threads.data ?? []) as Array<Record<string, unknown>>) {
    const preview = messagePreviews[0] ?? ""
    const combined = `${row.subject ?? ""} ${preview}`
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "inbox",
        subject: asString(row.subject),
        body: preview,
        classification: asString(row.classification),
        meetingIntent: /meeting|call|demo/i.test(combined) || asString(row.classification) === "meeting_intent",
        budgetMention: /budget|price|cost/i.test(combined) || asString(row.classification) === "budget",
        timelineMention: /timeline|quarter|when/i.test(combined) || asString(row.classification) === "timeline",
        committeeMention: /team|committee|stakeholder/i.test(combined),
        competitorMention: /competitor|already using|vendor/i.test(combined) || asString(row.classification) === "competitor",
      }),
    )
  }

  for (const row of (replyDrafts.data ?? []) as Array<Record<string, unknown>>) {
    if (asString(row.status) === "discarded") continue
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "ai_reply_draft",
        body: asString(row.draft_body),
        signalType: asString(row.classification),
        classification: asString(row.classification),
      }),
    )
  }

  for (const row of (oppSignals.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "opportunity_intelligence",
        body: asString(row.evidence_snippet),
        signalType: asString(row.signal_type),
        meetingIntent: asString(row.signal_type) === "meeting_interest",
        budgetMention: asString(row.signal_type) === "budget_signal",
        committeeMention: asString(row.signal_type) === "committee_detected",
        competitorMention: asString(row.signal_type) === "competitive_signal",
      }),
    )
  }

  for (const row of (bookingSignals.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "booking_intelligence",
        body: asString(row.evidence_snippet),
        signalType: asString(row.intent_type),
        meetingIntent: true,
      }),
    )
  }

  for (const row of (committeeSignals.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "committee_signals",
        body: asString(row.evidence_snippet),
        signalType: asString(row.role_hint),
        committeeMention: true,
      }),
    )
  }

  const engagement = (engagementRows.data ?? []) as Array<{ tier?: string; replies?: number; meetings?: number }>
  if (engagement.some((row) => asString(row.tier) === "engaged" || asString(row.tier) === "hot" || asNumber(row.replies) >= 2)) {
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "engagement",
        body: "Elevated reply engagement detected.",
        engagementTier: "engaged",
      }),
    )
  }

  for (const row of (meetings.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "meeting_conversion",
        subject: asString(row.title),
        body: asString(row.description),
        meetingIntent: true,
      }),
    )
  }

  const { data: leadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("engagement_tier, contact_temperature, relationship_summary")
    .eq("id", leadId)
    .maybeSingle()
  if (leadRow) {
    candidates.push(
      ...ingestMemoryCandidatesFromSource({
        sourceSystem: "lead_cache",
        body: asString((leadRow as { relationship_summary?: string }).relationship_summary),
        engagementTier: asString((leadRow as { engagement_tier?: string }).engagement_tier),
      }),
    )
  }

  return candidates.filter((candidate) => hasMinimumMemoryEvidence(candidate.evidenceSnippet))
}

async function upsertMemoryEvent(
  admin: SupabaseClient,
  leadId: string,
  leadLabel: string,
  candidate: IngestedMemoryCandidate,
): Promise<void> {
  const fingerprint = `${candidate.memoryCategory}:${candidate.title}:${candidate.evidenceSnippet.slice(0, 80)}`
  const { data: existing } = await eventsTable(admin)
    .select("id")
    .eq("lead_id", leadId)
    .eq("title", candidate.title)
    .eq("memory_category", candidate.memoryCategory)
    .limit(1)
    .maybeSingle()
  if (existing) return

  await eventsTable(admin).insert({
    lead_id: leadId,
    lead_label: leadLabel,
    memory_category: candidate.memoryCategory,
    confidence: candidate.confidence,
    title: candidate.title,
    evidence_snippet: candidate.evidenceSnippet,
    source_system: candidate.sourceSystem,
    metadata: { fingerprint },
  })
}

async function upsertObjectionFromCandidate(
  admin: SupabaseClient,
  leadId: string,
  leadLabel: string,
  candidate: IngestedMemoryCandidate,
): Promise<void> {
  const mapped = mapCandidateToObjection(candidate)
  if (!mapped) return
  const { data: existing } = await objectionsTable(admin)
    .select("id, occurrence_count, confidence")
    .eq("lead_id", leadId)
    .eq("objection_type", mapped.objectionType)
    .eq("resolved", false)
    .maybeSingle()
  const now = new Date().toISOString()
  if (existing) {
    await objectionsTable(admin)
      .update({
        occurrence_count: asNumber((existing as { occurrence_count?: number }).occurrence_count, 1) + 1,
        evidence_snippet: mapped.evidenceSnippet,
        last_seen_at: now,
        updated_at: now,
      })
      .eq("id", asString((existing as { id?: string }).id))
    return
  }
  await objectionsTable(admin).insert({
    lead_id: leadId,
    lead_label: leadLabel,
    objection_type: mapped.objectionType,
    objection_label: mapped.objectionLabel,
    severity: mapped.severity,
    confidence: mapped.confidence,
    evidence_snippet: mapped.evidenceSnippet,
    source_system: candidate.sourceSystem,
    last_seen_at: now,
    updated_at: now,
  })
}

async function upsertPreferenceFromCandidate(
  admin: SupabaseClient,
  leadId: string,
  leadLabel: string,
  candidate: IngestedMemoryCandidate,
): Promise<void> {
  const mapped = mapCandidateToPreference(candidate)
  if (!mapped) return
  const { data: existing } = await preferencesTable(admin)
    .select("id")
    .eq("lead_id", leadId)
    .eq("preference_type", mapped.preferenceType)
    .eq("preference_key", mapped.preferenceKey)
    .maybeSingle()
  const now = new Date().toISOString()
  if (existing) {
    await preferencesTable(admin)
      .update({
        preference_value: mapped.preferenceValue,
        evidence_snippet: mapped.evidenceSnippet,
        confidence: mapped.confidence,
        updated_at: now,
      })
      .eq("id", asString((existing as { id?: string }).id))
    return
  }
  await preferencesTable(admin).insert({
    lead_id: leadId,
    lead_label: leadLabel,
    preference_type: mapped.preferenceType,
    preference_key: mapped.preferenceKey,
    preference_value: mapped.preferenceValue,
    confidence: mapped.confidence,
    evidence_snippet: mapped.evidenceSnippet,
    source_system: candidate.sourceSystem,
    updated_at: now,
  })
}

async function upsertCommitteeFromCandidate(
  admin: SupabaseClient,
  leadId: string,
  leadLabel: string,
  candidate: IngestedMemoryCandidate,
): Promise<void> {
  if (candidate.memoryCategory !== "committee_member") return
  const memberLabel = "Committee contact"
  const { data: existing } = await committeeTable(admin)
    .select("id")
    .eq("lead_id", leadId)
    .eq("member_label", memberLabel)
    .maybeSingle()
  if (existing) return
  await committeeTable(admin).insert({
    lead_id: leadId,
    lead_label: leadLabel,
    member_label: memberLabel,
    role_hint: "stakeholder",
    influence_level: "medium",
    confidence: candidate.confidence,
    evidence_snippet: candidate.evidenceSnippet,
    source_system: candidate.sourceSystem,
  })
}

export async function rebuildLeadMemoryProfile(
  admin: SupabaseClient,
  leadId: string,
  actorUserId?: string | null,
): Promise<GrowthLeadMemoryProfileView> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) throw new Error("lead_not_found")
  const leadLabel = maskLeadMemoryLabel(leadId, lead.companyName)

  const candidates = await collectSourceCandidates(admin, leadId)
  for (const candidate of candidates) {
    await upsertMemoryEvent(admin, leadId, leadLabel, candidate)
    if (candidate.memoryCategory === "objection") {
      await upsertObjectionFromCandidate(admin, leadId, leadLabel, candidate)
    }
    const prefCandidate =
      candidate.memoryCategory === "communication_preference" ||
      candidate.memoryCategory === "budget_signal" ||
      candidate.memoryCategory === "timeline_signal" ||
      candidate.memoryCategory === "meeting_signal"
        ? candidate
        : null
    if (prefCandidate) await upsertPreferenceFromCandidate(admin, leadId, leadLabel, prefCandidate)
    if (candidate.memoryCategory === "committee_member") {
      await upsertCommitteeFromCandidate(admin, leadId, leadLabel, candidate)
    }
  }

  const [events, objections, preferences, committeeMembers] = await Promise.all([
    listLeadMemoryEvents(admin, leadId, 100),
    listLeadObjections(admin, leadId),
    listLeadPreferences(admin, leadId),
    listCommitteeMembers(admin, leadId),
  ])

  const relationshipStage = inferRelationshipStage({
    events: events.map((event) => ({
      memoryCategory: event.memoryCategory,
      confidence: event.confidence,
    })),
    engagementTier: lead.engagementTier ?? undefined,
    isInactive: lead.contactTemperature === "suppressed",
  })

  const categoryCount = new Set(events.map((event) => event.memoryCategory)).size
  const buyingSignalCount = events.filter((event) => event.memoryCategory === "buying_signal").length
  const highestConfidence = aggregateHighestConfidence(events)
  const memoryCoverageScore = computeMemoryCoverageScore({
    eventCount: events.length,
    objectionCount: objections.length,
    preferenceCount: preferences.length,
    committeeCount: committeeMembers.length,
    categoryCount,
  })

  const summary = buildRelationshipSummary({
    leadLabel,
    relationshipStage,
    memoryCoverageScore,
    topObjections: rankObjections(objections),
    topPreferences: rankPreferences(preferences),
    committeeMembers,
    eventCount: events.length,
  })

  const now = new Date().toISOString()
  const profilePayload = {
    lead_id: leadId,
    lead_label: leadLabel,
    relationship_stage: relationshipStage,
    memory_coverage_score: memoryCoverageScore,
    event_count: events.length,
    objection_count: objections.length,
    preference_count: preferences.length,
    committee_member_count: committeeMembers.length,
    buying_signal_count: buyingSignalCount,
    highest_confidence: highestConfidence,
    summary,
    last_rebuilt_at: now,
    updated_at: now,
    metadata: { rebuilt_by: actorUserId ?? null },
  }

  const { data: existingProfile } = await profilesTable(admin).select("id, relationship_stage").eq("lead_id", leadId).maybeSingle()
  if (existingProfile) {
    await profilesTable(admin).update(profilePayload).eq("lead_id", leadId)
    if (asString((existingProfile as { relationship_stage?: string }).relationship_stage) !== relationshipStage) {
      await appendLeadMemoryTimelineEvent(admin, {
        eventType: "relationship_stage_changed",
        title: "Relationship stage changed",
        summary: `${leadLabel}: ${relationshipStage}`,
        leadId,
      })
    }
  } else {
    await profilesTable(admin).insert(profilePayload)
  }

  const progressionScore = computeProgressionScore({
    eventCount: events.length,
    buyingSignalCount,
    committeeCount: committeeMembers.length,
    highestConfidence,
    relationshipStage,
  })

  const engagementTrend = computeEngagementTrend({
    recentEventCount: events.filter((event) => Date.now() - new Date(event.recordedAt).getTime() < 14 * 86400000).length,
    priorEventCount: events.filter((event) => {
      const age = Date.now() - new Date(event.recordedAt).getTime()
      return age >= 14 * 86400000 && age < 45 * 86400000
    }).length,
    hasRiskSignals: events.some((event) => event.memoryCategory === "risk_signal"),
  })

  const relationshipPayload = {
    lead_id: leadId,
    lead_label: leadLabel,
    account_label: leadLabel,
    relationship_stage: relationshipStage,
    progression_score: progressionScore,
    engagement_trend: engagementTrend,
    top_signals: extractTopSignals(events),
    risk_flags: extractRiskFlags(events),
    updated_at: now,
  }

  const { data: existingRelationship } = await relationshipTable(admin).select("id").eq("lead_id", leadId).maybeSingle()
  if (existingRelationship) {
    await relationshipTable(admin).update(relationshipPayload).eq("lead_id", leadId)
  } else {
    await relationshipTable(admin).insert(relationshipPayload)
  }

  await snapshotsTable(admin).insert({
    lead_id: leadId,
    lead_label: leadLabel,
    relationship_stage: relationshipStage,
    summary,
    memory_coverage_score: memoryCoverageScore,
    objection_highlights: buildSummaryHighlights(objections),
    preference_highlights: buildSummaryHighlights(preferences),
    committee_highlights: buildSummaryHighlights(committeeMembers),
  })

  await appendLeadMemoryTimelineEvent(admin, {
    eventType: "lead_memory_rebuilt",
    title: "Lead memory rebuilt",
    summary: leadLabel,
    leadId,
    metadata: { event_count: events.length },
  })

  return fetchLeadMemoryProfileView(admin, leadId)
}

export async function listLeadMemoryProfiles(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthLeadMemoryProfile[]> {
  let query = profilesTable(admin).select("*").order("updated_at", { ascending: false })
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapProfile)
}

export async function listLeadMemoryEvents(
  admin: SupabaseClient,
  leadId?: string,
  limit = 50,
): Promise<GrowthLeadMemoryEvent[]> {
  let query = eventsTable(admin).select("*").order("recorded_at", { ascending: false }).limit(limit)
  if (leadId) query = query.eq("lead_id", leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapEvent)
}

async function listLeadObjections(admin: SupabaseClient, leadId: string): Promise<GrowthLeadObjectionMemory[]> {
  const { data, error } = await objectionsTable(admin)
    .select("*")
    .eq("lead_id", leadId)
    .order("last_seen_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapObjection)
}

async function listLeadPreferences(admin: SupabaseClient, leadId: string): Promise<GrowthLeadPreferenceMemory[]> {
  const { data, error } = await preferencesTable(admin)
    .select("*")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapPreference)
}

async function listCommitteeMembers(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthCommitteeRelationshipContext[]> {
  const { data, error } = await committeeTable(admin).select("*").eq("lead_id", leadId).order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapCommittee)
}

export async function fetchLeadMemoryProfileView(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadMemoryProfileView> {
  const [profileRow, relationshipRow, events, objections, preferences, committeeMembers, snapshots] = await Promise.all([
    profilesTable(admin).select("*").eq("lead_id", leadId).maybeSingle(),
    relationshipTable(admin).select("*").eq("lead_id", leadId).maybeSingle(),
    listLeadMemoryEvents(admin, leadId, 50),
    listLeadObjections(admin, leadId),
    listLeadPreferences(admin, leadId),
    listCommitteeMembers(admin, leadId),
    snapshotsTable(admin).select("*").eq("lead_id", leadId).order("recorded_at", { ascending: false }).limit(10),
  ])

  return {
    profile: profileRow ? mapProfile(profileRow as Record<string, unknown>) : null,
    relationshipContext: relationshipRow ? mapRelationship(relationshipRow as Record<string, unknown>) : null,
    events,
    objections: rankObjections(objections),
    preferences: rankPreferences(preferences),
    committeeMembers,
    summarySnapshots: ((snapshots.data ?? []) as Record<string, unknown>[]).map(mapSnapshot),
  }
}

export async function fetchGrowthLeadMemoryDashboard(
  admin: SupabaseClient,
): Promise<GrowthLeadMemoryDashboard> {
  const [profiles, recentEvents, objections, preferences] = await Promise.all([
    listLeadMemoryProfiles(admin, { limit: 100 }),
    listLeadMemoryEvents(admin, undefined, 40),
    admin.schema("growth").from("lead_objection_memory").select("*").eq("resolved", false).order("last_seen_at", { ascending: false }).limit(20),
    admin.schema("growth").from("lead_preference_memory").select("*").order("updated_at", { ascending: false }).limit(20),
  ])

  const objectionRows = rankObjections(((objections.data ?? []) as Record<string, unknown>[]).map(mapObjection))
  const preferenceRows = rankPreferences(((preferences.data ?? []) as Record<string, unknown>[]).map(mapPreference))

  const avgCoverage =
    profiles.length > 0
      ? Math.round(profiles.reduce((sum, profile) => sum + profile.memoryCoverageScore, 0) / profiles.length)
      : 0

  const committeeCoverage =
    profiles.length > 0
      ? Math.round(
          (profiles.filter((profile) => profile.committeeMemberCount > 0).length / profiles.length) * 100,
        )
      : 0

  return {
    qa_marker: GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER,
    memoryCoverage: avgCoverage,
    relationshipStages: stageDistribution(profiles),
    committeeCoverage,
    buyingSignals: profiles.reduce((sum, profile) => sum + profile.buyingSignalCount, 0),
    topObjections: objectionRows.slice(0, 10),
    communicationPreferences: preferenceRows.filter((pref) => pref.preferenceType === "communication_preference").slice(0, 10),
    profiles,
    recentEvents,
  }
}

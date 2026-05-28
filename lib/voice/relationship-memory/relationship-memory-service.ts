import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { aggregateProfileMetrics } from "@/lib/voice/relationship-memory/aggregation"
import { isDuplicateMemoryEvent } from "@/lib/voice/relationship-memory/deduplication"
import { mapDraftKindToMemoryType, normalizePhoneForMemoryProfile } from "@/lib/voice/relationship-memory/draft-mapping"
import { computeHighRiskScore, rankRelationshipInsights } from "@/lib/voice/relationship-memory/prioritization"
import { buildRelationshipTimeline } from "@/lib/voice/relationship-memory/timeline"
import {
  RELATIONSHIP_MEMORY_EVENTS_WINDOW,
  RELATIONSHIP_MEMORY_INSIGHTS_LIMIT,
  RELATIONSHIP_MEMORY_MIN_CONFIDENCE,
  RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
  VOICE_RELATIONSHIP_MEMORY_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_RELATIONSHIP_MEMORY_PASSIVE_MODE_ENABLED,
  VOICE_RELATIONSHIP_MEMORY_QA_MARKER,
  type VoiceRelationshipMemoryInsightsSnapshot,
  type VoiceRelationshipMemoryReadinessSnapshot,
  type VoiceRelationshipMemoryWorkspaceSnapshot,
  type VoiceRelationshipTimelineItem,
} from "@/lib/voice/relationship-memory/types"
import {
  countMemoryDraftsByStatus,
  countPendingDraftsForCall,
  createRelationshipMemoryProfile,
  findRelationshipMemoryProfileByPhone,
  getMemoryDraftById,
  getRelationshipMemoryProfile,
  insertRelationshipMemoryEvent,
  listCallsForPhoneProfile,
  listRelationshipMemoryEvents,
  listRelationshipMemoryProfiles,
  refreshRelationshipMemoryProfileRollup,
  resolveRelationshipMemoryProfile,
  updateMemoryDraftReview,
} from "@/lib/voice/repository/voice-relationship-memory-repository"

async function recomputeProfileRollup(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
): Promise<void> {
  const profile = await getRelationshipMemoryProfile(admin, organizationId, profileId)
  if (!profile) return

  const events = await listRelationshipMemoryEvents(admin, organizationId, profileId, RELATIONSHIP_MEMORY_EVENTS_WINDOW)
  const calls = profile.primaryPhoneNumber
    ? await listCallsForPhoneProfile(admin, organizationId, profile.primaryPhoneNumber, 20)
    : []

  const metrics = aggregateProfileMetrics({
    events,
    callCount: Math.max(profile.totalCallCount, calls.length),
    totalTalkTimeSeconds: Math.max(
      profile.totalTalkTimeSeconds,
      calls.reduce((sum, call) => sum + call.durationSeconds, 0),
    ),
    firstInteractionAt: profile.firstInteractionAt,
    lastInteractionAt: profile.lastInteractionAt,
  })

  await refreshRelationshipMemoryProfileRollup(admin, {
    organizationId,
    profileId,
    metrics: {
      ...metrics,
      totalCallCount: Math.max(profile.totalCallCount, calls.length),
      totalTalkTimeSeconds: Math.max(
        profile.totalTalkTimeSeconds,
        calls.reduce((sum, call) => sum + call.durationSeconds, 0),
      ),
      lastInteractionAt: profile.lastInteractionAt ?? calls[0]?.startedAt ?? null,
    },
  })
}

export async function reviewVoiceMemoryDraft(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    draftId: string
    action: "accept" | "reject" | "merge"
    operatorNotes?: string | null
    primaryPhoneNumber?: string | null
    primaryContactName?: string | null
    leadId?: string | null
  },
): Promise<{ draftStatus: string; memoryEventId: string | null; profileId: string | null }> {
  const draft = await getMemoryDraftById(admin, input.organizationId, input.draftId)
  if (!draft) throw new Error("Memory draft not found.")
  if (draft.status !== "pending_review") throw new Error("Draft already reviewed.")

  if (draft.confidenceScore < RELATIONSHIP_MEMORY_MIN_CONFIDENCE && input.action !== "reject") {
    throw new Error("Confidence below threshold — reject or gather more evidence.")
  }

  if (input.action === "reject") {
    await updateMemoryDraftReview(admin, {
      organizationId: input.organizationId,
      draftId: input.draftId,
      status: "rejected",
      reviewedByUserId: input.userId,
      operatorNotes: input.operatorNotes,
    })
    return { draftStatus: "rejected", memoryEventId: null, profileId: null }
  }

  const { data: callRow } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("from_number, to_number, related_customer_id, related_prospect_id, metadata_json")
    .eq("id", draft.voiceCallId)
    .maybeSingle()

  const phone =
    normalizePhoneForMemoryProfile(input.primaryPhoneNumber) ||
    normalizePhoneForMemoryProfile(callRow?.to_number as string) ||
    normalizePhoneForMemoryProfile(callRow?.from_number as string)

  if (!phone) throw new Error("Cannot resolve relationship profile without a phone number.")

  const profile = await resolveRelationshipMemoryProfile(admin, {
    organizationId: input.organizationId,
    primaryPhoneNumber: phone,
    primaryContactName: input.primaryContactName,
    relatedCustomerId: (callRow?.related_customer_id as string | null) ?? null,
    relatedProspectId: (callRow?.related_prospect_id as string | null) ?? null,
    leadId: input.leadId ?? null,
  })

  const existingEvents = await listRelationshipMemoryEvents(admin, input.organizationId, profile.id, 50)
  const memoryType = mapDraftKindToMemoryType(draft.draftKind, draft.draftLabel)

  if (input.action === "merge" && isDuplicateMemoryEvent(existingEvents, { memoryType, evidenceText: draft.evidenceText })) {
    await updateMemoryDraftReview(admin, {
      organizationId: input.organizationId,
      draftId: input.draftId,
      status: "accepted",
      reviewedByUserId: input.userId,
      operatorNotes: input.operatorNotes ?? "Merged with existing memory (duplicate evidence).",
    })
    await recomputeProfileRollup(admin, input.organizationId, profile.id)
    return { draftStatus: "accepted", memoryEventId: null, profileId: profile.id }
  }

  if (isDuplicateMemoryEvent(existingEvents, { memoryType, evidenceText: draft.evidenceText })) {
    throw new Error("Duplicate memory evidence already on profile. Use merge action.")
  }

  const memoryEvent = await insertRelationshipMemoryEvent(admin, {
    organizationId: input.organizationId,
    memoryProfileId: profile.id,
    memoryType,
    evidenceText: draft.evidenceText,
    confidenceScore: draft.confidenceScore,
    sourceVoiceCallId: draft.voiceCallId,
    sourceTranscriptSegmentId: draft.transcriptSegmentId,
    createdBySource: input.action === "merge" ? "draft_merge" : "draft_accept",
  })

  await updateMemoryDraftReview(admin, {
    organizationId: input.organizationId,
    draftId: input.draftId,
    status: "accepted",
    reviewedByUserId: input.userId,
    operatorNotes: input.operatorNotes,
    mergedMemoryEventId: memoryEvent.id,
  })

  await recomputeProfileRollup(admin, input.organizationId, profile.id)
  return { draftStatus: "accepted", memoryEventId: memoryEvent.id, profileId: profile.id }
}

export async function fetchRelationshipMemoryWorkspaceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber?: string | null
    leadId?: string | null
    contactName?: string | null
    activeVoiceCallId?: string | null
  },
): Promise<VoiceRelationshipMemoryWorkspaceSnapshot | null> {
  const phone = normalizePhoneForMemoryProfile(input.phoneNumber)
  if (!phone) return null

  const calls = await listCallsForPhoneProfile(admin, input.organizationId, phone, 12)
  let profile = await findRelationshipMemoryProfileByPhone(admin, input.organizationId, phone)
  if (!profile && calls.length > 0) {
    profile = await createRelationshipMemoryProfile(admin, {
      organizationId: input.organizationId,
      primaryPhoneNumber: phone,
      primaryContactName: input.contactName,
      metadataJson: input.leadId ? { leadId: input.leadId } : {},
    })
    profile = await refreshRelationshipMemoryProfileRollup(admin, {
      organizationId: input.organizationId,
      profileId: profile.id,
      metrics: {
        ...aggregateProfileMetrics({
          events: [],
          callCount: calls.length,
          totalTalkTimeSeconds: calls.reduce((sum, call) => sum + call.durationSeconds, 0),
          firstInteractionAt: calls[calls.length - 1]?.startedAt ?? null,
          lastInteractionAt: calls[0]?.startedAt ?? null,
        }),
        totalCallCount: calls.length,
        totalTalkTimeSeconds: calls.reduce((sum, call) => sum + call.durationSeconds, 0),
        lastInteractionAt: calls[0]?.startedAt ?? null,
      },
    })
  }

  if (!profile) {
    return {
      qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER,
      profile: null,
      timeline: buildRelationshipTimeline({ memoryEvents: [], callSummaries: calls, limit: RELATIONSHIP_MEMORY_TIMELINE_WINDOW }),
      priorObjections: [],
      priorBuyingSignals: [],
      decisionMakers: [],
      followUpPreferences: [],
      escalationHistory: [],
      prioritizedInsights: [],
      pendingDraftCount: input.activeVoiceCallId
        ? await countPendingDraftsForCall(admin, input.organizationId, input.activeVoiceCallId)
        : 0,
      teamVisibilityMessage:
        "Shared org-scoped relationship memory — prior operator interactions visible to your team. No hidden AI-only memory.",
      windowed: true,
      timelineLimit: RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
      eventsLimit: RELATIONSHIP_MEMORY_EVENTS_WINDOW,
    }
  }

  const events = await listRelationshipMemoryEvents(
    admin,
    input.organizationId,
    profile.id,
    RELATIONSHIP_MEMORY_EVENTS_WINDOW,
  )
  profile = (await getRelationshipMemoryProfile(admin, input.organizationId, profile.id)) ?? profile

  const priorObjections = events.filter((event) =>
    ["pricing_objection", "competitor_mention", "budget_concern"].includes(event.memoryType),
  )
  const priorBuyingSignals = events.filter((event) =>
    ["booking_interest", "urgency_signal"].includes(event.memoryType),
  )
  const decisionMakers = events.filter((event) => event.memoryType === "decision_maker")
  const followUpPreferences = events.filter((event) =>
    ["callback_preference", "follow_up_request", "scheduling_preference", "preferred_channel"].includes(
      event.memoryType,
    ),
  )
  const escalationHistory = events.filter((event) =>
    ["escalation_pattern", "cancellation_risk", "negative_sentiment"].includes(event.memoryType),
  )

  const timeline = buildRelationshipTimeline({
    memoryEvents: events,
    callSummaries: calls,
    limit: RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
  })

  const pendingDraftCount = input.activeVoiceCallId
    ? await countPendingDraftsForCall(admin, input.organizationId, input.activeVoiceCallId)
    : 0

  return {
    qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER,
    profile,
    timeline,
    priorObjections: priorObjections.slice(0, 6),
    priorBuyingSignals: priorBuyingSignals.slice(0, 6),
    decisionMakers: decisionMakers.slice(0, 4),
    followUpPreferences: followUpPreferences.slice(0, 4),
    escalationHistory: escalationHistory.slice(0, 4),
    prioritizedInsights: rankRelationshipInsights(events, profile, RELATIONSHIP_MEMORY_INSIGHTS_LIMIT),
    pendingDraftCount,
    teamVisibilityMessage:
      "Shared org-scoped relationship memory — prior operator interactions visible to your team. No hidden AI-only memory.",
    windowed: true,
    timelineLimit: RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
    eventsLimit: RELATIONSHIP_MEMORY_EVENTS_WINDOW,
  }
}

export async function fetchRelationshipTimelineSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
  limit = RELATIONSHIP_MEMORY_TIMELINE_WINDOW,
): Promise<{ profileId: string; timeline: VoiceRelationshipTimelineItem[] } | null> {
  const profile = await getRelationshipMemoryProfile(admin, organizationId, profileId)
  if (!profile) return null

  const [events, calls] = await Promise.all([
    listRelationshipMemoryEvents(admin, organizationId, profileId, RELATIONSHIP_MEMORY_EVENTS_WINDOW),
    profile.primaryPhoneNumber
      ? listCallsForPhoneProfile(admin, organizationId, profile.primaryPhoneNumber, 12)
      : Promise.resolve([]),
  ])

  return {
    profileId,
    timeline: buildRelationshipTimeline({ memoryEvents: events, callSummaries: calls, limit }),
  }
}

export async function fetchRelationshipInsightsSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
): Promise<VoiceRelationshipMemoryInsightsSnapshot | null> {
  const profile = await getRelationshipMemoryProfile(admin, organizationId, profileId)
  if (!profile) return null

  const events = await listRelationshipMemoryEvents(admin, organizationId, profileId, RELATIONSHIP_MEMORY_EVENTS_WINDOW)
  const insights = rankRelationshipInsights(events, profile, RELATIONSHIP_MEMORY_INSIGHTS_LIMIT)
  const unresolvedObjectionCount = events.filter(
    (event) =>
      event.eventStatus === "active" &&
      ["pricing_objection", "competitor_mention", "budget_concern", "cancellation_risk"].includes(event.memoryType),
  ).length

  return {
    qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER,
    profileId,
    insights,
    unresolvedObjectionCount,
    highRiskScore: computeHighRiskScore(profile, events),
  }
}

export async function searchRelationshipMemoryProfiles(
  admin: SupabaseClient,
  organizationId: string,
  query?: string,
) {
  return listRelationshipMemoryProfiles(admin, organizationId, { query, limit: 20 })
}

export async function fetchRelationshipMemoryReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceRelationshipMemoryReadinessSnapshot> {
  let schemaReady = true
  try {
    const { error } = await admin
      .schema("voice")
      .from("voice_relationship_memory_profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1)
    if (error?.code === "42P01") schemaReady = false
  } catch {
    schemaReady = false
  }

  const draftCounts = schemaReady
    ? await countMemoryDraftsByStatus(admin, organizationId)
    : { pending: 0, accepted: 0, rejected: 0 }

  let unresolvedObjectionCount = 0
  if (schemaReady) {
    const { count } = await admin
      .schema("voice")
      .from("voice_relationship_memory_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_status", "active")
      .in("memory_type", ["pricing_objection", "competitor_mention", "budget_concern", "cancellation_risk"])
    unresolvedObjectionCount = count ?? 0
  }

  return {
    qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER,
    schemaReady,
    memoryExtractionStatus: schemaReady ? (draftCounts.pending > 25 ? "degraded" : "ready") : "unavailable",
    draftReviewBacklog: draftCounts.pending,
    acceptedDraftCount: draftCounts.accepted,
    rejectedDraftCount: draftCounts.rejected,
    unresolvedObjectionCount,
    confidenceThreshold: RELATIONSHIP_MEMORY_MIN_CONFIDENCE,
    passiveModeEnabled: VOICE_RELATIONSHIP_MEMORY_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_RELATIONSHIP_MEMORY_AUTONOMOUS_ACTIONS_DISABLED,
    message: schemaReady
      ? "Relationship memory is ready. Operator review required before persistent merge."
      : "Apply Phase 2C migration for relationship memory tables.",
  }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isDuplicateRevenueIntelligenceEvent, isStaleRevenueIntelligenceEvent } from "@/lib/voice/revenue-intelligence/deduplication"
import { generateRevenueIntelligenceEvents, inferPreviousBuyingStageFromEvents } from "@/lib/voice/revenue-intelligence/event-generation"
import { countFollowUpRiskEvents } from "@/lib/voice/revenue-intelligence/follow-up-health"
import { buildRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/snapshot-builder"
import type {
  VoiceRevenueIntelligenceLifecycleAction,
  VoiceRevenueIntelligenceReadinessSnapshot,
  VoiceRevenueIntelligenceWorkspaceSnapshot,
} from "@/lib/voice/revenue-intelligence/types"
import {
  REVENUE_INTELLIGENCE_EVENTS_WINDOW,
  REVENUE_INTELLIGENCE_STALE_DAYS,
  VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_REVENUE_INTELLIGENCE_EVIDENCE_REQUIRED,
  VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  VOICE_REVENUE_INTELLIGENCE_QA_MARKER,
} from "@/lib/voice/revenue-intelligence/types"
import {
  countRevenueIntelligenceEventsByStatus,
  countRevenueIntelligenceEventsWithOpportunityLink,
  expireStaleRevenueIntelligenceEvents,
  insertRevenueIntelligenceEvent,
  listRevenueIntelligenceEvents,
  resolveOpportunityIdForLead,
  resolveOpportunityIdFromVoiceCall,
  updateRevenueIntelligenceEventStatus,
} from "@/lib/voice/repository/voice-revenue-intelligence-repository"
import {
  findRelationshipMemoryProfileByPhone,
  getRelationshipMemoryProfile,
  listRelationshipMemoryEvents,
} from "@/lib/voice/repository/voice-relationship-memory-repository"
import { normalizePhoneForMemoryProfile } from "@/lib/voice/relationship-memory/draft-mapping"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

const LIFECYCLE_STATUS_MAP: Record<VoiceRevenueIntelligenceLifecycleAction, "acknowledged" | "dismissed" | "resolved"> = {
  acknowledge: "acknowledged",
  dismiss: "dismissed",
  resolve: "resolved",
}

async function syncDerivedRevenueEvents(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    relatedCustomerId: string | null
    relatedProspectId: string | null
    relatedOpportunityId: string | null
    memoryEvents: Awaited<ReturnType<typeof listRelationshipMemoryEvents>>
    storedEvents: Awaited<ReturnType<typeof listRevenueIntelligenceEvents>>
    objectionCount: number
    buyingSignalCount: number
    escalationCount: number
    relationshipStatus: string
    lastInteractionAt: string | null
    activeVoiceCallId?: string | null
  },
): Promise<Awaited<ReturnType<typeof listRevenueIntelligenceEvents>>> {
  const staleBefore = new Date(Date.now() - REVENUE_INTELLIGENCE_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await expireStaleRevenueIntelligenceEvents(admin, input.organizationId, staleBefore)

  const previousStage = inferPreviousBuyingStageFromEvents(input.storedEvents)
  const derived = generateRevenueIntelligenceEvents({
    memoryEvents: input.memoryEvents,
    objectionCount: input.objectionCount,
    buyingSignalCount: input.buyingSignalCount,
    escalationCount: input.escalationCount,
    relationshipStatus: input.relationshipStatus,
    lastInteractionAt: input.lastInteractionAt,
    previousBuyingStage: previousStage,
    sourceVoiceCallId: input.activeVoiceCallId,
  })

  for (const candidate of derived) {
    if (
      isDuplicateRevenueIntelligenceEvent(
        input.storedEvents,
        candidate,
        input.profileId,
        input.relatedOpportunityId,
      )
    ) {
      continue
    }
    const inserted = await insertRevenueIntelligenceEvent(admin, {
      organizationId: input.organizationId,
      relatedCustomerId: input.relatedCustomerId,
      relatedProspectId: input.relatedProspectId,
      relatedOpportunityId: input.relatedOpportunityId,
      relationshipMemoryProfileId: input.profileId,
      sourceVoiceCallId: candidate.sourceVoiceCallId,
      sourceMemoryEventId: candidate.sourceMemoryEventId,
      eventType: candidate.eventType,
      buyingStage: candidate.buyingStage,
      momentumDirection: candidate.momentumDirection,
      confidenceScore: candidate.confidenceScore,
      evidenceText: candidate.evidenceText,
      recommendedOperatorAction: candidate.recommendedOperatorAction,
    })
    if (inserted) input.storedEvents.unshift(inserted)
  }

  return listRevenueIntelligenceEvents(admin, input.organizationId, {
    relationshipMemoryProfileId: input.profileId,
    limit: REVENUE_INTELLIGENCE_EVENTS_WINDOW,
  })
}

export async function fetchRevenueIntelligenceWorkspaceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber?: string | null
    leadId?: string | null
    activeVoiceCallId?: string | null
    relationshipMemoryProfileId?: string | null
  },
): Promise<VoiceRevenueIntelligenceWorkspaceSnapshot | null> {
  let profile =
    input.relationshipMemoryProfileId != null
      ? await getRelationshipMemoryProfile(admin, input.organizationId, input.relationshipMemoryProfileId)
      : null

  if (!profile && input.phoneNumber) {
    profile = await findRelationshipMemoryProfileByPhone(
      admin,
      input.organizationId,
      normalizePhoneForMemoryProfile(input.phoneNumber),
    )
  }

  if (!profile) return null

  const relatedOpportunityId =
    (input.leadId ? await resolveOpportunityIdForLead(admin, input.organizationId, input.leadId) : null) ??
    (input.activeVoiceCallId ? await resolveOpportunityIdFromVoiceCall(admin, input.activeVoiceCallId) : null)

  const memoryEvents = await listRelationshipMemoryEvents(
    admin,
    input.organizationId,
    profile.id,
    40,
  )

  let storedEvents = await listRevenueIntelligenceEvents(admin, input.organizationId, {
    relationshipMemoryProfileId: profile.id,
    limit: REVENUE_INTELLIGENCE_EVENTS_WINDOW,
  })

  storedEvents = await syncDerivedRevenueEvents(admin, {
    organizationId: input.organizationId,
    profileId: profile.id,
    relatedCustomerId: profile.relatedCustomerId,
    relatedProspectId: profile.relatedProspectId,
    relatedOpportunityId,
    memoryEvents,
    storedEvents,
    objectionCount: profile.objectionCount,
    buyingSignalCount: profile.buyingSignalCount,
    escalationCount: profile.escalationCount,
    relationshipStatus: profile.relationshipStatus,
    lastInteractionAt: profile.lastInteractionAt,
    activeVoiceCallId: input.activeVoiceCallId,
  })

  return buildRevenueIntelligenceWorkspaceSnapshot({
    relationshipMemoryProfileId: profile.id,
    relatedOpportunityId,
    memoryEvents,
    storedEvents,
    objectionCount: profile.objectionCount,
    buyingSignalCount: profile.buyingSignalCount,
    escalationCount: profile.escalationCount,
    relationshipStatus: profile.relationshipStatus,
    lastInteractionAt: profile.lastInteractionAt,
  })
}

export async function updateRevenueIntelligenceEventLifecycle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventId: string
    action: VoiceRevenueIntelligenceLifecycleAction
  },
): Promise<{ eventId: string; status: string } | null> {
  const status = LIFECYCLE_STATUS_MAP[input.action]
  const updated = await updateRevenueIntelligenceEventStatus(admin, {
    organizationId: input.organizationId,
    eventId: input.eventId,
    status,
  })
  if (!updated) return null
  return { eventId: updated.id, status: updated.status }
}

export async function fetchRevenueIntelligenceReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceRevenueIntelligenceReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const schemaReady = schema.ready && !schema.missingTables.includes("voice_revenue_intelligence_events")

  const relationshipMemoryReady = !schema.missingTables.includes("voice_relationship_memory_profiles")

  const activeEventCount = await countRevenueIntelligenceEventsByStatus(admin, organizationId, "active")
  const { total, linked } = await countRevenueIntelligenceEventsWithOpportunityLink(admin, organizationId)
  const opportunityLinkageCoveragePercent =
    total > 0 ? Math.round((linked / total) * 100) : relationshipMemoryReady ? 0 : 0

  const activeEvents = schemaReady
    ? await listRevenueIntelligenceEvents(admin, organizationId, { limit: REVENUE_INTELLIGENCE_EVENTS_WINDOW })
    : []

  const unresolvedRiskCount = activeEvents.filter((event) =>
    ["deal_risk_increased", "budget_objection_active", "competitor_risk_active", "renewal_risk"].includes(
      event.eventType,
    ),
  ).length

  const followUpRiskCount = activeEvents.filter((event) => event.eventType === "follow_up_overdue").length

  return {
    qaMarker: VOICE_REVENUE_INTELLIGENCE_QA_MARKER,
    schemaReady,
    passiveModeEnabled: VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
    evidenceRequirementEnabled: VOICE_REVENUE_INTELLIGENCE_EVIDENCE_REQUIRED,
    relationshipMemoryDependencyReady: relationshipMemoryReady,
    opportunityLinkageCoveragePercent,
    unresolvedRiskCount,
    followUpRiskCount: followUpRiskCount + (activeEvents.length ? 0 : 0),
    activeEventCount,
    message: schemaReady
      ? relationshipMemoryReady
        ? "Revenue intelligence is passive and evidence-backed. Operators control all revenue actions."
        : "Apply relationship memory migration (Phase 2C) for full revenue intelligence coverage."
      : `Apply migration for voice revenue intelligence — ${schema.message}`,
  }
}

export function countActiveFollowUpRisk(snapshot: VoiceRevenueIntelligenceWorkspaceSnapshot): number {
  return countFollowUpRiskEvents(snapshot.followUpHealth)
}

export function filterStaleActiveEvents<T extends { createdAt: string; status: string }>(
  events: T[],
  staleDays = REVENUE_INTELLIGENCE_STALE_DAYS,
): T[] {
  return events.filter(
    (event) => event.status !== "active" || !isStaleRevenueIntelligenceEvent(event.createdAt, staleDays),
  )
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listRevenueIntelligenceEvents } from "@/lib/voice/repository/voice-revenue-intelligence-repository"
import {
  countRetentionIntelligenceEventsByStatus,
  expireStaleRetentionIntelligenceEvents,
  insertRetentionIntelligenceEvent,
  listRetentionIntelligenceEvents,
  updateRetentionIntelligenceEventStatus,
} from "@/lib/voice/repository/voice-retention-intelligence-repository"
import {
  findRelationshipMemoryProfileByPhone,
  getRelationshipMemoryProfile,
  listRelationshipMemoryEvents,
} from "@/lib/voice/repository/voice-relationship-memory-repository"
import { normalizePhoneForMemoryProfile } from "@/lib/voice/relationship-memory/draft-mapping"
import { isDuplicateRetentionIntelligenceEvent } from "@/lib/voice/retention-intelligence/deduplication"
import { countChurnRiskEvents } from "@/lib/voice/retention-intelligence/churn-risk"
import { countExpansionSignalEvents } from "@/lib/voice/retention-intelligence/expansion-signals"
import { generateRetentionIntelligenceEvents } from "@/lib/voice/retention-intelligence/event-generation"
import { countUnresolvedIssueEvents } from "@/lib/voice/retention-intelligence/satisfaction-signals"
import { buildRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/snapshot-builder"
import type {
  VoiceRetentionIntelligenceLifecycleAction,
  VoiceRetentionIntelligenceReadinessSnapshot,
  VoiceRetentionIntelligenceWorkspaceSnapshot,
} from "@/lib/voice/retention-intelligence/types"
import {
  RETENTION_INTELLIGENCE_EVENTS_WINDOW,
  RETENTION_INTELLIGENCE_STALE_DAYS,
  VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_RETENTION_INTELLIGENCE_EVIDENCE_REQUIRED,
  VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  VOICE_RETENTION_INTELLIGENCE_QA_MARKER,
} from "@/lib/voice/retention-intelligence/types"
import { REVENUE_INTELLIGENCE_EVENTS_WINDOW } from "@/lib/voice/revenue-intelligence/types"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

const LIFECYCLE_STATUS_MAP: Record<
  VoiceRetentionIntelligenceLifecycleAction,
  "acknowledged" | "dismissed" | "resolved"
> = {
  acknowledge: "acknowledged",
  dismiss: "dismissed",
  resolve: "resolved",
}

async function syncDerivedRetentionEvents(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    relatedCustomerId: string | null
    relatedProspectId: string | null
    relatedOpportunityId: string | null
    memoryEvents: Awaited<ReturnType<typeof listRelationshipMemoryEvents>>
    revenueEvents: Awaited<ReturnType<typeof listRevenueIntelligenceEvents>>
    storedEvents: Awaited<ReturnType<typeof listRetentionIntelligenceEvents>>
    objectionCount: number
    buyingSignalCount: number
    escalationCount: number
    relationshipStatus: string
    sentimentTrend: string
    lastInteractionAt: string | null
    activeVoiceCallId?: string | null
  },
): Promise<Awaited<ReturnType<typeof listRetentionIntelligenceEvents>>> {
  const staleBefore = new Date(Date.now() - RETENTION_INTELLIGENCE_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await expireStaleRetentionIntelligenceEvents(admin, input.organizationId, staleBefore)

  const derived = generateRetentionIntelligenceEvents({
    memoryEvents: input.memoryEvents,
    revenueEvents: input.revenueEvents,
    objectionCount: input.objectionCount,
    buyingSignalCount: input.buyingSignalCount,
    escalationCount: input.escalationCount,
    relationshipStatus: input.relationshipStatus,
    sentimentTrend: input.sentimentTrend,
    lastInteractionAt: input.lastInteractionAt,
    sourceVoiceCallId: input.activeVoiceCallId,
  })

  for (const candidate of derived) {
    if (
      isDuplicateRetentionIntelligenceEvent(
        input.storedEvents,
        candidate,
        input.profileId,
        input.relatedCustomerId,
      )
    ) {
      continue
    }
    const inserted = await insertRetentionIntelligenceEvent(admin, {
      organizationId: input.organizationId,
      relatedCustomerId: input.relatedCustomerId,
      relatedProspectId: input.relatedProspectId,
      relatedOpportunityId: input.relatedOpportunityId,
      relationshipMemoryProfileId: input.profileId,
      sourceVoiceCallId: candidate.sourceVoiceCallId,
      sourceMemoryEventId: candidate.sourceMemoryEventId,
      sourceRevenueEventId: candidate.sourceRevenueEventId,
      eventType: candidate.eventType,
      healthDirection: candidate.healthDirection,
      confidenceScore: candidate.confidenceScore,
      evidenceText: candidate.evidenceText,
      recommendedOperatorAction: candidate.recommendedOperatorAction,
    })
    if (inserted) input.storedEvents.unshift(inserted)
  }

  return listRetentionIntelligenceEvents(admin, input.organizationId, {
    relationshipMemoryProfileId: input.profileId,
    limit: RETENTION_INTELLIGENCE_EVENTS_WINDOW,
  })
}

export async function fetchRetentionIntelligenceWorkspaceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber?: string | null
    leadId?: string | null
    activeVoiceCallId?: string | null
    relationshipMemoryProfileId?: string | null
    revenueEvents?: Awaited<ReturnType<typeof listRevenueIntelligenceEvents>>
  },
): Promise<VoiceRetentionIntelligenceWorkspaceSnapshot | null> {
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

  const memoryEvents = await listRelationshipMemoryEvents(admin, input.organizationId, profile.id, 40)
  const revenueEvents =
    input.revenueEvents ??
    (await listRevenueIntelligenceEvents(admin, input.organizationId, {
      relationshipMemoryProfileId: profile.id,
      limit: REVENUE_INTELLIGENCE_EVENTS_WINDOW,
    }))

  let storedEvents = await listRetentionIntelligenceEvents(admin, input.organizationId, {
    relationshipMemoryProfileId: profile.id,
    limit: RETENTION_INTELLIGENCE_EVENTS_WINDOW,
  })

  storedEvents = await syncDerivedRetentionEvents(admin, {
    organizationId: input.organizationId,
    profileId: profile.id,
    relatedCustomerId: profile.relatedCustomerId,
    relatedProspectId: profile.relatedProspectId,
    relatedOpportunityId: null,
    memoryEvents,
    revenueEvents,
    storedEvents,
    objectionCount: profile.objectionCount,
    buyingSignalCount: profile.buyingSignalCount,
    escalationCount: profile.escalationCount,
    relationshipStatus: profile.relationshipStatus,
    sentimentTrend: profile.sentimentTrend,
    lastInteractionAt: profile.lastInteractionAt,
    activeVoiceCallId: input.activeVoiceCallId,
  })

  return buildRetentionIntelligenceWorkspaceSnapshot({
    relationshipMemoryProfileId: profile.id,
    relatedCustomerId: profile.relatedCustomerId,
    memoryEvents,
    revenueEvents,
    storedEvents,
    objectionCount: profile.objectionCount,
    buyingSignalCount: profile.buyingSignalCount,
    escalationCount: profile.escalationCount,
    relationshipStatus: profile.relationshipStatus,
    sentimentTrend: profile.sentimentTrend,
    lastInteractionAt: profile.lastInteractionAt,
  })
}

export async function updateRetentionIntelligenceEventLifecycle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventId: string
    action: VoiceRetentionIntelligenceLifecycleAction
  },
): Promise<{ eventId: string; status: string } | null> {
  const status = LIFECYCLE_STATUS_MAP[input.action]
  const updated = await updateRetentionIntelligenceEventStatus(admin, {
    organizationId: input.organizationId,
    eventId: input.eventId,
    status,
  })
  if (!updated) return null
  return { eventId: updated.id, status: updated.status }
}

export async function fetchRetentionIntelligenceReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceRetentionIntelligenceReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const schemaReady = schema.ready && !schema.missingTables.includes("voice_retention_intelligence_events")
  const relationshipMemoryReady = !schema.missingTables.includes("voice_relationship_memory_profiles")
  const revenueIntelligenceReady = !schema.missingTables.includes("voice_revenue_intelligence_events")

  const activeEventCount = await countRetentionIntelligenceEventsByStatus(admin, organizationId, "active")
  const activeEvents = schemaReady
    ? await listRetentionIntelligenceEvents(admin, organizationId, { limit: RETENTION_INTELLIGENCE_EVENTS_WINDOW })
    : []

  const eventTypes = activeEvents.map((event) => event.eventType)

  return {
    qaMarker: VOICE_RETENTION_INTELLIGENCE_QA_MARKER,
    schemaReady,
    passiveModeEnabled: VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
    evidenceRequirementEnabled: VOICE_RETENTION_INTELLIGENCE_EVIDENCE_REQUIRED,
    relationshipMemoryDependencyReady: relationshipMemoryReady,
    revenueIntelligenceDependencyReady: revenueIntelligenceReady,
    unresolvedIssueCount: countUnresolvedIssueEvents(eventTypes),
    churnRiskCount: countChurnRiskEvents(eventTypes),
    expansionSignalCount: countExpansionSignalEvents(eventTypes),
    activeEventCount,
    message: schemaReady
      ? relationshipMemoryReady && revenueIntelligenceReady
        ? "Retention intelligence is passive and evidence-backed. Operators control all customer success actions."
        : "Apply Phase 2C/2D migrations for full retention intelligence coverage."
      : `Apply migration for voice retention intelligence — ${schema.message}`,
  }
}

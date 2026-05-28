import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildCommunicationHealthSummary } from "@/lib/voice/multi-channel-intelligence/communication-health"
import { summarizeChannelContinuity } from "@/lib/voice/multi-channel-intelligence/channel-continuity"
import {
  futureChannelHookEvidence,
  validateFutureChannelHook,
} from "@/lib/voice/multi-channel-intelligence/future-channel-hooks"
import { detectPreferredChannels } from "@/lib/voice/multi-channel-intelligence/preferred-channel-detector"
import {
  generateFollowUpTimingRecommendation,
  generateMultichannelRecommendations,
} from "@/lib/voice/multi-channel-intelligence/recommendations"
import {
  buildMultichannelCommandSummary,
  buildMultichannelWorkspaceSnapshot,
} from "@/lib/voice/multi-channel-intelligence/snapshot-builder"
import { buildUnifiedCommunicationTimeline } from "@/lib/voice/multi-channel-intelligence/timeline-builder"
import { staleThreadCutoffIso } from "@/lib/voice/multi-channel-intelligence/timeline-builder"
import type {
  VoiceMultichannelIntelligenceCommandSummary,
  VoiceMultichannelIntelligenceReadinessSnapshot,
  VoiceMultichannelIntelligenceWorkspaceSnapshot,
  VoiceUnifiedCommunicationChannel,
  VoiceUnifiedCommunicationEventType,
  VoiceUnifiedCommunicationThreadType,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER,
  VOICE_MULTICHANNEL_MAX_ACTIVE_THREADS,
  VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS,
  VOICE_MULTICHANNEL_SNAPSHOT_CACHE_MINUTES,
  VOICE_MULTICHANNEL_STALE_HOURS,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  isVoiceObservabilityEnabled,
  recordVoiceObservabilityEvent,
} from "@/lib/voice/observability/observability-service"
import {
  appendUnifiedCommunicationEvent,
  archiveStaleCommunicationThreads,
  createUnifiedCommunicationThread,
  getUnifiedCommunicationThread,
  listActiveUnifiedCommunicationThreads,
  listRecentUnifiedCommunicationEvents,
  listUnifiedCommunicationEvents,
  updateUnifiedCommunicationThread,
} from "@/lib/voice/repository/voice-multichannel-intelligence-repository"
import { appendWorkflowOrchestrationEvent } from "@/lib/voice/repository/voice-workflow-orchestration-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import { isVoiceWorkflowOrchestrationEnabled } from "@/lib/voice/workflow-orchestration/workflow-orchestration-service"

type SnapshotCacheEntry = {
  expiresAt: number
  workspace: VoiceMultichannelIntelligenceWorkspaceSnapshot
}

const workspaceCache = new Map<string, SnapshotCacheEntry>()

export function isVoiceMultichannelIntelligenceEnabled(): boolean {
  return process.env.VOICE_MULTICHANNEL_INTELLIGENCE_ENABLED === "true"
}

async function recordMultichannelObservability(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    severity?: "info" | "warning" | "critical"
    sourceSessionId?: string | null
    sourceCallId?: string | null
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    evidence?: Record<string, unknown>
  },
) {
  if (!isVoiceObservabilityEnabled()) return null
  return recordVoiceObservabilityEvent(admin, {
    organizationId: input.organizationId,
    eventCategory: input.eventType.includes("escalation") ? "escalation" : "ai_orchestration",
    eventType: input.eventType,
    severity: input.severity ?? "info",
    sourceSystem: "multichannel_intelligence",
    sourceSessionId: input.sourceSessionId,
    sourceCallId: input.sourceCallId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    evidence: input.evidence,
    metadata: { phase: "6a", autonomousOmnichannelDisabled: true },
  })
}

async function syncWorkflowOrchestrationEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    orchestrationId: string | null | undefined
    eventType: "channel_transition_recorded" | "escalation_triggered" | "followup_recommended"
    evidenceText: string
    linkedSessionId?: string | null
    linkedCallId?: string | null
  },
) {
  if (!isVoiceWorkflowOrchestrationEnabled() || !input.orchestrationId) return
  await appendWorkflowOrchestrationEvent(admin, {
    organizationId: input.organizationId,
    orchestrationId: input.orchestrationId,
    eventType: input.eventType,
    evidenceText: input.evidenceText,
    linkedSessionId: input.linkedSessionId,
    linkedCallId: input.linkedCallId,
    payload: { source: "multichannel_intelligence", autonomousExecutionDisabled: true },
  })
}

export async function fetchMultichannelIntelligenceReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceMultichannelIntelligenceReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const enabled = isVoiceMultichannelIntelligenceEnabled()

  return {
    qaMarker: VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER,
    schemaReady: schema.ready,
    intelligenceEnabled: enabled,
    unifiedTimelineReady: schema.ready,
    crossChannelCoordinationReady: schema.ready && enabled,
    escalationContinuityReady: schema.ready,
    communicationHealthReady: schema.ready,
    preferredChannelIntelligenceReady: schema.ready,
    workflowIntegrationReady: isVoiceWorkflowOrchestrationEnabled() && schema.ready,
    observabilityIntegrationReady: isVoiceObservabilityEnabled() && schema.ready,
    futureChannelHooksReady: schema.ready,
    autonomousOmnichannelDisabled: true,
    message: enabled
      ? "Multi-channel intelligence enabled — operator-controlled coordination only."
      : "Set VOICE_MULTICHANNEL_INTELLIGENCE_ENABLED=true to activate unified communications intelligence.",
  }
}

async function loadActiveThreads(admin: SupabaseClient, organizationId: string) {
  await archiveStaleCommunicationThreads(admin, organizationId, staleThreadCutoffIso(VOICE_MULTICHANNEL_STALE_HOURS))
  return listActiveUnifiedCommunicationThreads(admin, organizationId, VOICE_MULTICHANNEL_MAX_ACTIVE_THREADS)
}

export async function fetchMultichannelIntelligenceWorkspace(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceMultichannelIntelligenceWorkspaceSnapshot> {
  const cached = workspaceCache.get(organizationId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.workspace
  }

  const activeThreads = await loadActiveThreads(admin, organizationId)
  const recentEvents = await listRecentUnifiedCommunicationEvents(admin, organizationId, VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS)
  const preferredChannelInsights = detectPreferredChannels(recentEvents)
  const health = buildCommunicationHealthSummary({ threads: activeThreads, events: recentEvents })
  const recommendations = generateMultichannelRecommendations({ events: recentEvents, preferredChannelInsights })

  const followUp = generateFollowUpTimingRecommendation(recentEvents)
  if (followUp) recommendations.push(followUp)

  const workspace = buildMultichannelWorkspaceSnapshot({
    activeThreads,
    recentEvents,
    preferredChannelInsights,
    health,
    recommendations,
  })

  workspaceCache.set(organizationId, {
    expiresAt: Date.now() + VOICE_MULTICHANNEL_SNAPSHOT_CACHE_MINUTES * 60 * 1000,
    workspace,
  })

  return workspace
}

export async function fetchMultichannelIntelligenceCommandSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceMultichannelIntelligenceCommandSummary> {
  const activeThreads = await loadActiveThreads(admin, organizationId)
  const recentEvents = await listRecentUnifiedCommunicationEvents(admin, organizationId, 50)
  const health = buildCommunicationHealthSummary({ threads: activeThreads, events: recentEvents })
  return buildMultichannelCommandSummary({ activeThreads, health })
}

export async function createUnifiedCommunicationThreadRecord(
  admin: SupabaseClient,
  input: {
    organizationId: string
    threadType: VoiceUnifiedCommunicationThreadType
    primaryChannel?: VoiceUnifiedCommunicationChannel
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    communicationSummary?: string
    userId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  if (!isVoiceMultichannelIntelligenceEnabled()) {
    throw new Error("Multi-channel intelligence is disabled.")
  }

  const thread = await createUnifiedCommunicationThread(admin, input)

  await recordMultichannelObservability(admin, {
    organizationId: input.organizationId,
    eventType: "unified_communication_thread_created",
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    evidence: { threadId: thread.id, threadType: input.threadType },
  })

  workspaceCache.delete(input.organizationId)
  return thread
}

export async function recordUnifiedCommunicationEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    threadId: string
    eventType: VoiceUnifiedCommunicationEventType
    channel: VoiceUnifiedCommunicationChannel
    evidenceText: string
    sourceSystem?: string
    sourceSessionId?: string | null
    sourceCallId?: string | null
    userId?: string | null
    payload?: Record<string, unknown>
    workflowOrchestrationId?: string | null
  },
) {
  if (!isVoiceMultichannelIntelligenceEnabled()) {
    throw new Error("Multi-channel intelligence is disabled.")
  }

  const hookValidation = validateFutureChannelHook({ channel: input.channel, eventType: input.eventType })
  if (!hookValidation.allowed) {
    throw new Error(hookValidation.reason)
  }

  const evidenceText =
    input.evidenceText ||
    (validateFutureChannelHook({ channel: input.channel, eventType: input.eventType }).allowed
      ? futureChannelHookEvidence(input.channel)
      : input.evidenceText)

  const thread = await getUnifiedCommunicationThread(admin, input.organizationId, input.threadId)
  if (!thread) throw new Error("Communication thread not found.")

  const event = await appendUnifiedCommunicationEvent(admin, {
    organizationId: input.organizationId,
    threadId: input.threadId,
    eventType: input.eventType,
    channel: input.channel,
    sourceSystem: input.sourceSystem,
    evidenceText,
    sourceSessionId: input.sourceSessionId,
    sourceCallId: input.sourceCallId,
    createdBy: input.userId,
    payload: { ...input.payload, autonomousOmnichannelDisabled: true },
  })

  const threadEvents = await listUnifiedCommunicationEvents(admin, input.organizationId, input.threadId, 50)
  const preferred = detectPreferredChannels(threadEvents, thread.preferredChannel)
  const continuity = summarizeChannelContinuity(threadEvents)

  let newState = thread.currentState
  if (input.eventType === "escalation_triggered") newState = "escalated"
  else if (input.eventType === "communication_resolved") newState = "resolved"
  else if (input.eventType === "unresolved_issue_detected") newState = "stalled"
  else if (input.eventType === "followup_recommended") newState = "awaiting_operator"

  const unresolvedDelta = input.eventType === "unresolved_issue_detected" ? 1 : 0

  await updateUnifiedCommunicationThread(admin, {
    organizationId: input.organizationId,
    threadId: input.threadId,
    patch: {
      currentState: newState,
      lastChannelUsed: input.channel,
      preferredChannel: preferred[0]?.channel ?? thread.preferredChannel,
      lastInteractionAt: new Date().toISOString(),
      unresolvedIssueCount: thread.unresolvedIssueCount + unresolvedDelta,
      escalationState: input.eventType === "escalation_triggered" ? "escalated" : thread.escalationState,
    },
  })

  await recordMultichannelObservability(admin, {
    organizationId: input.organizationId,
    eventType: `unified_communication_${input.eventType}`,
    severity: input.eventType === "communication_failed" ? "warning" : "info",
    sourceSessionId: input.sourceSessionId,
    sourceCallId: input.sourceCallId,
    relationshipMemoryProfileId: thread.relationshipMemoryProfileId,
    relatedCustomerId: thread.relatedCustomerId,
    relatedProspectId: thread.relatedProspectId,
    evidence: { threadId: input.threadId, channel: input.channel, continuityBroken: continuity.continuityBroken },
  })

  if (input.eventType === "escalation_triggered") {
    await syncWorkflowOrchestrationEvent(admin, {
      organizationId: input.organizationId,
      orchestrationId: input.workflowOrchestrationId,
      eventType: "escalation_triggered",
      evidenceText,
      linkedSessionId: input.sourceSessionId,
      linkedCallId: input.sourceCallId,
    })
  }

  if (input.eventType === "channel_transition") {
    await syncWorkflowOrchestrationEvent(admin, {
      organizationId: input.organizationId,
      orchestrationId: input.workflowOrchestrationId,
      eventType: "channel_transition_recorded",
      evidenceText,
      linkedSessionId: input.sourceSessionId,
      linkedCallId: input.sourceCallId,
    })
  }

  workspaceCache.delete(input.organizationId)
  return event
}

export async function fetchUnifiedCommunicationThreadDetail(
  admin: SupabaseClient,
  organizationId: string,
  threadId: string,
) {
  const thread = await getUnifiedCommunicationThread(admin, organizationId, threadId)
  if (!thread) return null

  const events = await listUnifiedCommunicationEvents(admin, organizationId, threadId, VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS)
  const timeline = buildUnifiedCommunicationTimeline(events)
  const preferredChannelInsights = detectPreferredChannels(events, thread.preferredChannel)
  const continuity = summarizeChannelContinuity(events)
  const health = buildCommunicationHealthSummary({ threads: [thread], events })
  const recommendations = generateMultichannelRecommendations({ events, preferredChannelInsights })

  return { thread, events, timeline, preferredChannelInsights, continuity, health, recommendations }
}

export async function overridePreferredChannel(
  admin: SupabaseClient,
  input: {
    organizationId: string
    threadId: string
    preferredChannel: VoiceUnifiedCommunicationChannel
    userId?: string | null
  },
) {
  const updated = await updateUnifiedCommunicationThread(admin, {
    organizationId: input.organizationId,
    threadId: input.threadId,
    patch: {
      preferredChannel: input.preferredChannel,
      metadata: { preferredChannelOverrideBy: input.userId, overrideAt: new Date().toISOString() },
    },
  })

  if (updated) {
    await appendUnifiedCommunicationEvent(admin, {
      organizationId: input.organizationId,
      threadId: input.threadId,
      eventType: "followup_recommended",
      channel: input.preferredChannel,
      evidenceText: `Operator override — preferred channel set to ${input.preferredChannel}.`,
      createdBy: input.userId,
      payload: { operatorOverride: true, autonomousOmnichannelDisabled: true },
    })
  }

  workspaceCache.delete(input.organizationId)
  return updated
}

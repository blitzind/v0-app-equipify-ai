import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchCallWorkspaceLiveCoaching } from "@/lib/growth/native-dialer/call-workspace-coaching-service"
import type { CallWorkspaceCoachingMode } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { buildUnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/orchestration"
import { resolveCallWorkspaceAiosLiveReasoning } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-service"
import { fetchOperatorAssistPreferences } from "@/lib/growth/operator-assist/operator-assist-preferences-repository"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { fetchVoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/intelligence-service"
import type { VoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceConferenceParticipantPublicView } from "@/lib/voice/transfer-control/types"

export async function fetchUnifiedOperatorAssistSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    workspaceSessionId: string | null
    voiceCallId: string | null
    voiceTranscript: VoiceCallTranscriptSnapshot | null
    conversationIntelligence: VoiceCallConversationIntelligenceSnapshot | null
    participants: VoiceConferenceParticipantPublicView[]
    leadRecommendedNextAction?: string | null
  },
): Promise<UnifiedOperatorAssistSnapshot | null> {
  if (!input.workspaceSessionId && !input.voiceCallId) return null

  const preferences = await fetchOperatorAssistPreferences(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })

  let coachingState = null
  let coachingMode: CallWorkspaceCoachingMode | null = null
  let coachingLeadId: string | null = null
  let realtimeSessionId: string | null = null
  let liveSnapshot = null

  if (input.workspaceSessionId) {
    try {
      const coaching = await fetchCallWorkspaceLiveCoaching(admin, input.workspaceSessionId)
      coachingState = coaching.coachingState
      coachingMode = coaching.coachingMode
      coachingLeadId = coaching.coachingLeadId
      realtimeSessionId = coaching.realtimeSession?.id ?? null
      liveSnapshot = coaching.realtimeSession?.liveSnapshot ?? null
    } catch {
      /* coaching optional during orchestration */
    }
  }

  const conversationIntelligence =
    input.conversationIntelligence ??
    (input.voiceCallId
      ? await fetchVoiceCallConversationIntelligenceSnapshot(admin, input.organizationId, input.voiceCallId)
      : null)

  let aiosLiveReasoning = null
  if (coachingLeadId && (liveSnapshot || input.voiceTranscript?.segments?.length)) {
    try {
      aiosLiveReasoning = await resolveCallWorkspaceAiosLiveReasoning(admin, {
        organizationId: input.organizationId,
        leadId: coachingLeadId,
        liveSnapshot,
        voiceTranscript: input.voiceTranscript,
        realtimeSessionId,
      })
    } catch {
      /* AI OS live reasoning is best-effort during enrichment */
    }
  }

  const snapshot = buildUnifiedOperatorAssistSnapshot({
    coachingState,
    coachingMode,
    coachingLeadId,
    realtimeSessionId,
    voiceCallId: input.voiceCallId,
    conversationIntelligence,
    voiceTranscript: input.voiceTranscript,
    liveSnapshot,
    leadContext: input.leadRecommendedNextAction
      ? { recommendedNextAction: input.leadRecommendedNextAction }
      : null,
    participants: input.participants,
    preferences,
    generatedAt: new Date().toISOString(),
    aiosLiveReasoning,
  })

  logVoiceInfrastructure("coach_turn_display_payload", {
    realtimeSessionId,
    voiceCallId: input.voiceCallId,
    primaryCoachPhrase: snapshot.coachingState?.primaryCoach?.primaryPhrase ?? null,
    primaryCoachSource: snapshot.coachingState?.primaryCoach?.source ?? null,
    primaryCoachTriggeredBySequenceNumber:
      snapshot.coachingState?.primaryCoach?.triggeredBySequenceNumber ?? null,
    nextBestActionTitle: snapshot.nextBestAction?.primary?.title ?? null,
    nextBestActionSource: snapshot.nextBestAction?.primary?.source ?? null,
    aiosLiveReasoningActive: Boolean(snapshot.aiosLiveReasoning),
    aiosSayThisNext: snapshot.aiosLiveReasoning?.sayThisNext.recommendedNextSentence?.slice(0, 120) ?? null,
  })

  return snapshot
}

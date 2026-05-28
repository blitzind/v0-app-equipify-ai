import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeTranscriptSegmentWithConfiguredProvider } from "@/lib/voice/intelligence/registry"
import {
  VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  assertVoiceIntelligencePassiveOnly,
} from "@/lib/voice/intelligence/passive-mode-guard"
import type {
  VoiceCallConversationIntelligenceSnapshot,
  VoiceIntelligenceSegmentInput,
} from "@/lib/voice/intelligence/types"
import { VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/intelligence/types"
import { resolveConfiguredIntelligenceAnalysisProvider } from "@/lib/voice/intelligence/registry"
import {
  listVoiceConversationIntelligenceForCall,
  persistVoiceIntelligenceInsight,
} from "@/lib/voice/repository/voice-conversation-intelligence-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export async function processTranscriptSegmentIntelligence(
  admin: SupabaseClient,
  input: VoiceIntelligenceSegmentInput,
): Promise<{ createdCount: number; provider: string }> {
  assertVoiceIntelligencePassiveOnly("process_transcript_segment")

  const analysis = await analyzeTranscriptSegmentWithConfiguredProvider(input)
  let createdCount = 0

  for (const insight of analysis.insights) {
    const result = await persistVoiceIntelligenceInsight(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      transcriptSessionId: input.transcriptSessionId,
      transcriptSegmentId: input.transcriptSegmentId,
      sequenceNumber: input.sequenceNumber,
      analysisProvider: analysis.provider,
      insight,
    })
    if (result.created) createdCount += 1
  }

  if (createdCount > 0) {
    logVoiceInfrastructure("voice_conversation_intelligence_detected", {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      transcriptSegmentId: input.transcriptSegmentId,
      createdCount,
      provider: analysis.provider,
    })
  }

  return { createdCount, provider: analysis.provider }
}

export async function fetchVoiceCallConversationIntelligenceSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<VoiceCallConversationIntelligenceSnapshot> {
  const bundle = await listVoiceConversationIntelligenceForCall(admin, organizationId, voiceCallId)
  const suggestedNextBestAction =
    [...bundle.operatorGuidance]
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .find((event) => event.eventType.startsWith("next_best_action_")) ?? null

  return {
    qaMarker: VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER,
    voiceCallId,
    passiveModeEnabled: VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
    liveSignals: bundle.liveSignals.slice(-12),
    objections: bundle.objections.slice(-12),
    buyingSignals: bundle.buyingSignals.slice(-12),
    riskEvents: bundle.riskEvents.slice(-12),
    operatorGuidance: bundle.operatorGuidance.slice(-12),
    suggestedNextBestAction,
    memoryDrafts: bundle.memoryDrafts.filter((draft) => draft.status === "pending_review").slice(-12),
    analysisProvider: resolveConfiguredIntelligenceAnalysisProvider(),
    generatedAt: new Date().toISOString(),
  }
}

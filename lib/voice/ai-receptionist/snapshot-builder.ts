/** Workspace snapshot builder — Phase 4A. */

import type {
  VoiceAiReceptionistEventPublicView,
  VoiceAiReceptionistSessionPublicView,
  VoiceAiReceptionistWorkspaceSnapshot,
} from "@/lib/voice/ai-receptionist/types"
import { VOICE_AI_RECEPTIONIST_QA_MARKER } from "@/lib/voice/ai-receptionist/types"
import { qualificationProgress } from "@/lib/voice/ai-receptionist/qualification-flows"
import type { VoiceAiReceptionistQualificationFlowPublicView } from "@/lib/voice/ai-receptionist/types"
import type { VoiceAiReceptionistCallerIntent } from "@/lib/voice/ai-receptionist/types"

export function buildAiReceptionistWorkspaceSnapshot(input: {
  voiceCallId: string
  session: VoiceAiReceptionistSessionPublicView | null
  recentEvents: VoiceAiReceptionistEventPublicView[]
  currentIntent: VoiceAiReceptionistCallerIntent | null
  qualificationFlow: VoiceAiReceptionistQualificationFlowPublicView | null
}): VoiceAiReceptionistWorkspaceSnapshot {
  const progress = input.qualificationFlow && input.session
    ? qualificationProgress(input.qualificationFlow, input.session.qualificationState)
    : { completed: 0, total: 0, currentStep: null }

  const operatorTakeoverAvailable =
    Boolean(input.session) &&
    !["completed", "failed", "operator_joined"].includes(input.session!.receptionistStatus)

  return {
    qaMarker: VOICE_AI_RECEPTIONIST_QA_MARKER,
    voiceCallId: input.voiceCallId,
    generatedAt: new Date().toISOString(),
    session: input.session,
    recentEvents: input.recentEvents,
    currentIntent: input.currentIntent,
    qualificationProgress: progress,
    operatorTakeoverAvailable,
    autonomousOutboundDisabled: true,
    autonomousCrmDisabled: true,
    boundedConversationOnly: true,
    message: input.session
      ? "AI receptionist active — bounded inbound assistance. Operator takeover available."
      : "No active AI receptionist session for this call.",
  }
}

/** Workspace snapshot builder — Phase 4B missed-call recovery. */

import type {
  VoiceCallbackTaskPublicView,
  VoiceMissedCallRecoveryEventPublicView,
  VoiceMissedCallRecoveryWorkspaceSnapshot,
} from "@/lib/voice/missed-call-recovery/types"
import { VOICE_MISSED_CALL_RECOVERY_QA_MARKER } from "@/lib/voice/missed-call-recovery/types"

export function buildMissedCallRecoveryWorkspaceSnapshot(input: {
  voiceCallId: string | null
  activeRecoveries: VoiceMissedCallRecoveryEventPublicView[]
  callbackTasks: VoiceCallbackTaskPublicView[]
}): VoiceMissedCallRecoveryWorkspaceSnapshot {
  return {
    qaMarker: VOICE_MISSED_CALL_RECOVERY_QA_MARKER,
    voiceCallId: input.voiceCallId,
    generatedAt: new Date().toISOString(),
    activeRecoveries: input.activeRecoveries,
    callbackTasks: input.callbackTasks,
    autonomousOutboundDisabled: true,
    message:
      input.activeRecoveries.length > 0
        ? "Missed-call recovery active — operator must initiate callback manually."
        : "No active missed-call recovery for this call.",
  }
}

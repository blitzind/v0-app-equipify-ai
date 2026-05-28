/** Voicemail detection + bounded scripts — Phase 5A. */

import { buildVoicemailScript } from "@/lib/voice/ai-outbound/guardrails"
import { detectVoicemailSignal } from "@/lib/voice/ai-outbound/conversation-state-machine"
import type { VoiceAiOutboundWorkflowType } from "@/lib/voice/ai-outbound/types"

export type VoicemailHandlerInput = {
  calleeText: string
  organizationName: string | null
  callbackNumber: string | null
  workflowType: VoiceAiOutboundWorkflowType
}

export type VoicemailHandlerResult = {
  detected: boolean
  script: string | null
  evidenceText: string
}

function workflowLabel(workflowType: VoiceAiOutboundWorkflowType): string {
  switch (workflowType) {
    case "missed_call_callback":
      return "your missed call"
    case "voicemail_followup":
      return "your voicemail"
    case "appointment_confirmation":
      return "your appointment confirmation"
    case "appointment_reminder":
      return "your appointment reminder"
    default:
      return "your recent inquiry"
  }
}

export function analyzeVoicemailSignal(input: VoicemailHandlerInput): VoicemailHandlerResult {
  const detected = detectVoicemailSignal(input.calleeText)
  if (!detected) {
    return { detected: false, script: null, evidenceText: "No voicemail signal detected." }
  }

  const script = buildVoicemailScript({
    organizationName: input.organizationName,
    callbackNumber: input.callbackNumber,
    workflowLabel: workflowLabel(input.workflowType),
  })

  return {
    detected: true,
    script,
    evidenceText: "Voicemail signal detected — bounded script prepared.",
  }
}

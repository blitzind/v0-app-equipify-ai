/** Bounded outbound conversation state machine — Phase 5A. */

import type {
  VoiceAiOutboundConversationPhase,
  VoiceAiOutboundSessionStatus,
  VoiceAiOutboundWorkflowType,
} from "@/lib/voice/ai-outbound/types"
import {
  VOICE_AI_OUTBOUND_ESCALATION_CONFUSION_THRESHOLD,
  VOICE_AI_OUTBOUND_ESCALATION_FRUSTRATION_THRESHOLD,
} from "@/lib/voice/ai-outbound/types"

export type OutboundFsmState = {
  phase: VoiceAiOutboundConversationPhase
  status: VoiceAiOutboundSessionStatus
  confusionCount: number
  frustrationCount: number
  optOutDetected: boolean
  voicemailDetected: boolean
  escalationRequired: boolean
}

export type OutboundFsmTransitionInput = {
  current: OutboundFsmState
  calleeText: string
  workflowType: VoiceAiOutboundWorkflowType
  operatorJoined: boolean
  operatorApproved: boolean
  complianceBlocked: boolean
  providerFailed: boolean
  silenceDetected: boolean
  interruptionDetected: boolean
}

const OPT_OUT_PATTERNS = [
  /\b(stop|unsubscribe|opt out|opt-out|do not call|don't call|remove me|take me off)\b/i,
  /\b(not interested|never call)\b/i,
]

const VOICEMAIL_PATTERNS = [
  /\b(voicemail|leave a message|after the tone|beep|not available)\b/i,
  /\b(mailbox is full|mailbox)\b/i,
]

const FRUSTRATION_PATTERNS = [
  /\b(frustrated|annoyed|stop calling|already told you|leave me alone)\b/i,
]

export function createInitialOutboundFsmState(
  approved: boolean,
): OutboundFsmState {
  return {
    phase: approved ? "opening" : "approval_pending",
    status: approved ? "initiating" : "pending_operator_approval",
    confusionCount: 0,
    frustrationCount: 0,
    optOutDetected: false,
    voicemailDetected: false,
    escalationRequired: false,
  }
}

export function detectOptOutIntent(text: string): boolean {
  return OPT_OUT_PATTERNS.some((p) => p.test(text))
}

export function detectVoicemailSignal(text: string): boolean {
  return VOICEMAIL_PATTERNS.some((p) => p.test(text))
}

export function transitionOutboundFsm(input: OutboundFsmTransitionInput): OutboundFsmState {
  if (input.complianceBlocked) {
    return {
      ...input.current,
      phase: "terminated",
      status: "blocked_by_compliance",
      escalationRequired: false,
    }
  }

  if (input.current.optOutDetected || detectOptOutIntent(input.calleeText)) {
    return {
      ...input.current,
      phase: "terminated",
      status: "completed",
      optOutDetected: true,
      escalationRequired: false,
    }
  }

  if (input.operatorJoined) {
    return {
      ...input.current,
      phase: "closing",
      status: "operator_joined",
      escalationRequired: false,
    }
  }

  if (input.providerFailed) {
    return {
      ...input.current,
      phase: "escalation",
      status: "escalation_pending",
      escalationRequired: true,
    }
  }

  const text = input.calleeText.toLowerCase()
  let next = { ...input.current }

  if (detectVoicemailSignal(text) || input.current.voicemailDetected) {
    return {
      ...next,
      phase: "voicemail",
      status: "voicemail_mode",
      voicemailDetected: true,
      escalationRequired: false,
    }
  }

  if (FRUSTRATION_PATTERNS.some((p) => p.test(text))) {
    next.frustrationCount += 1
  }

  if (input.silenceDetected || text.trim().length === 0) {
    next.confusionCount += 1
  }

  if (
    next.frustrationCount >= VOICE_AI_OUTBOUND_ESCALATION_FRUSTRATION_THRESHOLD ||
    next.confusionCount >= VOICE_AI_OUTBOUND_ESCALATION_CONFUSION_THRESHOLD ||
    /\b(operator|human|person|representative|manager)\b/.test(text)
  ) {
    return {
      ...next,
      phase: "escalation",
      status: "escalation_pending",
      escalationRequired: true,
    }
  }

  if (!input.operatorApproved && next.phase === "approval_pending") {
    return next
  }

  switch (next.phase) {
    case "approval_pending":
      return input.operatorApproved
        ? { ...next, phase: "opening", status: "initiating" }
        : next
    case "opening":
      if (input.workflowType === "appointment_confirmation" || input.workflowType === "appointment_reminder") {
        return { ...next, phase: "scheduling", status: "active" }
      }
      if (input.workflowType === "qualification_callback") {
        return { ...next, phase: "qualification", status: "active" }
      }
      return { ...next, phase: "callback_offer", status: "active" }
    case "qualification":
      if (/\b(schedule|appointment|book|time)\b/.test(text)) {
        return { ...next, phase: "scheduling", status: "active" }
      }
      return { ...next, status: "active" }
    case "scheduling":
      return { ...next, phase: "closing", status: "active" }
    case "callback_offer":
      return { ...next, phase: "closing", status: "active" }
    case "voicemail":
      return { ...next, phase: "closing", status: "voicemail_mode" }
    case "escalation":
      return { ...next, status: "escalation_pending", escalationRequired: true }
    case "closing":
      return { ...next, phase: "terminated", status: "completed" }
    case "terminated":
      return next
    default:
      return next
  }
}

export function mapOutboundPhaseToStatus(phase: VoiceAiOutboundConversationPhase): VoiceAiOutboundSessionStatus {
  switch (phase) {
    case "approval_pending":
      return "pending_operator_approval"
    case "opening":
      return "initiating"
    case "qualification":
    case "scheduling":
    case "callback_offer":
      return "active"
    case "voicemail":
      return "voicemail_mode"
    case "escalation":
      return "escalation_pending"
    case "closing":
      return "active"
    case "terminated":
      return "completed"
    default:
      return "pending_operator_approval"
  }
}

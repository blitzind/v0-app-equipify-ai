/** Bounded conversation state machine — Phase 4A. Client-safe logic. */

import type {
  VoiceAiReceptionistCallerIntent,
  VoiceAiReceptionistConversationPhase,
  VoiceAiReceptionistStatus,
} from "@/lib/voice/ai-receptionist/types"

export type ReceptionistFsmState = {
  phase: VoiceAiReceptionistConversationPhase
  status: VoiceAiReceptionistStatus
  intent: VoiceAiReceptionistCallerIntent | null
  qualificationStepIndex: number
  escalationRequired: boolean
}

export type ReceptionistFsmTransitionInput = {
  current: ReceptionistFsmState
  callerText: string
  intent: VoiceAiReceptionistCallerIntent
  qualificationComplete: boolean
  faqMatched: boolean
  operatorJoined: boolean
  interruptionDetected: boolean
  providerFailed: boolean
  afterHours: boolean
}

const ESCALATION_INTENTS: VoiceAiReceptionistCallerIntent[] = ["speak_to_human", "emergency"]

export function createInitialReceptionistFsmState(): ReceptionistFsmState {
  return {
    phase: "greeting",
    status: "greeting",
    intent: null,
    qualificationStepIndex: 0,
    escalationRequired: false,
  }
}

export function transitionReceptionistFsm(input: ReceptionistFsmTransitionInput): ReceptionistFsmState {
  const text = input.callerText.toLowerCase()
  const next = { ...input.current }

  if (input.operatorJoined) {
    return {
      phase: "completed",
      status: "operator_joined",
      intent: input.intent,
      qualificationStepIndex: next.qualificationStepIndex,
      escalationRequired: false,
    }
  }

  if (input.providerFailed) {
    return {
      ...next,
      phase: "escalation",
      status: "failed",
      escalationRequired: true,
    }
  }

  if (input.interruptionDetected && next.phase !== "greeting") {
    return { ...next, phase: "intent_detection", status: next.status }
  }

  if (ESCALATION_INTENTS.includes(input.intent) || /\b(manager|human|person|operator|representative)\b/.test(text)) {
    return {
      phase: "escalation",
      status: "transfer_pending",
      intent: input.intent,
      qualificationStepIndex: next.qualificationStepIndex,
      escalationRequired: true,
    }
  }

  if (input.afterHours && next.phase === "greeting") {
    return {
      phase: "voicemail",
      status: "voicemail_capture",
      intent: input.intent,
      qualificationStepIndex: 0,
      escalationRequired: false,
    }
  }

  switch (next.phase) {
    case "greeting":
      return {
        phase: "intent_detection",
        status: "greeting",
        intent: input.intent,
        qualificationStepIndex: 0,
        escalationRequired: false,
      }
    case "intent_detection": {
      if (input.intent === "appointment_request" || input.intent === "service_request") {
        return {
          phase: "qualification",
          status: "qualification",
          intent: input.intent,
          qualificationStepIndex: 0,
          escalationRequired: false,
        }
      }
      if (input.faqMatched || input.intent === "general_inquiry" || input.intent === "billing_question") {
        return {
          phase: "faq",
          status: "faq",
          intent: input.intent,
          qualificationStepIndex: next.qualificationStepIndex,
          escalationRequired: false,
        }
      }
      if (input.intent === "unknown") {
        return {
          phase: "escalation",
          status: "transfer_pending",
          intent: input.intent,
          qualificationStepIndex: next.qualificationStepIndex,
          escalationRequired: true,
        }
      }
      return {
        phase: "qualification",
        status: "qualification",
        intent: input.intent,
        qualificationStepIndex: 0,
        escalationRequired: false,
      }
    }
    case "qualification": {
      if (input.qualificationComplete) {
        if (input.intent === "appointment_request") {
          return {
            phase: "scheduling",
            status: "scheduling",
            intent: input.intent,
            qualificationStepIndex: next.qualificationStepIndex,
            escalationRequired: false,
          }
        }
        return {
          phase: "transfer",
          status: "transfer_pending",
          intent: input.intent,
          qualificationStepIndex: next.qualificationStepIndex,
          escalationRequired: false,
        }
      }
      return {
        ...next,
        status: "qualification",
        qualificationStepIndex: next.qualificationStepIndex + 1,
      }
    }
    case "faq":
      return {
        phase: "intent_detection",
        status: "faq",
        intent: input.intent,
        qualificationStepIndex: next.qualificationStepIndex,
        escalationRequired: false,
      }
    case "scheduling":
      return {
        phase: "transfer",
        status: "transfer_pending",
        intent: input.intent,
        qualificationStepIndex: next.qualificationStepIndex,
        escalationRequired: false,
      }
    case "escalation":
    case "transfer":
      return {
        ...next,
        status: "transfer_pending",
        escalationRequired: true,
      }
    case "voicemail":
      return { ...next, status: "voicemail_capture" }
    case "completed":
      return { ...next, status: "completed" }
    default:
      return next
  }
}

export function mapPhaseToStatus(phase: VoiceAiReceptionistConversationPhase): VoiceAiReceptionistStatus {
  switch (phase) {
    case "greeting":
      return "greeting"
    case "qualification":
      return "qualification"
    case "faq":
      return "faq"
    case "scheduling":
      return "scheduling"
    case "escalation":
      return "escalated"
    case "transfer":
      return "transfer_pending"
    case "voicemail":
      return "voicemail_capture"
    case "completed":
      return "completed"
    default:
      return "greeting"
  }
}

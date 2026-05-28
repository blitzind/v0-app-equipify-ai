/** Outbound AI guardrails — Phase 5A. Bounded, escalation-safe outputs. */

import {
  VOICE_AI_OUTBOUND_MAX_RESPONSE_CHARS,
  VOICE_AI_OUTBOUND_PROHIBITED_TOPICS,
} from "@/lib/voice/ai-outbound/types"

export type OutboundGuardrailViolation = {
  code: string
  message: string
  escalate: boolean
  terminate: boolean
}

const UNSAFE_PATTERNS = [
  /\b(guarantee|promise|definitely|100%|lowest price|best deal)\b/i,
  /\b(i booked|i scheduled|appointment is confirmed|calendar updated)\b/i,
  /\b(i updated your|crm|database|record updated)\b/i,
  /\b(limited time|act now|urgent offer|last chance)\b/i,
]

export function detectOutboundProhibitedTopic(text: string): OutboundGuardrailViolation | null {
  const lower = text.toLowerCase()
  for (const topic of VOICE_AI_OUTBOUND_PROHIBITED_TOPICS) {
    if (lower.includes(topic.replace(/_/g, " "))) {
      return {
        code: `prohibited_${topic}`,
        message: `Outbound response blocked: ${topic.replace(/_/g, " ")}.`,
        escalate: true,
        terminate: false,
      }
    }
  }
  if (/\b(lawsuit|legal advice|attorney|malpractice|diagnos)\b/i.test(text)) {
    return {
      code: "prohibited_legal_medical",
      message: "Legal or medical topics require human escalation.",
      escalate: true,
      terminate: false,
    }
  }
  return null
}

export function sanitizeOutboundResponse(text: string): {
  text: string
  violations: OutboundGuardrailViolation[]
} {
  const violations: OutboundGuardrailViolation[] = []
  let sanitized = text.trim()

  const prohibited = detectOutboundProhibitedTopic(sanitized)
  if (prohibited) violations.push(prohibited)

  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push({
        code: "unsafe_autonomous_claim",
        message: "Response contained unsupported autonomous claim — suppressed.",
        escalate: false,
        terminate: false,
      })
      sanitized = sanitized.replace(pattern, "[operator will confirm]")
    }
  }

  if (sanitized.length > VOICE_AI_OUTBOUND_MAX_RESPONSE_CHARS) {
    sanitized = `${sanitized.slice(0, VOICE_AI_OUTBOUND_MAX_RESPONSE_CHARS - 3)}...`
    violations.push({
      code: "response_truncated",
      message: "Response truncated for bounded outbound output.",
      escalate: false,
      terminate: false,
    })
  }

  return { text: sanitized, violations }
}

export function buildOutboundAiDisclosure(organizationName: string | null): string {
  const org = organizationName?.trim() || "our team"
  return `Hello, this is an automated callback from ${org}. A team member may join if needed. `
}

export function buildVoicemailScript(input: {
  organizationName: string | null
  callbackNumber: string | null
  workflowLabel: string
}): string {
  const org = input.organizationName?.trim() || "our team"
  const callback = input.callbackNumber?.trim() ? ` Please call us back at ${input.callbackNumber}.` : ""
  return (
    `Hi, this is ${org} following up regarding ${input.workflowLabel}. ` +
    `This is not an urgent sales call.${callback} Thank you.`
  )
}

export function buildOutboundSilenceFallback(): string {
  return "I did not catch that. Would you like to speak with a team member, or should I call back later?"
}

export function buildOutboundProviderFailureFallback(): string {
  return "I'm having trouble on this line. A team member will follow up with you shortly."
}

export function buildOutboundOptOutTerminationMessage(): string {
  return "Understood — we will not contact you again. Goodbye."
}

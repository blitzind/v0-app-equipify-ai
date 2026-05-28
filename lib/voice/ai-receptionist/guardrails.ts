/** Receptionist guardrails — Phase 4A. Fail-safe, bounded outputs. */

import {
  VOICE_AI_RECEPTIONIST_PROHIBITED_TOPICS,
  type VoiceAiReceptionistCallerIntent,
} from "@/lib/voice/ai-receptionist/types"

export type ReceptionistGuardrailViolation = {
  code: string
  message: string
  escalate: boolean
}

const UNSAFE_RESPONSE_PATTERNS = [
  /\b(guarantee|promise|definitely will|100%)\b/i,
  /\b(i can book|i've scheduled|appointment confirmed)\b/i,
  /\b(i updated your|i changed your|crm|database)\b/i,
]

export function detectProhibitedTopic(text: string): ReceptionistGuardrailViolation | null {
  const lower = text.toLowerCase()
  for (const topic of VOICE_AI_RECEPTIONIST_PROHIBITED_TOPICS) {
    if (lower.includes(topic.replace(/_/g, " "))) {
      return {
        code: `prohibited_${topic}`,
        message: `Topic ${topic.replace(/_/g, " ")} requires human escalation.`,
        escalate: true,
      }
    }
  }
  if (/\b(lawsuit|legal|attorney|malpractice)\b/i.test(text)) {
    return { code: "prohibited_legal", message: "Legal topics require human escalation.", escalate: true }
  }
  return null
}

export function sanitizeReceptionistResponse(text: string): { text: string; violations: ReceptionistGuardrailViolation[] } {
  const violations: ReceptionistGuardrailViolation[] = []
  let sanitized = text.trim()

  const prohibited = detectProhibitedTopic(sanitized)
  if (prohibited) violations.push(prohibited)

  for (const pattern of UNSAFE_RESPONSE_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push({
        code: "unsafe_autonomous_claim",
        message: "Response contained autonomous action language — suppressed.",
        escalate: false,
      })
      sanitized = sanitized.replace(pattern, "[operator will confirm]")
    }
  }

  if (sanitized.length > 500) {
    sanitized = `${sanitized.slice(0, 497)}...`
    violations.push({ code: "response_truncated", message: "Response truncated for bounded output.", escalate: false })
  }

  return { text: sanitized, violations }
}

export function shouldEscalateIntent(intent: VoiceAiReceptionistCallerIntent): boolean {
  return intent === "speak_to_human" || intent === "emergency" || intent === "unknown"
}

export function buildAiDisclosurePrefix(enabled: boolean): string {
  if (!enabled) return ""
  return "This call may be assisted by an automated receptionist. "
}

export function buildRecordingDisclosurePrefix(text: string | null): string {
  if (!text?.trim()) return ""
  return `${text.trim()} `
}

export function buildSilenceFallbackResponse(): string {
  return "I did not catch that. Could you please repeat, or say 'operator' to speak with a team member?"
}

export function buildLatencyFallbackResponse(): string {
  return "One moment please — let me connect you with a team member who can help."
}

export function buildProviderFailureFallbackResponse(): string {
  return "I'm having trouble right now. I'll connect you with a team member."
}

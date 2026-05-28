/** Bounded scheduling assistance — Phase 5A. No autonomous calendar mutation. */

import type { VoiceAiOutboundWorkflowType } from "@/lib/voice/ai-outbound/types"

export type SchedulingIntent = "confirm" | "reschedule" | "callback" | "unknown"

export function detectSchedulingIntent(text: string): SchedulingIntent {
  const lower = text.toLowerCase()
  if (/\b(reschedule|different time|change|move|cancel)\b/.test(lower)) return "reschedule"
  if (/\b(confirm|yes|works|sounds good|that time)\b/.test(lower)) return "confirm"
  if (/\b(call back|callback|later|tomorrow|next week)\b/.test(lower)) return "callback"
  return "unknown"
}

export function buildSchedulingPrompt(
  workflowType: VoiceAiOutboundWorkflowType,
  intent: SchedulingIntent,
): string {
  if (workflowType === "appointment_confirmation" || workflowType === "appointment_reminder") {
    if (intent === "confirm") {
      return "Thank you. I'll note that the appointment works for you. A team member will send final confirmation."
    }
    if (intent === "reschedule") {
      return "I understand you'd like to reschedule. What day or time range works better? Our team will confirm the change."
    }
  }
  if (intent === "callback") {
    return "I'll note your callback preference. What time works best for a team member to reach you?"
  }
  return "Would you like to confirm a time, request a callback, or speak with scheduling?"
}

export function requiresHumanSchedulingConfirmation(intent: SchedulingIntent): boolean {
  return intent === "reschedule" || intent === "confirm"
}

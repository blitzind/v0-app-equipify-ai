/** Caller intent routing — Phase 4A (deterministic, bounded). */

import type { VoiceAiReceptionistCallerIntent } from "@/lib/voice/ai-receptionist/types"

const INTENT_PATTERNS: Array<{ intent: VoiceAiReceptionistCallerIntent; patterns: RegExp[] }> = [
  {
    intent: "emergency",
    patterns: [/\b(emergency|urgent|911|immediate help)\b/i],
  },
  {
    intent: "speak_to_human",
    patterns: [/\b(human|person|operator|representative|agent|manager)\b/i],
  },
  {
    intent: "appointment_request",
    patterns: [/\b(appointment|schedule|book|booking|calendar|visit)\b/i],
  },
  {
    intent: "service_request",
    patterns: [/\b(service|repair|maintenance|fix|install|work order)\b/i],
  },
  {
    intent: "billing_question",
    patterns: [/\b(bill|invoice|payment|charge|pricing|cost|quote)\b/i],
  },
  {
    intent: "general_inquiry",
    patterns: [/\b(hours|location|address|open|when|where|what)\b/i],
  },
]

export function detectCallerIntent(callerText: string): VoiceAiReceptionistCallerIntent {
  const trimmed = callerText.trim()
  if (!trimmed) return "unknown"

  for (const row of INTENT_PATTERNS) {
    if (row.patterns.some((p) => p.test(trimmed))) return row.intent
  }

  return "unknown"
}

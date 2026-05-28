/** Conversation pacing analysis — Phase 3B. */

import type { VoiceConversationPacingAnalysis } from "@/lib/voice/copilot-strategy/types"

export type TranscriptSegmentForPacing = {
  speakerType: string
  text: string
}

export function analyzeConversationPacing(segments: TranscriptSegmentForPacing[]): VoiceConversationPacingAnalysis {
  if (segments.length === 0) {
    return {
      operatorTalkPercent: 50,
      customerTalkPercent: 50,
      pacingLabel: "balanced",
      evidenceText: "No transcript segments in window.",
      confidenceScore: 0.4,
    }
  }

  let operatorChars = 0
  let customerChars = 0
  for (const segment of segments) {
    const len = segment.text.trim().length
    if (/operator|agent|rep|staff/i.test(segment.speakerType)) operatorChars += len
    else customerChars += len
  }
  const total = operatorChars + customerChars || 1
  const operatorTalkPercent = Math.round((operatorChars / total) * 100)
  const customerTalkPercent = 100 - operatorTalkPercent

  let pacingLabel: VoiceConversationPacingAnalysis["pacingLabel"] = "balanced"
  if (operatorTalkPercent >= 70) pacingLabel = "operator_heavy"
  else if (customerTalkPercent >= 70) pacingLabel = "customer_heavy"
  else if (segments.length >= 6 && operatorTalkPercent >= 55) pacingLabel = "rushed"

  return {
    operatorTalkPercent,
    customerTalkPercent,
    pacingLabel,
    evidenceText: `Talk ratio ~${operatorTalkPercent}% operator / ${customerTalkPercent}% customer (${segments.length} segments).`,
    confidenceScore: segments.length >= 3 ? 0.78 : 0.55,
  }
}

/** Evidence validation for passive voice intelligence — client-safe. */

import type { VoiceIntelligenceInsightDraft } from "@/lib/voice/intelligence/types"

export const VOICE_INTELLIGENCE_MIN_CONFIDENCE = 0.55 as const
export const VOICE_INTELLIGENCE_MIN_EVIDENCE_LENGTH = 8 as const

export function extractEvidenceSubstring(transcriptText: string, evidenceText: string): string | null {
  const transcript = transcriptText.trim()
  const evidence = evidenceText.trim()
  if (!transcript || !evidence) return null
  const index = transcript.toLowerCase().indexOf(evidence.toLowerCase())
  if (index < 0) return null
  return transcript.slice(index, index + evidence.length)
}

export function hasStrongIntelligenceEvidence(input: {
  transcriptText: string
  evidenceText: string
  confidenceScore: number
}): boolean {
  if (!Number.isFinite(input.confidenceScore) || input.confidenceScore < VOICE_INTELLIGENCE_MIN_CONFIDENCE) {
    return false
  }
  const evidence = extractEvidenceSubstring(input.transcriptText, input.evidenceText)
  if (!evidence || evidence.length < VOICE_INTELLIGENCE_MIN_EVIDENCE_LENGTH) return false
  return true
}

export function filterEvidenceBackedInsights(
  transcriptText: string,
  insights: VoiceIntelligenceInsightDraft[],
): VoiceIntelligenceInsightDraft[] {
  return insights.filter((insight) =>
    hasStrongIntelligenceEvidence({
      transcriptText,
      evidenceText: insight.evidenceText,
      confidenceScore: insight.confidenceScore,
    }),
  )
}

export function combineSegmentConfidence(
  patternConfidence: number,
  segmentConfidence: number | null | undefined,
): number {
  const segment = segmentConfidence != null && Number.isFinite(segmentConfidence) ? segmentConfidence : 0.75
  const combined = patternConfidence * 0.65 + segment * 0.35
  return Math.min(1, Math.max(0, Number(combined.toFixed(4))))
}

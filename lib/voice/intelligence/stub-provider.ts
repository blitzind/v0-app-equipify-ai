/** Stub/fallback voice intelligence provider. */

import type {
  VoiceIntelligenceAnalysisResult,
  VoiceIntelligenceSegmentInput,
} from "@/lib/voice/intelligence/types"

export function analyzeTranscriptSegmentWithStub(
  _input: VoiceIntelligenceSegmentInput,
): VoiceIntelligenceAnalysisResult {
  return { provider: "stub", insights: [] }
}

/** OpenAI conversation intelligence scaffold — passive analysis only. */

import type {
  VoiceIntelligenceAnalysisResult,
  VoiceIntelligenceSegmentInput,
} from "@/lib/voice/intelligence/types"

export function isOpenAiIntelligenceConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.VOICE_INTELLIGENCE_OPENAI_ENABLED?.trim() === "true")
}

export async function analyzeTranscriptSegmentWithOpenAi(
  _input: VoiceIntelligenceSegmentInput,
): Promise<VoiceIntelligenceAnalysisResult> {
  if (!isOpenAiIntelligenceConfigured()) {
    return { provider: "openai", insights: [] }
  }

  // Scaffold only — deterministic rules remain default until explicit OpenAI prompt wiring is approved.
  return {
    provider: "openai",
    insights: [],
  }
}

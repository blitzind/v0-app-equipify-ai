/** Voice intelligence analysis provider registry. */

import { analyzeTranscriptSegmentWithDeterministicRules } from "@/lib/voice/intelligence/deterministic-rules-provider"
import { isOpenAiIntelligenceConfigured, analyzeTranscriptSegmentWithOpenAi } from "@/lib/voice/intelligence/openai-provider"
import { analyzeTranscriptSegmentWithStub } from "@/lib/voice/intelligence/stub-provider"
import type {
  VoiceIntelligenceAnalysisProvider,
  VoiceIntelligenceAnalysisResult,
  VoiceIntelligenceSegmentInput,
} from "@/lib/voice/intelligence/types"

export function resolveConfiguredIntelligenceAnalysisProvider(): VoiceIntelligenceAnalysisProvider {
  const configured = process.env.VOICE_INTELLIGENCE_PROVIDER?.trim().toLowerCase()
  if (configured === "openai" && isOpenAiIntelligenceConfigured()) return "openai"
  if (configured === "stub") return "stub"
  return "deterministic_rules"
}

export async function analyzeTranscriptSegmentWithConfiguredProvider(
  input: VoiceIntelligenceSegmentInput,
): Promise<VoiceIntelligenceAnalysisResult> {
  const provider = resolveConfiguredIntelligenceAnalysisProvider()
  if (provider === "openai") return analyzeTranscriptSegmentWithOpenAi(input)
  if (provider === "stub") return analyzeTranscriptSegmentWithStub(input)
  return analyzeTranscriptSegmentWithDeterministicRules(input)
}

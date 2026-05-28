import type { VoiceTranscriptProviderKind } from "@/lib/voice/media-streaming/types"
import {
  createAssemblyAiTranscriptProvider,
  createDeepgramTranscriptProvider,
  createNoneTranscriptProvider,
  createOpenAiRealtimeTranscriptPlaceholder,
  createStubTranscriptProvider,
} from "@/lib/voice/transcripts/providers/deepgram-provider"
import type { VoiceTranscriptProvider } from "@/lib/voice/transcripts/providers/types"
import { resolveConfiguredTranscriptProviderKind } from "@/lib/voice/transcripts/providers/types"

export function createVoiceTranscriptProvider(kind?: VoiceTranscriptProviderKind): VoiceTranscriptProvider {
  const resolved = kind ?? resolveConfiguredTranscriptProviderKind()
  switch (resolved) {
    case "deepgram":
      return createDeepgramTranscriptProvider()
    case "assemblyai":
      return createAssemblyAiTranscriptProvider()
    case "openai_realtime":
      return createOpenAiRealtimeTranscriptPlaceholder()
    case "none":
      return createNoneTranscriptProvider()
    case "stub":
    default:
      return createStubTranscriptProvider()
  }
}

export function listVoiceTranscriptProviderKinds(): VoiceTranscriptProviderKind[] {
  return ["deepgram", "assemblyai", "openai_realtime", "stub", "none"]
}

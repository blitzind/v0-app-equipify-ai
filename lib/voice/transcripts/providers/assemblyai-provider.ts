export {
  createAssemblyAiTranscriptProvider,
  createDeepgramTranscriptProvider,
  createNoneTranscriptProvider,
  createOpenAiRealtimeTranscriptPlaceholder,
  createStubTranscriptProvider,
} from "@/lib/voice/transcripts/providers/deepgram-provider"

export {
  createVoiceTranscriptProvider,
  listVoiceTranscriptProviderKinds,
} from "@/lib/voice/transcripts/providers/registry"

export type {
  NormalizedTranscriptEvent,
  TranscriptProviderAppendResult,
  TranscriptProviderFinalizeResult,
  TranscriptProviderStartInput,
  TranscriptProviderStartResult,
  VoiceTranscriptProvider,
} from "@/lib/voice/transcripts/providers/types"

export { resolveConfiguredTranscriptProviderKind } from "@/lib/voice/transcripts/providers/types"

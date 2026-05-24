import { AssemblyAiRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/assemblyai-provider"
import { CustomRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/custom-provider"
import { DeepgramRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/deepgram-provider"
import { OpenAiRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/openai-realtime-provider"
import type { RealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/provider-types"
import { StubRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/stub-provider"

export function createRealtimeProviderInstance(providerId: string): RealtimeTranscriptProvider {
  switch (providerId) {
    case "deepgram":
      return new DeepgramRealtimeTranscriptProvider()
    case "assemblyai":
      return new AssemblyAiRealtimeTranscriptProvider()
    case "openai_realtime":
      return new OpenAiRealtimeTranscriptProvider()
    case "custom":
      return new CustomRealtimeTranscriptProvider()
    default:
      return new StubRealtimeTranscriptProvider()
  }
}

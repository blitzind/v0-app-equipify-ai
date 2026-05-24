import "server-only"

import type {
  RealtimeBrowserAudioChunkInput,
  RealtimeTranscriptChunk,
  RealtimeTranscriptProvider,
} from "@/lib/growth/realtime/providers/provider-types"

export function isBrowserAudioStreamProvider(
  provider: RealtimeTranscriptProvider,
): provider is RealtimeTranscriptProvider & {
  supportsBrowserAudioStreaming(): boolean
  openBrowserAudioStream(onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<void>
  closeBrowserAudioStream(): Promise<void>
  ingestBrowserAudioChunk(input: RealtimeBrowserAudioChunkInput): Promise<void>
} {
  return (
    provider.supportsBrowserAudioStreaming() &&
    typeof provider.openBrowserAudioStream === "function" &&
    typeof provider.closeBrowserAudioStream === "function" &&
    typeof provider.ingestBrowserAudioChunk === "function"
  )
}

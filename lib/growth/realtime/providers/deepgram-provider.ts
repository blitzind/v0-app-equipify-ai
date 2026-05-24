import { BaseRealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/base-provider"
import type {
  RealtimeBrowserAudioChunkInput,
  RealtimeTranscriptChunk,
} from "@/lib/growth/realtime/providers/provider-types"
import type { DeepgramBrowserAudioStream } from "@/lib/growth/realtime/providers/deepgram-browser-audio-stream"

export class DeepgramRealtimeTranscriptProvider extends BaseRealtimeTranscriptProvider {
  readonly providerId = "deepgram" as const
  private audioStream: DeepgramBrowserAudioStream | null = null
  private chunkHandler: ((chunk: RealtimeTranscriptChunk) => void) | null = null

  supportsRealtime(): boolean {
    return true
  }

  supportsSpeakerDetection(): boolean {
    return true
  }

  supportsKeywordEvents(): boolean {
    return true
  }

  supportsBrowserAudioStreaming(): boolean {
    return true
  }

  protected credentialEnvKey(): string {
    return "DEEPGRAM_API_KEY"
  }

  protected providerLabel(): string {
    return "Deepgram"
  }

  async disconnect(): Promise<void> {
    await this.closeBrowserAudioStream()
    await super.disconnect()
  }

  async openBrowserAudioStream(onChunk: (chunk: RealtimeTranscriptChunk) => void): Promise<void> {
    if (!this.runtimeConfig) throw new Error("provider_disconnected")
    this.chunkHandler = onChunk
    if (!this.audioStream) {
      const { DeepgramBrowserAudioStream } = await import("@/lib/growth/realtime/providers/deepgram-browser-audio-stream")
      this.audioStream = new DeepgramBrowserAudioStream()
    }
    await this.audioStream.open({
      runtimeConfig: this.runtimeConfig,
      onChunk,
      onError: () => undefined,
      onClose: () => undefined,
    })
  }

  async closeBrowserAudioStream(): Promise<void> {
    await this.audioStream?.close()
    this.audioStream = null
    this.chunkHandler = null
  }

  async ingestBrowserAudioChunk(input: RealtimeBrowserAudioChunkInput): Promise<void> {
    if (!this.audioStream?.isOpen) {
      if (!this.runtimeConfig || !this.chunkHandler) {
        throw new Error("provider_disconnected")
      }
      await this.openBrowserAudioStream(this.chunkHandler)
    }
    await this.audioStream!.ingestChunk(input)
  }
}

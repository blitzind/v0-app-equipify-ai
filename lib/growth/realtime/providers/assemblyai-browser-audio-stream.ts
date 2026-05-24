import "server-only"

import type { RealtimeProviderRuntimeConfig, RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import {
  mapAssemblyAiProviderError,
  parseAssemblyAiLiveTranscriptMessage,
  parseAssemblyAiProviderErrorMessage,
} from "@/lib/growth/realtime/providers/assemblyai-live-message-parser"
import {
  buildAssemblyAiListenUrl,
  isAssemblyAiBrowserAudioEncodingSupported,
  resolveAssemblyAiApiKey,
} from "@/lib/growth/realtime/providers/assemblyai-browser-audio-config"

export type AssemblyAiBrowserAudioStreamOptions = {
  runtimeConfig: RealtimeProviderRuntimeConfig
  onChunk: (chunk: RealtimeTranscriptChunk) => void
  onError?: (error: { code: string; message: string }) => void
  onClose?: () => void
}

export class AssemblyAiBrowserAudioStream {
  private ws: WebSocket | null = null
  private runtimeConfig: RealtimeProviderRuntimeConfig | null = null
  private onChunk: ((chunk: RealtimeTranscriptChunk) => void) | null = null
  private onError: ((error: { code: string; message: string }) => void) | null = null
  private onClose: (() => void) | null = null

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async open(options: AssemblyAiBrowserAudioStreamOptions): Promise<void> {
    if (this.isOpen) return

    this.runtimeConfig = options.runtimeConfig
    this.onChunk = options.onChunk
    this.onError = options.onError ?? null
    this.onClose = options.onClose ?? null

    const apiKey = resolveAssemblyAiApiKey(options.runtimeConfig)
    if (!apiKey) {
      throw new Error("provider_auth_failed")
    }

    const url = buildAssemblyAiListenUrl(options.runtimeConfig)

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Authorization: apiKey,
        },
      })
      this.ws = ws

      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => {
        reject(new Error("provider_disconnected"))
      })
      ws.addEventListener("message", (event) => {
        this.handleMessage(String(event.data ?? ""))
      })
      ws.addEventListener("close", () => {
        this.ws = null
        this.onClose?.()
      })
    })
  }

  async ingestChunk(input: {
    encoding: string
    payload: Buffer
    sequenceNumber: number
    timestampMs: number
    durationMs?: number
  }): Promise<void> {
    void input.sequenceNumber
    void input.timestampMs
    void input.durationMs

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("provider_disconnected")
    }

    if (!isAssemblyAiBrowserAudioEncodingSupported(input.encoding)) {
      throw new Error("unsupported encoding for AssemblyAI stream")
    }

    this.ws.send(input.payload)
  }

  async close(): Promise<void> {
    const ws = this.ws
    if (!ws) return

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }))
      } catch {
        // Best-effort close — audio is never persisted.
      }
    }

    ws.close()
    this.ws = null
    this.runtimeConfig = null
    this.onChunk = null
    this.onError = null
    this.onClose = null
  }

  private handleMessage(raw: string) {
    if (!this.onChunk || !this.runtimeConfig) return

    const providerError = parseAssemblyAiProviderErrorMessage(raw)
    if (providerError) {
      this.onError?.(providerError)
      return
    }

    const chunk = parseAssemblyAiLiveTranscriptMessage(raw, {
      keywordMatcher: (content) => matchAssemblyAiKeywords(content, this.runtimeConfig!),
      speakerSeparationEnabled: this.runtimeConfig.speakerSeparationEnabled,
    })

    if (!chunk || !chunk.isFinal) return
    this.onChunk(chunk)
  }

  emitTransportError(raw: string | Error) {
    const mapped = mapAssemblyAiProviderError(raw)
    this.onError?.(mapped)
  }
}

function matchAssemblyAiKeywords(content: string, config: RealtimeProviderRuntimeConfig): string[] {
  const keywords = [
    ...(config.customKeywords ?? []),
    ...(config.configJson.customKeywords ?? []),
  ]
  const normalized = content.toLowerCase()
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
}

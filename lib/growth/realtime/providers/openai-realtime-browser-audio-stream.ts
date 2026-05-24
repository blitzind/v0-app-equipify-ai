import "server-only"

import type { RealtimeProviderRuntimeConfig, RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import {
  buildOpenAiRealtimeListenUrl,
  buildOpenAiTranscriptionSessionUpdate,
  isOpenAiBrowserAudioEncodingSupported,
  resolveOpenAiRealtimeApiKey,
} from "@/lib/growth/realtime/providers/openai-realtime-browser-audio-config"
import {
  mapOpenAiRealtimeProviderError,
  parseOpenAiRealtimeLiveTranscriptMessage,
  parseOpenAiRealtimeProviderErrorMessage,
} from "@/lib/growth/realtime/providers/openai-realtime-live-message-parser"
import { isOpenAiRealtimeForbiddenOutboundEventType } from "@/lib/growth/realtime/providers/openai-realtime-transcript-invariants"

export type OpenAiRealtimeBrowserAudioStreamOptions = {
  runtimeConfig: RealtimeProviderRuntimeConfig
  onChunk: (chunk: RealtimeTranscriptChunk) => void
  onError?: (error: { code: string; message: string }) => void
  onClose?: () => void
}

export class OpenAiRealtimeBrowserAudioStream {
  private ws: WebSocket | null = null
  private runtimeConfig: RealtimeProviderRuntimeConfig | null = null
  private onChunk: ((chunk: RealtimeTranscriptChunk) => void) | null = null
  private onError: ((error: { code: string; message: string }) => void) | null = null
  private onClose: (() => void) | null = null
  private sessionConfigured = false
  private partialBuffer = { itemId: null as string | null, content: "" }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async open(options: OpenAiRealtimeBrowserAudioStreamOptions): Promise<void> {
    if (this.isOpen) return

    this.runtimeConfig = options.runtimeConfig
    this.onChunk = options.onChunk
    this.onError = options.onError ?? null
    this.onClose = options.onClose ?? null
    this.sessionConfigured = false
    this.partialBuffer = { itemId: null, content: "" }

    const apiKey = resolveOpenAiRealtimeApiKey(options.runtimeConfig)
    if (!apiKey) {
      throw new Error("provider_auth_failed")
    }

    const url = buildOpenAiRealtimeListenUrl(options.runtimeConfig)

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      })
      this.ws = ws

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify(buildOpenAiTranscriptionSessionUpdate(options.runtimeConfig)))
        this.sessionConfigured = true
        resolve()
      })
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

    if (!isOpenAiBrowserAudioEncodingSupported(input.encoding)) {
      throw new Error("unsupported encoding for OpenAI Realtime stream")
    }

    this.ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: input.payload.toString("base64"),
      }),
    )
  }

  async close(): Promise<void> {
    const ws = this.ws
    if (!ws) return

    ws.close()
    this.ws = null
    this.runtimeConfig = null
    this.onChunk = null
    this.onError = null
    this.onClose = null
    this.sessionConfigured = false
    this.partialBuffer = { itemId: null, content: "" }
  }

  private handleMessage(raw: string) {
    if (!this.onChunk || !this.runtimeConfig) return

    let eventType: string | null = null
    try {
      const parsed = JSON.parse(raw) as { type?: string }
      eventType = parsed.type ?? null
    } catch {
      this.onError?.(mapOpenAiRealtimeProviderError("malformed provider event"))
      return
    }

    if (isOpenAiRealtimeForbiddenOutboundEventType(eventType)) {
      return
    }

    const providerError = parseOpenAiRealtimeProviderErrorMessage(raw)
    if (providerError) {
      this.onError?.(providerError)
      return
    }

    const chunk = parseOpenAiRealtimeLiveTranscriptMessage(raw, {
      keywordMatcher: (content) => matchOpenAiKeywords(content, this.runtimeConfig!),
      partialBuffer: this.partialBuffer,
    })

    if (!chunk || !chunk.isFinal) return
    this.onChunk(chunk)
  }

  emitTransportError(raw: string | Error) {
    const mapped = mapOpenAiRealtimeProviderError(raw)
    this.onError?.(mapped)
  }
}

function matchOpenAiKeywords(content: string, config: RealtimeProviderRuntimeConfig): string[] {
  const keywords = [
    ...(config.customKeywords ?? []),
    ...(config.configJson.customKeywords ?? []),
  ]
  const normalized = content.toLowerCase()
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
}

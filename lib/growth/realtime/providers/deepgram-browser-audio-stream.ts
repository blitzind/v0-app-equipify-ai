import "server-only"

import type { RealtimeProviderRuntimeConfig, RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import {
  mapDeepgramProviderError,
  parseDeepgramLiveTranscriptMessage,
} from "@/lib/growth/realtime/providers/deepgram-live-message-parser"
import { hasRealtimeProviderCredential } from "@/lib/growth/realtime/providers/base-provider"

const DEEPGRAM_LIVE_URL = "wss://api.deepgram.com/v1/listen"

export type DeepgramBrowserAudioStreamOptions = {
  runtimeConfig: RealtimeProviderRuntimeConfig
  onChunk: (chunk: RealtimeTranscriptChunk) => void
  onError?: (error: { code: string; message: string }) => void
  onClose?: () => void
}

export class DeepgramBrowserAudioStream {
  private ws: WebSocket | null = null
  private runtimeConfig: RealtimeProviderRuntimeConfig | null = null
  private onChunk: ((chunk: RealtimeTranscriptChunk) => void) | null = null
  private onError: ((error: { code: string; message: string }) => void) | null = null
  private onClose: (() => void) | null = null
  private openedAt: number | null = null

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async open(options: DeepgramBrowserAudioStreamOptions): Promise<void> {
    if (this.isOpen) return

    this.runtimeConfig = options.runtimeConfig
    this.onChunk = options.onChunk
    this.onError = options.onError ?? null
    this.onClose = options.onClose ?? null

    const apiKey = resolveDeepgramApiKey(options.runtimeConfig)
    if (!apiKey) {
      throw new Error("provider_auth_failed")
    }

    const url = buildDeepgramListenUrl(options.runtimeConfig)
    this.openedAt = Date.now()

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${apiKey}`,
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
    void input.encoding
    void input.sequenceNumber
    void input.timestampMs
    void input.durationMs

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("provider_disconnected")
    }

    this.ws.send(input.payload)
  }

  async close(): Promise<void> {
    const ws = this.ws
    if (!ws) return

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "CloseStream" }))
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
    this.openedAt = null
  }

  private handleMessage(raw: string) {
    if (!this.onChunk || !this.runtimeConfig) return

    const chunk = parseDeepgramLiveTranscriptMessage(raw, {
      keywordMatcher: (content) => matchDeepgramKeywords(content, this.runtimeConfig!),
      speakerSeparationEnabled: this.runtimeConfig.speakerSeparationEnabled,
    })

    if (!chunk) return
    this.onChunk(chunk)
  }

  emitTransportError(raw: string | Error) {
    const mapped = mapDeepgramProviderError(raw)
    this.onError?.(mapped)
  }
}

export function resolveDeepgramApiKey(config: RealtimeProviderRuntimeConfig): string | null {
  if (!hasRealtimeProviderCredential(config, "DEEPGRAM_API_KEY")) return null
  const fromConfig = config.credentials?.apiKey
  if (fromConfig && String(fromConfig).trim()) return String(fromConfig).trim()
  const fromEnv = process.env.DEEPGRAM_API_KEY?.trim()
  return fromEnv || null
}

function buildDeepgramListenUrl(config: RealtimeProviderRuntimeConfig): string {
  const params = new URLSearchParams({
    model: config.configJson.model?.trim() || "nova-2",
    language: "en-US",
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    encoding: "opus",
    sample_rate: "48000",
    channels: "1",
  })

  if (config.speakerSeparationEnabled) {
    params.set("diarize", "true")
  }

  const keywords = [
    ...(config.customKeywords ?? []),
    ...(config.configJson.customKeywords ?? []),
  ]
  if (config.keywordEventsEnabled && keywords.length > 0) {
    params.set(
      "keywords",
      keywords
        .slice(0, 20)
        .map((keyword) => `${keyword}:1`)
        .join(","),
    )
  }

  return `${DEEPGRAM_LIVE_URL}?${params.toString()}`
}

function matchDeepgramKeywords(content: string, config: RealtimeProviderRuntimeConfig): string[] {
  const keywords = [
    ...(config.customKeywords ?? []),
    ...(config.configJson.customKeywords ?? []),
  ]
  const normalized = content.toLowerCase()
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()))
}

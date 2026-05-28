/** Outbound provider scaffolds — Phase 5A. */

import { deterministicOutboundProvider } from "@/lib/voice/ai-outbound/deterministic-provider"
import {
  buildOutboundProviderFailureFallback,
  sanitizeOutboundResponse,
} from "@/lib/voice/ai-outbound/guardrails"
import type {
  OutboundProviderContext,
  OutboundProviderResponse,
  VoiceAiOutboundProvider,
} from "@/lib/voice/ai-outbound/provider-types"
import { VOICE_AI_OUTBOUND_PROVIDER_TIMEOUT_MS } from "@/lib/voice/ai-outbound/types"

function scaffoldProvider(id: "deepgram" | "openai_realtime" | "elevenlabs" | "stub"): VoiceAiOutboundProvider {
  return {
    id,
    isConfigured() {
      if (id === "stub") return true
      if (id === "deepgram") return Boolean(process.env.DEEPGRAM_API_KEY)
      if (id === "openai_realtime") return Boolean(process.env.OPENAI_API_KEY)
      if (id === "elevenlabs") return Boolean(process.env.ELEVENLABS_API_KEY)
      return false
    },
    async generateResponse(context: OutboundProviderContext): Promise<OutboundProviderResponse> {
      const start = Date.now()
      if (id !== "stub" && !this.isConfigured()) {
        return deterministicOutboundProvider.generateResponse(context)
      }
      const fallback = sanitizeOutboundResponse(
        id === "stub"
          ? `[stub ${id}] ${context.calleeText || "Hello"}`
          : buildOutboundProviderFailureFallback(),
      )
      return {
        spokenText: fallback.text,
        evidenceText: `Scaffold provider ${id} — realtime wiring pending; deterministic fallback when unconfigured.`,
        latencyMs: Date.now() - start,
        providerId: id,
      }
    },
  }
}

export { deterministicOutboundProvider }
export const deepgramOutboundProvider = scaffoldProvider("deepgram")
export const openAiRealtimeOutboundProvider = scaffoldProvider("openai_realtime")
export const elevenLabsOutboundProvider = scaffoldProvider("elevenlabs")
export const stubOutboundProvider = scaffoldProvider("stub")

export async function generateOutboundResponseWithTimeout(
  provider: VoiceAiOutboundProvider,
  context: OutboundProviderContext,
): Promise<OutboundProviderResponse> {
  const timeoutMs = VOICE_AI_OUTBOUND_PROVIDER_TIMEOUT_MS
  return Promise.race([
    provider.generateResponse(context),
    new Promise<OutboundProviderResponse>((resolve) => {
      setTimeout(() => {
        const sanitized = sanitizeOutboundResponse(buildOutboundProviderFailureFallback())
        resolve({
          spokenText: sanitized.text,
          evidenceText: `Provider timeout after ${timeoutMs}ms — latency fallback.`,
          latencyMs: timeoutMs,
          providerId: provider.id,
        })
      }, timeoutMs)
    }),
  ])
}

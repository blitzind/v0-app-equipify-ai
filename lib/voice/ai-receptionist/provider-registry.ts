/** Provider scaffolds — Phase 4A (not tightly coupled). */

import { deterministicReceptionistProvider } from "@/lib/voice/ai-receptionist/deterministic-provider"
import {
  buildProviderFailureFallbackResponse,
  sanitizeReceptionistResponse,
} from "@/lib/voice/ai-receptionist/guardrails"
import type {
  ReceptionistProviderContext,
  ReceptionistProviderResponse,
  VoiceAiReceptionistProvider,
} from "@/lib/voice/ai-receptionist/provider-types"
import { VOICE_AI_RECEPTIONIST_PROVIDER_TIMEOUT_MS } from "@/lib/voice/ai-receptionist/types"

function scaffoldProvider(id: "deepgram" | "openai_realtime" | "elevenlabs" | "stub"): VoiceAiReceptionistProvider {
  return {
    id,
    isConfigured() {
      if (id === "stub") return true
      if (id === "deepgram") return Boolean(process.env.DEEPGRAM_API_KEY)
      if (id === "openai_realtime") return Boolean(process.env.OPENAI_API_KEY)
      if (id === "elevenlabs") return Boolean(process.env.ELEVENLABS_API_KEY)
      return false
    },
    async generateResponse(context: ReceptionistProviderContext): Promise<ReceptionistProviderResponse> {
      const start = Date.now()
      if (id !== "stub" && !this.isConfigured()) {
        return deterministicReceptionistProvider.generateResponse(context)
      }
      const fallback = sanitizeReceptionistResponse(
        id === "stub"
          ? `[stub ${id}] ${context.callerText || "Hello"}`
          : buildProviderFailureFallbackResponse(),
      )
      return {
        spokenText: fallback.text,
        evidenceText: `Scaffold provider ${id} — realtime wiring pending; deterministic fallback used when unconfigured.`,
        latencyMs: Date.now() - start,
        providerId: id,
      }
    },
  }
}

export { deterministicReceptionistProvider }
export const deepgramReceptionistProvider = scaffoldProvider("deepgram")
export const openAiRealtimeReceptionistProvider = scaffoldProvider("openai_realtime")
export const elevenLabsReceptionistProvider = scaffoldProvider("elevenlabs")
export const stubReceptionistProvider = scaffoldProvider("stub")

export async function generateReceptionistResponseWithTimeout(
  provider: VoiceAiReceptionistProvider,
  context: ReceptionistProviderContext,
): Promise<ReceptionistProviderResponse> {
  const timeoutMs = VOICE_AI_RECEPTIONIST_PROVIDER_TIMEOUT_MS
  return Promise.race([
    provider.generateResponse(context),
    new Promise<ReceptionistProviderResponse>((resolve) => {
      setTimeout(() => {
        const sanitized = sanitizeReceptionistResponse(buildProviderFailureFallbackResponse())
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

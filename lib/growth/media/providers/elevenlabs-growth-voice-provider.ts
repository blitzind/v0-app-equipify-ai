import "server-only"

import {
  getGrowthElevenLabsVoiceProviderState,
  isGrowthElevenLabsVoiceEnabled,
  resolveElevenLabsApiVoiceId,
} from "@/lib/growth/media/growth-ai-voice-provider-config"
import type {
  AIVoiceGenerationRequest,
  AIVoiceGenerationResult,
  AIVoiceProvider,
  AIVoiceProviderJobStatus,
} from "@/lib/growth/media/growth-media-provider-contracts"
import { ELEVENLABS_VOICE_PROVIDER_NAME } from "@/lib/growth/media/providers/elevenlabs-voice-provider-types"

export const GROWTH_ELEVENLABS_VOICE_PROVIDER_QA_MARKER = "growth-elevenlabs-growth-voice-c1-v1" as const

const cancelledJobs = new Set<string>()

function buildVoiceStoragePath(input: { organizationId: string; runId: string }): string {
  return `organizations/${input.organizationId}/media/voice/${input.runId}/voiceover.mp3`
}

function createMockMp3Bytes(): Uint8Array {
  return Uint8Array.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x64, 0x00, 0x00,
  ])
}

async function callElevenLabsTextToSpeech(input: {
  voiceId: string
  script: string
  settings?: Record<string, unknown>
}): Promise<Uint8Array> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) throw new Error("elevenlabs_api_key_missing")

  const apiVoiceId = resolveElevenLabsApiVoiceId(input.voiceId)
  const stability = Number(input.settings?.stability ?? 0.5)
  const similarity = Number(input.settings?.similarity_boost ?? input.settings?.similarity ?? 0.75)
  const speed = Number(input.settings?.speed ?? 1.0)

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(apiVoiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.script,
      model_id: "eleven_turbo_v2",
      voice_settings: {
        stability: Math.max(0, Math.min(1, stability)),
        similarity_boost: Math.max(0, Math.min(1, similarity)),
        speed: Math.max(0.5, Math.min(2, speed)),
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`elevenlabs_tts_failed:${response.status}:${message.slice(0, 240)}`)
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

export class ElevenLabsGrowthVoiceProvider implements AIVoiceProvider {
  readonly id = ELEVENLABS_VOICE_PROVIDER_NAME
  readonly executionEnabled = isGrowthElevenLabsVoiceEnabled()

  async generateVoice(request: AIVoiceGenerationRequest): Promise<AIVoiceGenerationResult> {
    const providerJobId = request.runId
    if (cancelledJobs.has(providerJobId)) {
      throw new Error("provider_job_cancelled")
    }

    const storagePath = buildVoiceStoragePath({
      organizationId: request.organizationId,
      runId: request.runId,
    })

    const voiceId =
      typeof request.providerRequest?.voice_id === "string"
        ? request.providerRequest.voice_id
        : request.voiceId ?? "elevenlabs-voice-jordan-clone"

    if (this.executionEnabled) {
      const audioBytes = await callElevenLabsTextToSpeech({
        voiceId,
        script: request.script,
        settings: request.providerRequest ?? {},
      })
      return {
        audioStoragePath: storagePath,
        mimeType: "audio/mpeg",
        providerJobId,
        audioBytes,
        dryRun: false,
      }
    }

    return {
      audioStoragePath: storagePath,
      mimeType: "audio/mpeg",
      providerJobId,
      audioBytes: createMockMp3Bytes(),
      dryRun: true,
    }
  }

  async getGenerationStatus(providerJobId: string): Promise<AIVoiceProviderJobStatus> {
    if (cancelledJobs.has(providerJobId)) {
      return { providerJobId, status: "cancelled", progress: 0, error: "cancelled" }
    }
    return { providerJobId, status: "completed", progress: 100, outputUrl: null }
  }

  async cancelGeneration(providerJobId: string): Promise<AIVoiceProviderJobStatus> {
    cancelledJobs.add(providerJobId)
    return { providerJobId, status: "cancelled", progress: 0, error: "cancelled" }
  }
}

let defaultProvider: ElevenLabsGrowthVoiceProvider | null = null

export function getElevenLabsGrowthVoiceProvider(): ElevenLabsGrowthVoiceProvider {
  if (!defaultProvider) {
    defaultProvider = new ElevenLabsGrowthVoiceProvider()
  }
  return defaultProvider
}

export function getElevenLabsGrowthVoiceProviderCapabilities() {
  const state = getGrowthElevenLabsVoiceProviderState()
  return {
    ...state,
    qaMarker: GROWTH_ELEVENLABS_VOICE_PROVIDER_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
  }
}

export function resetElevenLabsGrowthVoiceProviderStateForCert(): void {
  cancelledJobs.clear()
  defaultProvider = null
}

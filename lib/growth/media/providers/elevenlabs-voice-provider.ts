import "server-only"

import type { GrowthMediaVoiceGenerationStatus } from "@/lib/growth/media/media-voice-generation-types"
import { GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS } from "@/lib/growth/media/media-voice-generation-types"
import {
  ELEVENLABS_VOICE_PROVIDER_NAME,
  ELEVENLABS_VOICE_PROVIDER_QA_MARKER,
  type ElevenLabsVoiceProviderCapabilities,
  type ElevenLabsVoiceProviderJobRequest,
  type ElevenLabsVoiceProviderJobSnapshot,
  type ElevenLabsVoiceProviderStatus,
} from "@/lib/growth/media/providers/elevenlabs-voice-provider-types"

export class ElevenLabsVoiceProviderExecutionDisabledError extends Error {
  constructor() {
    super("provider_execution_disabled")
    this.name = "ElevenLabsVoiceProviderExecutionDisabledError"
  }
}

export function getElevenLabsVoiceProviderCapabilities(): ElevenLabsVoiceProviderCapabilities {
  return {
    provider: ELEVENLABS_VOICE_PROVIDER_NAME,
    executionEnabled: false,
    supportsPolling: true,
    supportsWebhooks: false,
    qaMarker: ELEVENLABS_VOICE_PROVIDER_QA_MARKER,
    ...GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
  }
}

export function assertElevenLabsVoiceProviderExecutionDisabled(): void {
  if (getElevenLabsVoiceProviderCapabilities().executionEnabled) {
    throw new ElevenLabsVoiceProviderExecutionDisabledError()
  }
}

export function createElevenLabsVoiceProviderJob(
  _request: ElevenLabsVoiceProviderJobRequest,
): ElevenLabsVoiceProviderJobSnapshot {
  assertElevenLabsVoiceProviderExecutionDisabled()
  throw new ElevenLabsVoiceProviderExecutionDisabledError()
}

export function pollElevenLabsVoiceProviderJob(
  _providerJobId: string,
): ElevenLabsVoiceProviderJobSnapshot {
  assertElevenLabsVoiceProviderExecutionDisabled()
  throw new ElevenLabsVoiceProviderExecutionDisabledError()
}

export function cancelElevenLabsVoiceProviderJob(_providerJobId: string): ElevenLabsVoiceProviderJobSnapshot {
  assertElevenLabsVoiceProviderExecutionDisabled()
  throw new ElevenLabsVoiceProviderExecutionDisabledError()
}

export function mapElevenLabsVoiceProviderStatusToGenerationStatus(
  status: ElevenLabsVoiceProviderStatus,
): GrowthMediaVoiceGenerationStatus {
  switch (status) {
    case "pending":
      return "queued"
    case "processing":
      return "processing"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    case "cancelled":
      return "cancelled"
    default:
      return "draft"
  }
}

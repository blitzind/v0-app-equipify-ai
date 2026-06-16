import "server-only"

import type { GrowthMediaVideoGenerationStatus } from "@/lib/growth/media/media-video-generation-types"
import { GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS } from "@/lib/growth/media/media-video-generation-types"
import {
  ELEVENLABS_VIDEO_PROVIDER_NAME,
  ELEVENLABS_VIDEO_PROVIDER_QA_MARKER,
  type ElevenLabsVideoProviderCapabilities,
  type ElevenLabsVideoProviderJobRequest,
  type ElevenLabsVideoProviderJobSnapshot,
  type ElevenLabsVideoProviderStatus,
} from "@/lib/growth/media/providers/elevenlabs-video-provider-types"

export class ElevenLabsVideoProviderExecutionDisabledError extends Error {
  constructor() {
    super("provider_execution_disabled")
    this.name = "ElevenLabsVideoProviderExecutionDisabledError"
  }
}

export function getElevenLabsVideoProviderCapabilities(): ElevenLabsVideoProviderCapabilities {
  return {
    provider: ELEVENLABS_VIDEO_PROVIDER_NAME,
    executionEnabled: false,
    supportsPolling: true,
    supportsWebhooks: false,
    qaMarker: ELEVENLABS_VIDEO_PROVIDER_QA_MARKER,
    ...GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
  }
}

export function assertElevenLabsProviderExecutionDisabled(): void {
  if (getElevenLabsVideoProviderCapabilities().executionEnabled) {
    throw new ElevenLabsVideoProviderExecutionDisabledError()
  }
}

export function createElevenLabsVideoProviderJob(
  _request: ElevenLabsVideoProviderJobRequest,
): ElevenLabsVideoProviderJobSnapshot {
  assertElevenLabsProviderExecutionDisabled()
  throw new ElevenLabsVideoProviderExecutionDisabledError()
}

export function pollElevenLabsVideoProviderJob(
  _providerJobId: string,
): ElevenLabsVideoProviderJobSnapshot {
  assertElevenLabsProviderExecutionDisabled()
  throw new ElevenLabsVideoProviderExecutionDisabledError()
}

export function cancelElevenLabsVideoProviderJob(_providerJobId: string): ElevenLabsVideoProviderJobSnapshot {
  assertElevenLabsProviderExecutionDisabled()
  throw new ElevenLabsVideoProviderExecutionDisabledError()
}

export function mapElevenLabsProviderStatusToGenerationStatus(
  status: ElevenLabsVideoProviderStatus,
): GrowthMediaVideoGenerationStatus {
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

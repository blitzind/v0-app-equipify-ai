import "server-only"

import {
  getGrowthRetellAvatarProviderState,
  isGrowthRetellAvatarEnabled,
} from "@/lib/growth/media/growth-ai-avatar-provider-config"
import type {
  AIAvatarGenerationRequest,
  AIAvatarGenerationResult,
  AIAvatarProvider,
  AIAvatarProviderJobStatus,
} from "@/lib/growth/media/growth-media-provider-contracts"
import { RETELL_VIDEO_AGENT_PROVIDER_NAME } from "@/lib/growth/media/providers/retell-video-agent-provider-types"

export const GROWTH_RETELL_AVATAR_PROVIDER_QA_MARKER = "growth-retell-growth-avatar-c2-v1" as const

const cancelledJobs = new Set<string>()

function buildAvatarStoragePath(input: { organizationId: string; runId: string }): string {
  return `organizations/${input.organizationId}/media/avatar/${input.runId}/avatar.mp4`
}

function createMockMp4Bytes(): Uint8Array {
  return Uint8Array.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08,
    0x66, 0x72, 0x65, 0x65,
  ])
}

async function callRetellAvatarVideo(input: {
  avatarId: string
  script: string
  voiceMediaAssetId?: string | null
  settings?: Record<string, unknown>
}): Promise<Uint8Array> {
  const apiKey = process.env.RETELL_API_KEY?.trim()
  if (!apiKey) throw new Error("retell_api_key_missing")

  const response = await fetch("https://api.retellai.com/v2/create-video-avatar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "video/mp4",
    },
    body: JSON.stringify({
      avatar_id: input.avatarId,
      script: input.script,
      voice_media_asset_id: input.voiceMediaAssetId ?? undefined,
      resolution: input.settings?.resolution ?? "1280x720",
      theme: input.settings?.theme ?? "inherit_page_branding",
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`retell_avatar_failed:${response.status}:${message.slice(0, 240)}`)
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

export class RetellGrowthAvatarProvider implements AIAvatarProvider {
  readonly id = RETELL_VIDEO_AGENT_PROVIDER_NAME
  readonly executionEnabled = isGrowthRetellAvatarEnabled()

  async generateAvatarVideo(request: AIAvatarGenerationRequest): Promise<AIAvatarGenerationResult> {
    const providerJobId = request.runId
    if (cancelledJobs.has(providerJobId)) {
      throw new Error("provider_job_cancelled")
    }

    const storagePath = buildAvatarStoragePath({
      organizationId: request.organizationId,
      runId: request.runId,
    })

    const avatarId =
      typeof request.providerRequest?.avatar_id === "string"
        ? request.providerRequest.avatar_id
        : request.avatarId ?? "retell-avatar-jordan"

    if (this.executionEnabled) {
      const videoBytes = await callRetellAvatarVideo({
        avatarId,
        script: request.script,
        voiceMediaAssetId:
          typeof request.providerRequest?.voice_media_asset_id === "string"
            ? request.providerRequest.voice_media_asset_id
            : null,
        settings: request.providerRequest ?? {},
      })
      return {
        videoStoragePath: storagePath,
        mimeType: "video/mp4",
        providerJobId,
        videoBytes,
        dryRun: false,
      }
    }

    return {
      videoStoragePath: storagePath,
      mimeType: "video/mp4",
      providerJobId,
      videoBytes: createMockMp4Bytes(),
      dryRun: true,
    }
  }

  async getGenerationStatus(providerJobId: string): Promise<AIAvatarProviderJobStatus> {
    if (cancelledJobs.has(providerJobId)) {
      return { providerJobId, status: "cancelled", progress: 0, error: "cancelled" }
    }
    return { providerJobId, status: "completed", progress: 100, outputUrl: null }
  }

  async cancelGeneration(providerJobId: string): Promise<AIAvatarProviderJobStatus> {
    cancelledJobs.add(providerJobId)
    return { providerJobId, status: "cancelled", progress: 0, error: "cancelled" }
  }
}

let defaultProvider: RetellGrowthAvatarProvider | null = null

export function getRetellGrowthAvatarProvider(): RetellGrowthAvatarProvider {
  if (!defaultProvider) {
    defaultProvider = new RetellGrowthAvatarProvider()
  }
  return defaultProvider
}

export function getRetellGrowthAvatarProviderCapabilities() {
  const state = getGrowthRetellAvatarProviderState()
  return {
    ...state,
    qaMarker: GROWTH_RETELL_AVATAR_PROVIDER_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
  }
}

export function resetRetellGrowthAvatarProviderStateForCert(): void {
  cancelledJobs.clear()
  defaultProvider = null
}

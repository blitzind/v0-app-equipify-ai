/** Growth Engine C3 — Future provider execution contracts (interfaces only). */

import type {
  GrowthMediaGenerationMetadataHooks,
  GrowthMediaGenerationProgressEvent,
  GrowthMediaGenerationRunInput,
  GrowthMediaGenerationType,
} from "@/lib/growth/media/growth-media-generation-types"

export type AIVoiceGenerationRequest = {
  organizationId: string
  runId: string
  script: string
  voiceId?: string | null
  metadataHooks?: GrowthMediaGenerationMetadataHooks
  providerRequest?: Record<string, unknown>
}

export type AIVoiceGenerationResult = {
  audioStoragePath: string
  mimeType: string
  durationSeconds?: number | null
  providerJobId?: string | null
  audioBytes?: Uint8Array | null
  dryRun?: boolean
}

export type AIVoiceProviderJobStatus = {
  providerJobId: string
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  progress: number
  outputUrl?: string | null
  error?: string | null
}

export interface AIVoiceProvider {
  readonly id: string
  readonly executionEnabled: boolean
  generateVoice(_request: AIVoiceGenerationRequest): Promise<AIVoiceGenerationResult>
  getGenerationStatus(_providerJobId: string): Promise<AIVoiceProviderJobStatus>
  cancelGeneration(_providerJobId: string): Promise<AIVoiceProviderJobStatus>
}

export type AIAvatarGenerationRequest = {
  organizationId: string
  runId: string
  script: string
  avatarId?: string | null
  metadataHooks?: GrowthMediaGenerationMetadataHooks
  providerRequest?: Record<string, unknown>
}

export type AIAvatarGenerationResult = {
  videoStoragePath: string
  mimeType: string
  durationSeconds?: number | null
  providerJobId?: string | null
  videoBytes?: Uint8Array | null
  dryRun?: boolean
}

export type AIAvatarProviderJobStatus = {
  providerJobId: string
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  progress: number
  outputUrl?: string | null
  error?: string | null
}

export interface AIAvatarProvider {
  readonly id: string
  readonly executionEnabled: boolean
  generateAvatarVideo(_request: AIAvatarGenerationRequest): Promise<AIAvatarGenerationResult>
  getGenerationStatus(_providerJobId: string): Promise<AIAvatarProviderJobStatus>
  cancelGeneration(_providerJobId: string): Promise<AIAvatarProviderJobStatus>
}

export type AIVideoGenerationRequest = {
  organizationId: string
  runId: string
  generationType: Extract<GrowthMediaGenerationType, "text_to_video" | "video_render">
  prompt: string
  metadataHooks?: GrowthMediaGenerationMetadataHooks
  providerRequest?: Record<string, unknown>
}

export type AIVideoGenerationResult = {
  videoStoragePath: string
  mimeType: string
  durationSeconds?: number | null
  providerJobId?: string | null
}

export interface AIVideoProvider {
  readonly id: string
  readonly executionEnabled: false
  generateVideo(_request: AIVideoGenerationRequest): Promise<AIVideoGenerationResult>
}

export type AIMediaStorageWritebackRequest = {
  organizationId: string
  runId: string
  generationType: GrowthMediaGenerationType
  storagePath: string
  mimeType: string
  fileSizeBytes?: number | null
  metadataHooks?: GrowthMediaGenerationMetadataHooks
  analyticsHooks?: Record<string, unknown> | null
}

export type AIMediaStorageWritebackResult = {
  assetId: string | null
  storagePath: string
  signedUrl?: string | null
}

export interface AIMediaStorageProvider {
  readonly id: string
  writebackGeneratedMedia(_request: AIMediaStorageWritebackRequest): Promise<AIMediaStorageWritebackResult>
}

export type AIMediaGenerationWorkerContext = {
  runId: string
  aiJobId: string
  organizationId: string
  input: GrowthMediaGenerationRunInput
  onProgress: (event: GrowthMediaGenerationProgressEvent) => Promise<void>
}

export const GROWTH_MEDIA_PROVIDER_CONTRACTS_QA_MARKER = "growth-media-provider-contracts-c3-v1" as const

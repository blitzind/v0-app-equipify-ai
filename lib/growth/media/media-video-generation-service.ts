import "server-only"

import { randomUUID } from "node:crypto"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import { validateMediaAvatarId } from "@/lib/growth/media/media-avatar-types"
import {
  mapElevenLabsProviderStatusToGenerationStatus,
} from "@/lib/growth/media/providers/elevenlabs-video-provider"
import type { ElevenLabsVideoProviderStatus } from "@/lib/growth/media/providers/elevenlabs-video-provider-types"
import {
  GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
  type GrowthMediaVideoGenerationCreateInput,
  type GrowthMediaVideoGenerationRecord,
  type GrowthMediaVideoGenerationStatus,
} from "@/lib/growth/media/media-video-generation-types"
import { buildPersonalizedScriptPreview } from "@/lib/growth/media/media-video-generation-utils"

export { buildPersonalizedScriptPreview } from "@/lib/growth/media/media-video-generation-utils"

const generationStore = new Map<string, GrowthMediaVideoGenerationRecord>()

function nowIso(): string {
  return new Date().toISOString()
}

export function resetMediaVideoGenerationStoreForCert(): void {
  generationStore.clear()
}

export function mapProviderStatus(providerStatus: ElevenLabsVideoProviderStatus): GrowthMediaVideoGenerationStatus {
  return mapElevenLabsProviderStatusToGenerationStatus(providerStatus)
}

export function createGenerationRequest(
  input: GrowthMediaVideoGenerationCreateInput,
): GrowthMediaVideoGenerationRecord {
  if (!input.organizationId.trim()) throw new Error("organization_id_required")
  if (!input.scriptTemplate.trim()) throw new Error("script_template_required")
  if (input.avatarId && !validateMediaAvatarId(input.avatarId)) throw new Error("invalid_avatar_id")

  const timestamp = nowIso()
  const record: GrowthMediaVideoGenerationRecord = {
    generationId: randomUUID(),
    organizationId: input.organizationId,
    provider: "elevenlabs",
    status: "draft",
    templateAssetId: input.templateAssetId ?? null,
    outputAssetId: null,
    avatarId: input.avatarId ?? null,
    scriptTemplate: input.scriptTemplate.trim(),
    mergeFieldsUsed: extractContentMergeFields(input.scriptTemplate),
    personalizationContext: input.personalizationContext ?? {},
    durationSeconds: null,
    progress: 0,
    providerJobId: null,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  generationStore.set(record.generationId, record)
  return record
}

export function queueGeneration(generationId: string): GrowthMediaVideoGenerationRecord {
  const record = getGenerationRecordOrThrow(generationId)
  if (record.status !== "draft") throw new Error("invalid_status_transition")
  if (!record.avatarId || !validateMediaAvatarId(record.avatarId)) throw new Error("avatar_id_required")

  const updated: GrowthMediaVideoGenerationRecord = {
    ...record,
    status: "queued",
    progress: 0,
    updatedAt: nowIso(),
  }
  generationStore.set(updated.generationId, updated)
  return updated
}

export function getGenerationStatus(
  generationId: string,
  organizationId: string,
): GrowthMediaVideoGenerationRecord {
  const record = getGenerationRecordOrThrow(generationId)
  if (record.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
  return record
}

export function cancelGeneration(
  generationId: string,
  organizationId: string,
): GrowthMediaVideoGenerationRecord {
  const record = getGenerationStatus(generationId, organizationId)
  if (record.status === "completed" || record.status === "failed" || record.status === "cancelled") {
    throw new Error("invalid_status_transition")
  }

  const updated: GrowthMediaVideoGenerationRecord = {
    ...record,
    status: "cancelled",
    progress: record.progress,
    updatedAt: nowIso(),
  }
  generationStore.set(updated.generationId, updated)
  return updated
}

function getGenerationRecordOrThrow(generationId: string): GrowthMediaVideoGenerationRecord {
  const record = generationStore.get(generationId)
  if (!record) throw new Error("generation_not_found")
  return record
}

export function toGrowthMediaVideoGenerationResponse(record: GrowthMediaVideoGenerationRecord) {
  return {
    ok: true as const,
    generation: record,
    preview: buildPersonalizedScriptPreview({
      scriptTemplate: record.scriptTemplate,
      personalizationContext: record.personalizationContext,
    }),
    ...GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS,
  }
}

import "server-only"

import { randomUUID } from "node:crypto"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import { validateMediaVoiceId } from "@/lib/growth/media/media-voice-types"
import {
  mapElevenLabsVoiceProviderStatusToGenerationStatus,
} from "@/lib/growth/media/providers/elevenlabs-voice-provider"
import type { ElevenLabsVoiceProviderStatus } from "@/lib/growth/media/providers/elevenlabs-voice-provider-types"
import {
  GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
  type GrowthMediaVoiceGenerationCreateInput,
  type GrowthMediaVoiceGenerationRecord,
  type GrowthMediaVoiceGenerationStatus,
} from "@/lib/growth/media/media-voice-generation-types"
import { buildPersonalizedVoiceScriptPreview } from "@/lib/growth/media/media-voice-generation-utils"

export { buildPersonalizedVoiceScriptPreview } from "@/lib/growth/media/media-voice-generation-utils"

const generationStore = new Map<string, GrowthMediaVoiceGenerationRecord>()

function nowIso(): string {
  return new Date().toISOString()
}

export function resetMediaVoiceGenerationStoreForCert(): void {
  generationStore.clear()
}

export function mapProviderStatus(providerStatus: ElevenLabsVoiceProviderStatus): GrowthMediaVoiceGenerationStatus {
  return mapElevenLabsVoiceProviderStatusToGenerationStatus(providerStatus)
}

export function createGenerationRequest(
  input: GrowthMediaVoiceGenerationCreateInput,
): GrowthMediaVoiceGenerationRecord {
  if (!input.organizationId.trim()) throw new Error("organization_id_required")
  if (!input.scriptTemplate.trim()) throw new Error("script_template_required")
  if (input.voiceId && !validateMediaVoiceId(input.voiceId)) throw new Error("invalid_voice_id")

  const timestamp = nowIso()
  const record: GrowthMediaVoiceGenerationRecord = {
    generationId: randomUUID(),
    organizationId: input.organizationId,
    provider: "elevenlabs",
    status: "draft",
    templateAssetId: input.templateAssetId ?? null,
    outputAssetId: null,
    voiceId: input.voiceId ?? null,
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

export function queueGeneration(generationId: string): GrowthMediaVoiceGenerationRecord {
  const record = getGenerationRecordOrThrow(generationId)
  if (record.status !== "draft") throw new Error("invalid_status_transition")
  if (!record.voiceId || !validateMediaVoiceId(record.voiceId)) throw new Error("voice_id_required")

  const updated: GrowthMediaVoiceGenerationRecord = {
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
): GrowthMediaVoiceGenerationRecord {
  const record = getGenerationRecordOrThrow(generationId)
  if (record.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
  return record
}

export function cancelGeneration(
  generationId: string,
  organizationId: string,
): GrowthMediaVoiceGenerationRecord {
  const record = getGenerationStatus(generationId, organizationId)
  if (record.status === "completed" || record.status === "failed" || record.status === "cancelled") {
    throw new Error("invalid_status_transition")
  }

  const updated: GrowthMediaVoiceGenerationRecord = {
    ...record,
    status: "cancelled",
    progress: record.progress,
    updatedAt: nowIso(),
  }
  generationStore.set(updated.generationId, updated)
  return updated
}

function getGenerationRecordOrThrow(generationId: string): GrowthMediaVoiceGenerationRecord {
  const record = generationStore.get(generationId)
  if (!record) throw new Error("generation_not_found")
  return record
}

export function toGrowthMediaVoiceGenerationResponse(record: GrowthMediaVoiceGenerationRecord) {
  return {
    ok: true as const,
    generation: record,
    preview: buildPersonalizedVoiceScriptPreview({
      scriptTemplate: record.scriptTemplate,
      personalizationContext: record.personalizationContext,
    }),
    ...GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
  }
}

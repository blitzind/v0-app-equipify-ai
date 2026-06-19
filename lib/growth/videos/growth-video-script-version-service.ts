/** Growth Engine B4 — Script version metadata helpers (client-safe). */

import { normalizeGrowthVideoScriptGenerationInput } from "@/lib/growth/videos/growth-video-script-prompt-service"
import type {
  GrowthVideoScriptAiPayload,
  GrowthVideoScriptB4Metadata,
  GrowthVideoScriptGeneratedOutput,
  GrowthVideoScriptGenerationInput,
  GrowthVideoScriptVersion,
} from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY = "growth_video_scripts_b4"

const MAX_VERSIONS = 20

function createVersionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `gvscript_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function asVersion(row: unknown): GrowthVideoScriptVersion | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== "string" || typeof record.createdAt !== "string") return null
  if (!record.input || typeof record.input !== "object") return null
  if (!record.output || typeof record.output !== "object") return null
  return {
    id: record.id,
    createdAt: record.createdAt,
    input: normalizeGrowthVideoScriptGenerationInput(
      record.input as GrowthVideoScriptGenerationInput,
    ),
    output: record.output as GrowthVideoScriptGeneratedOutput,
    provider: typeof record.provider === "string" ? record.provider : "unknown",
    model: typeof record.model === "string" ? record.model : null,
  }
}

export function parseGrowthVideoScriptMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthVideoScriptB4Metadata {
  const raw = metadata?.[GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY]
  if (!raw || typeof raw !== "object") {
    return emptyGrowthVideoScriptMetadata()
  }

  const row = raw as Record<string, unknown>
  const versions = Array.isArray(row.versions)
    ? row.versions.map(asVersion).filter((entry): entry is GrowthVideoScriptVersion => Boolean(entry))
    : []

  return {
    current_version_id:
      typeof row.current_version_id === "string" ? row.current_version_id : versions[0]?.id ?? null,
    versions,
    aiPayload:
      row.aiPayload && typeof row.aiPayload === "object"
        ? (row.aiPayload as GrowthVideoScriptAiPayload)
        : null,
    sources_used: Array.isArray(row.sources_used)
      ? row.sources_used.filter((entry): entry is string => typeof entry === "string")
      : [],
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function emptyGrowthVideoScriptMetadata(): GrowthVideoScriptB4Metadata {
  return {
    current_version_id: null,
    versions: [],
    aiPayload: null,
    sources_used: [],
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function getCurrentGrowthVideoScriptVersion(
  metadata: GrowthVideoScriptB4Metadata,
): GrowthVideoScriptVersion | null {
  if (!metadata.current_version_id) return metadata.versions[0] ?? null
  return metadata.versions.find((version) => version.id === metadata.current_version_id) ?? null
}

export function appendGrowthVideoScriptVersion(input: {
  existing: GrowthVideoScriptB4Metadata
  generationInput: GrowthVideoScriptGenerationInput
  output: GrowthVideoScriptGeneratedOutput
  aiPayload: GrowthVideoScriptAiPayload
  provider: string
  model?: string | null
}): GrowthVideoScriptB4Metadata {
  const version: GrowthVideoScriptVersion = {
    id: createVersionId(),
    createdAt: new Date().toISOString(),
    input: normalizeGrowthVideoScriptGenerationInput(input.generationInput),
    output: input.output,
    provider: input.provider,
    model: input.model ?? null,
  }

  const versions = [version, ...input.existing.versions].slice(0, MAX_VERSIONS)

  return {
    current_version_id: version.id,
    versions,
    aiPayload: input.aiPayload,
    sources_used: input.output.sources_used,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function patchGrowthVideoScriptMetadata(input: {
  existing: GrowthVideoScriptB4Metadata
  currentVersionId?: string | null
  aiPayload?: GrowthVideoScriptAiPayload | null
}): GrowthVideoScriptB4Metadata {
  const nextCurrent =
    input.currentVersionId !== undefined
      ? input.currentVersionId
      : input.existing.current_version_id

  if (
    nextCurrent &&
    !input.existing.versions.some((version) => version.id === nextCurrent)
  ) {
    throw new Error("invalid_version_id")
  }

  return {
    ...input.existing,
    current_version_id: nextCurrent ?? null,
    aiPayload: input.aiPayload !== undefined ? input.aiPayload : input.existing.aiPayload,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export function serializeGrowthVideoScriptMetadata(
  metadata: GrowthVideoScriptB4Metadata,
): Record<string, unknown> {
  return {
    [GROWTH_VIDEO_SCRIPT_B4_METADATA_KEY]: metadata,
  }
}

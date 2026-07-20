/** GE-AIOS-LIVE-1B — Canonical missionPurpose authority (client-safe). */

import type { GrowthObjective, GrowthObjectiveExecutionContext } from "@/lib/growth/objectives/growth-objective-types"
import { GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import {
  GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
  GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
  GROWTH_MISSION_PURPOSE_METADATA_KEY,
  GROWTH_MISSION_PURPOSE_MIGRATED_AT_METADATA_KEY,
  GROWTH_MISSION_PURPOSE_MIGRATION_MARKER_METADATA_KEY,
  type GrowthMissionPurpose,
  type GrowthMissionPurposeResolution,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { normalizeGrowthMissionPurpose } from "@/lib/growth/mission-purpose/growth-mission-purpose-inference-1a"

export {
  GROWTH_MISSION_PURPOSE_METADATA_KEY,
  GROWTH_MISSION_PURPOSE_MIGRATED_AT_METADATA_KEY,
  GROWTH_MISSION_PURPOSE_MIGRATION_MARKER_METADATA_KEY,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"

function asMetadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

export function readCanonicalLeadMissionPurpose(metadata: unknown): GrowthMissionPurpose | null {
  return normalizeGrowthMissionPurpose(asMetadataRecord(metadata)[GROWTH_MISSION_PURPOSE_METADATA_KEY])
}

export function readCanonicalObjectiveMissionPurpose(
  executionContext: GrowthObjectiveExecutionContext | null | undefined,
): GrowthMissionPurpose | null {
  return normalizeGrowthMissionPurpose(executionContext?.missionPurpose)
}

export function applyCanonicalLeadMissionPurposeMetadata(
  metadata: Record<string, unknown> | null | undefined,
  purpose: GrowthMissionPurpose,
  input?: {
    migratedAt?: string | null
    migrationMarker?: string | null
  },
): Record<string, unknown> {
  const base = asMetadataRecord(metadata)
  return {
    ...base,
    [GROWTH_MISSION_PURPOSE_METADATA_KEY]: purpose,
    ...(input?.migratedAt
      ? {
          [GROWTH_MISSION_PURPOSE_MIGRATED_AT_METADATA_KEY]: input.migratedAt,
          [GROWTH_MISSION_PURPOSE_MIGRATION_MARKER_METADATA_KEY]:
            input.migrationMarker ?? GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
        }
      : {}),
  }
}

export function buildDefaultProductionLeadMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = asMetadataRecord(metadata)
  if (readCanonicalLeadMissionPurpose(base)) return base
  return applyCanonicalLeadMissionPurposeMetadata(base, "production")
}

export function buildDefaultProductionObjectiveExecutionContext(
  existing?: GrowthObjectiveExecutionContext | null,
): GrowthObjectiveExecutionContext {
  if (existing?.missionPurpose) return existing
  return {
    qa_marker: existing?.qa_marker ?? GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
    version: existing?.version ?? 1,
    stages: existing?.stages ?? {},
    recoveredAt: existing?.recoveredAt ?? null,
    missionRuntime: existing?.missionRuntime ?? null,
    missionPurpose: "production",
  }
}

export function buildObjectiveExecutionContextWithMissionPurpose(input: {
  purpose: GrowthMissionPurpose
  existing?: GrowthObjectiveExecutionContext | null
}): GrowthObjectiveExecutionContext {
  const base = input.existing ?? buildDefaultProductionObjectiveExecutionContext(null)
  return {
    ...base,
    missionPurpose: input.purpose,
  }
}

export function resolveLeadMissionPurposeForOperations(input: {
  lead: Pick<GrowthLeadLike, "metadata">
}): GrowthMissionPurposeResolution {
  const canonical = readCanonicalLeadMissionPurpose(input.lead.metadata)
  if (canonical) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: canonical,
      source: "canonical_persisted",
      reason: `${GROWTH_MISSION_PURPOSE_METADATA_KEY}=${canonical}`,
    }
  }

  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purpose: "production",
    source: "default_production",
    reason: "canonical missionPurpose missing — default production until migration completes",
  }
}

export function resolveObjectiveMissionPurposeForOperations(
  objective: GrowthObjective,
): GrowthMissionPurposeResolution {
  const canonical = readCanonicalObjectiveMissionPurpose(objective.executionContext)
  if (canonical) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: canonical,
      source: "canonical_persisted",
      reason: "executionContext.missionPurpose",
    }
  }

  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purpose: "production",
    source: "default_production",
    reason: "canonical missionPurpose missing — default production until migration completes",
  }
}

export function isProductionMissionPurpose(purpose: GrowthMissionPurpose): boolean {
  return purpose === "production"
}

export function isOperationalMissionPurpose(
  purpose: GrowthMissionPurpose,
  scope: "operations" | "diagnostics" | "all" = "operations",
): boolean {
  if (scope === "all") return true
  if (scope === "diagnostics") return true
  return purpose === "production"
}

type GrowthLeadLike = {
  metadata?: Record<string, unknown> | null
}

export const GE_AIOS_LIVE_1B_CANONICAL_MISSION_PURPOSE_QA_MARKER = GROWTH_MISSION_PURPOSE_1B_QA_MARKER

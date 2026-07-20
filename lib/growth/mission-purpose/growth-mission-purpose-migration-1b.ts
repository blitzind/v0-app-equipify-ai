/** GE-AIOS-LIVE-1B — Persist canonical missionPurpose on first encounter (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mergeGrowthLeadMetadata, updateGrowthLead } from "@/lib/growth/lead-repository"
import { updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import {
  applyCanonicalLeadMissionPurposeMetadata,
  buildObjectiveExecutionContextWithMissionPurpose,
  readCanonicalLeadMissionPurpose,
  readCanonicalObjectiveMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  inferLeadMissionPurposeForMigration,
  inferObjectiveMissionPurposeForMigration,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a"
import {
  GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
  type GrowthMissionPurpose,
  type GrowthMissionPurposeResolutionContext,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthLead } from "@/lib/growth/types"

export type GrowthMissionPurposeMigrationResult = {
  qaMarker: typeof GROWTH_MISSION_PURPOSE_1B_QA_MARKER
  purpose: GrowthMissionPurpose
  migrated: boolean
  changed: boolean
}

export async function ensureCanonicalLeadMissionPurpose(
  admin: SupabaseClient,
  input: {
    lead: GrowthLead
    context: GrowthMissionPurposeResolutionContext
    generatedAt?: string
  },
): Promise<{ lead: GrowthLead; result: GrowthMissionPurposeMigrationResult }> {
  const existing = readCanonicalLeadMissionPurpose(input.lead.metadata)
  if (existing) {
    return {
      lead: input.lead,
      result: {
        qaMarker: GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
        purpose: existing,
        migrated: false,
        changed: false,
      },
    }
  }

  const inferred = inferLeadMissionPurposeForMigration({
    lead: input.lead,
    context: input.context,
  })
  const migratedAt = input.generatedAt ?? new Date().toISOString()
  const metadata = applyCanonicalLeadMissionPurposeMetadata(input.lead.metadata, inferred.purpose, {
    migratedAt,
    migrationMarker: GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
  })

  const updated = await updateGrowthLead(admin, input.lead.id, { metadata })
  return {
    lead: updated ?? { ...input.lead, metadata },
    result: {
      qaMarker: GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
      purpose: inferred.purpose,
      migrated: true,
      changed: true,
    },
  }
}

export async function ensureCanonicalLeadMissionPurposes(
  admin: SupabaseClient,
  input: {
    leads: GrowthLead[]
    context: GrowthMissionPurposeResolutionContext
    generatedAt?: string
  },
): Promise<{ leads: GrowthLead[]; migratedCount: number; changedCount: number }> {
  const leads: GrowthLead[] = []
  let migratedCount = 0
  let changedCount = 0

  for (const lead of input.leads) {
    const ensured = await ensureCanonicalLeadMissionPurpose(admin, {
      lead,
      context: input.context,
      generatedAt: input.generatedAt,
    })
    leads.push(ensured.lead)
    if (ensured.result.migrated) migratedCount += 1
    if (ensured.result.changed) changedCount += 1
  }

  return { leads, migratedCount, changedCount }
}

export async function ensureCanonicalObjectiveMissionPurpose(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objective: GrowthObjective
    generatedAt?: string
  },
): Promise<{ objective: GrowthObjective; result: GrowthMissionPurposeMigrationResult }> {
  const existing = readCanonicalObjectiveMissionPurpose(input.objective.executionContext)
  if (existing) {
    return {
      objective: input.objective,
      result: {
        qaMarker: GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
        purpose: existing,
        migrated: false,
        changed: false,
      },
    }
  }

  const inferred = inferObjectiveMissionPurposeForMigration(input.objective)
  const executionContext = buildObjectiveExecutionContextWithMissionPurpose({
    purpose: inferred.purpose,
    existing: input.objective.executionContext,
  })

  const updated = await updateGrowthObjective(admin, input.organizationId, input.objective.id, {
    executionContext,
  })

  return {
    objective: updated,
    result: {
      qaMarker: GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
      purpose: inferred.purpose,
      migrated: true,
      changed: true,
    },
  }
}

export async function ensureCanonicalObjectiveMissionPurposes(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objectives: GrowthObjective[]
    generatedAt?: string
  },
): Promise<{ objectives: GrowthObjective[]; migratedCount: number; changedCount: number }> {
  const objectives: GrowthObjective[] = []
  let migratedCount = 0
  let changedCount = 0

  for (const objective of input.objectives) {
    const ensured = await ensureCanonicalObjectiveMissionPurpose(admin, {
      organizationId: input.organizationId,
      objective,
      generatedAt: input.generatedAt,
    })
    objectives.push(ensured.objective)
    if (ensured.result.migrated) migratedCount += 1
    if (ensured.result.changed) changedCount += 1
  }

  return { objectives, migratedCount, changedCount }
}

/** Idempotent metadata merge for tests and non-DB callers. */
export function mergeCanonicalLeadMissionPurposeMetadata(input: {
  metadata: Record<string, unknown> | null | undefined
  purpose: GrowthMissionPurpose
  generatedAt?: string
}): Record<string, unknown> {
  const existing = readCanonicalLeadMissionPurpose(input.metadata)
  if (existing) {
    return mergeGrowthLeadMetadata(input.metadata, {})
  }
  return applyCanonicalLeadMissionPurposeMetadata(input.metadata, input.purpose, {
    migratedAt: input.generatedAt ?? new Date().toISOString(),
    migrationMarker: GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
  })
}

export const GE_AIOS_LIVE_1B_MISSION_PURPOSE_MIGRATION_QA_MARKER = GROWTH_MISSION_PURPOSE_1B_QA_MARKER

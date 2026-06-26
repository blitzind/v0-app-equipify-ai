/** GE-AIOS-2F — Memory Registry schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_MEMORY_REGISTRY_QA_MARKER } from "@/lib/growth/aios/ai-memory-registry-types"

export const GROWTH_AI_MEMORY_REGISTRY_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2f-memory-registry-schema-health-v1" as const

export const GROWTH_AI_MEMORY_REGISTRY_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_memory_registry",
    columns: [
      "id",
      "organization_id",
      "mission_id",
      "memory_type",
      "owner_agent",
      "source_system",
      "source_table",
      "source_record_id",
      "lifecycle_status",
      "created_at",
    ],
    label: "AI Memory Registry",
  },
  {
    table: "ai_memory_registry_events",
    columns: ["id", "memory_registry_id", "organization_id", "event_type", "created_at"],
    label: "AI Memory Registry audit events",
  },
]

export async function probeGrowthAiMemoryRegistrySchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-memory-registry",
    featureLabel: "GE-AIOS-2F Memory Registry",
    objects: [...GROWTH_AI_MEMORY_REGISTRY_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiMemoryRegistrySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiMemoryRegistrySchema(admin)
  return health.ready
}

export function formatGrowthAiMemoryRegistrySchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_MEMORY_REGISTRY_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Memory Registry schema is incomplete — apply ${GROWTH_AI_MEMORY_REGISTRY_QA_MARKER} migration (missing: ${missing}).`
}

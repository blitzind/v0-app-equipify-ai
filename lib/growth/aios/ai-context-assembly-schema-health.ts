/** GE-AIOS-2J — Context Assembly schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER } from "@/lib/growth/aios/ai-context-assembly-types"

export const GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2j-context-assembly-schema-health-v1" as const

export const GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_context_assembly_runtime",
    columns: ["id", "organization_id", "assembly_count", "reuse_count", "last_assembled_at"],
    label: "Context Assembly runtime",
  },
  {
    table: "ai_context_packages",
    columns: ["id", "organization_id", "work_order_id", "context_version", "checksum"],
    label: "Context Packages",
  },
]

export async function probeGrowthAiContextAssemblySchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-context-assembly",
    featureLabel: "GE-AIOS-2J Context Assembly",
    objects: [...GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiContextAssemblySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiContextAssemblySchema(admin)
  return health.ready
}

export function formatGrowthAiContextAssemblySchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Context Assembly schema is incomplete — apply ${GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER} migration (missing: ${missing}).`
}

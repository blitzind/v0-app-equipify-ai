/** GE-AIOS-3A — Provider schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER } from "@/lib/growth/aios/ai-provider-types"

export const GROWTH_AI_PROVIDER_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-3a-provider-schema-health-v1" as const

export const GROWTH_AI_PROVIDER_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_provider_runtime",
    columns: ["id", "organization_id", "degraded", "active_provider", "request_count"],
    label: "AI Provider runtime",
  },
  {
    table: "ai_provider_requests",
    columns: ["id", "organization_id", "context_package_id", "provider_id", "request_status"],
    label: "AI Provider requests",
  },
]

export async function probeGrowthAiProviderSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-provider",
    featureLabel: "GE-AIOS-3A Provider Abstraction",
    objects: [...GROWTH_AI_PROVIDER_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiProviderSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiProviderSchema(admin)
  return health.ready
}

export function formatGrowthAiProviderSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_PROVIDER_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `AI Provider schema is incomplete — apply ${GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER} migration (missing: ${missing}).`
}

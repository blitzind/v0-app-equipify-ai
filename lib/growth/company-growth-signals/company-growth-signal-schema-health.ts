import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_OBJECTS,
  probeGrowthSchemaObjects,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

/** @deprecated Migration filename retained for docs/scripts only — probes use table objects. */
export const GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_MIGRATION =
  "20270404120000_growth_engine_multi_source_growth_signals.sql" as const

export const GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_SETUP_MESSAGE =
  "Multi-source growth signal schema is incomplete — growth.company_growth_signals was not detected."

export async function probeGrowthCompanyGrowthSignalsSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:company-growth-signals",
    featureLabel: "Multi-source growth signals",
    objects: [...GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_OBJECTS],
  })
}

export async function isGrowthCompanyGrowthSignalsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthCompanyGrowthSignalsSchema(admin)
  return health.ready
}

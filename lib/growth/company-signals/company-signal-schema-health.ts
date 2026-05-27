import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_COMPANY_SIGNAL_SCHEMA_OBJECTS,
  probeGrowthSchemaObjects,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

/** @deprecated Migration filename retained for docs/scripts only — probes use table objects. */
export const GROWTH_COMPANY_SIGNAL_SCHEMA_MIGRATION =
  "20270327120000_growth_engine_company_signal_intelligence.sql" as const

export const GROWTH_COMPANY_SIGNAL_SCHEMA_SETUP_MESSAGE =
  "Company signal intelligence schema is incomplete — growth.company_signal_* tables were not detected."

export async function probeGrowthCompanySignalSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:company-signals",
    featureLabel: "Company signal intelligence",
    objects: [...GROWTH_COMPANY_SIGNAL_SCHEMA_OBJECTS],
  })
}

export async function isGrowthCompanySignalSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthCompanySignalSchema(admin)
  return health.ready
}

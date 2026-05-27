import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CONTACT_DISCOVERY_SCHEMA_OBJECTS,
  probeGrowthSchemaObjects,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

/** @deprecated Migration filename retained for docs/scripts only — probes use table objects. */
export const GROWTH_CONTACT_DISCOVERY_SCHEMA_MIGRATION =
  "20270323120000_growth_engine_contact_discovery.sql" as const

export const GROWTH_CONTACT_DISCOVERY_SCHEMA_SETUP_MESSAGE =
  "Contact discovery schema is incomplete — required growth.contact_* and growth.buying_committee_* tables were not detected."

export async function probeGrowthContactDiscoverySchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:contact-discovery",
    featureLabel: "Contact discovery",
    objects: [...GROWTH_CONTACT_DISCOVERY_SCHEMA_OBJECTS],
  })
}

export async function isGrowthContactDiscoverySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthContactDiscoverySchema(admin)
  return health.ready
}

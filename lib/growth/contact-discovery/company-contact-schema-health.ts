import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_COMPANY_CONTACTS_SCHEMA_OBJECTS,
  probeGrowthSchemaObjects,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

/** @deprecated Migration filename retained for docs/scripts only — probes use table objects. */
export const GROWTH_COMPANY_CONTACTS_SCHEMA_MIGRATION =
  "20270403120000_growth_engine_company_contacts.sql" as const

export const GROWTH_COMPANY_CONTACTS_SCHEMA_SETUP_MESSAGE =
  "Company contacts schema is incomplete — growth.company_contacts was not detected."

export async function probeGrowthCompanyContactsSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:company-contacts",
    featureLabel: "Company contacts",
    objects: [...GROWTH_COMPANY_CONTACTS_SCHEMA_OBJECTS],
  })
}

export async function isGrowthCompanyContactsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthCompanyContactsSchema(admin)
  return health.ready
}

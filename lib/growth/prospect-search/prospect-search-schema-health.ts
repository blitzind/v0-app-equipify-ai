import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SAVED_SEARCH_SCHEMA_READY_QA_MARKER =
  "growth-saved-search-schema-ready-v1" as const

export const GROWTH_PROSPECT_SEARCH_SCHEMA_MIGRATION =
  "20270321120000_growth_engine_prospect_search.sql" as const

export const GROWTH_PROSPECT_SEARCH_GRANTS_MIGRATION =
  "20270529130000_growth_engine_prospect_search_production_readiness.sql" as const

export const GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE =
  `Prospect Search tables are not ready. Apply migrations ${GROWTH_PROSPECT_SEARCH_SCHEMA_MIGRATION} and ${GROWTH_PROSPECT_SEARCH_GRANTS_MIGRATION}.`

export const GROWTH_PROSPECT_SEARCH_INDEX_SCHEMA_SETUP_MESSAGE =
  "Prospect Search materialized index is not ready. Apply migration 20270401120000_growth_engine_prospect_search_index.sql."

export type GrowthProspectSearchSchemaHealth = {
  ready: boolean
  qa_marker: typeof GROWTH_SAVED_SEARCH_SCHEMA_READY_QA_MARKER
  saved_searches_table: boolean
  saved_searches_insert_probe: boolean
  message: string
  detail?: string | null
}

export async function diagnoseGrowthProspectSearchSchema(
  admin: SupabaseClient,
): Promise<GrowthProspectSearchSchemaHealth> {
  const base = {
    qa_marker: GROWTH_SAVED_SEARCH_SCHEMA_READY_QA_MARKER,
    saved_searches_table: false,
    saved_searches_insert_probe: false,
  } as const

  const selectProbe = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .select("id, name, query_text, filters, metadata, created_by")
    .limit(1)

  if (selectProbe.error) {
    const detail = `${selectProbe.error.code ?? "error"}: ${selectProbe.error.message}`
    if (process.env.NODE_ENV !== "production") {
      console.error("[prospect-search:schema]", detail)
    }
    return {
      ...base,
      ready: false,
      message: GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE,
      detail,
    }
  }

  const probe = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .insert({
      name: "__schema_probe__",
      query_text: "schema probe",
      filters: {},
      metadata: { schema_probe: true, qa_marker: GROWTH_SAVED_SEARCH_SCHEMA_READY_QA_MARKER },
    })
    .select("id")
    .single()

  if (probe.error || !probe.data?.id) {
    const detail = probe.error
      ? `${probe.error.code ?? "error"}: ${probe.error.message}`
      : "insert_probe_missing_id"
    if (process.env.NODE_ENV !== "production") {
      console.error("[prospect-search:schema:insert]", detail)
    }
    return {
      ...base,
      saved_searches_table: true,
      ready: false,
      message:
        "Saved search table exists but inserts are blocked — apply service_role grants migration.",
      detail,
    }
  }

  await admin.schema("growth").from("prospect_search_saved_searches").delete().eq("id", probe.data.id)

  return {
    ...base,
    saved_searches_table: true,
    saved_searches_insert_probe: true,
    ready: true,
    message: "Prospect Search saved search schema ready.",
    detail: null,
  }
}

export async function isGrowthProspectSearchSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await diagnoseGrowthProspectSearchSchema(admin)
  return health.ready
}

export async function isGrowthProspectSearchIndexSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("prospect_search_index")
    .select("id")
    .limit(1)
  return !error
}

export async function isGrowthProspectSearchTerritoryGeoReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("prospect_search_index")
    .select("lat, lng, metro, normalized_geo_key")
    .limit(1)
  return !error
}

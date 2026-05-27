import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildProspectSearchIndex } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  GROWTH_PROSPECT_SEARCH_MATERIALIZED_INDEX_QA_MARKER,
  isProspectSearchMaterializedIndexAvailable,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index"
import {
  indexCompanyToMaterializedRow,
  type ProspectSearchMaterializedIndexRow,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index-map"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

export {
  GROWTH_PROSPECT_SEARCH_MATERIALIZED_INDEX_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-materialized-index"

export const GROWTH_PROSPECT_SEARCH_INDEX_BUILDER_QA_MARKER =
  "growth-prospect-search-index-builder-v1" as const

export type ProspectSearchIndexRebuildMode = "full" | "source_type" | "source_id"

export type ProspectSearchIndexRebuildInput = {
  mode: ProspectSearchIndexRebuildMode
  source_type?: GrowthProspectSearchSourceType
  source_id?: string
}

export type ProspectSearchIndexRebuildResult = {
  ok: boolean
  mode: ProspectSearchIndexRebuildMode
  rows_indexed: number
  rows_updated: number
  rows_skipped: number
  rows_failed: number
  duration_ms: number
  message: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function rebuildProspectSearchMaterializedIndex(
  admin: SupabaseClient,
  input: ProspectSearchIndexRebuildInput,
): Promise<ProspectSearchIndexRebuildResult> {
  const started = Date.now()
  const mode = input.mode

  const available = await isProspectSearchMaterializedIndexAvailable(admin)
  if (!available) {
    return {
      ok: false,
      mode,
      rows_indexed: 0,
      rows_updated: 0,
      rows_skipped: 0,
      rows_failed: 0,
      duration_ms: Date.now() - started,
      message: "Materialized index table is not available. Apply migration 20270401120000_growth_engine_prospect_search_index.sql.",
    }
  }

  if (mode === "source_type" && !input.source_type) {
    return {
      ok: false,
      mode,
      rows_indexed: 0,
      rows_updated: 0,
      rows_skipped: 0,
      rows_failed: 0,
      duration_ms: Date.now() - started,
      message: "source_type is required for source_type rebuild mode.",
    }
  }

  if (mode === "source_id" && (!input.source_type || !input.source_id?.trim())) {
    return {
      ok: false,
      mode,
      rows_indexed: 0,
      rows_updated: 0,
      rows_skipped: 0,
      rows_failed: 0,
      duration_ms: Date.now() - started,
      message: "source_type and source_id are required for source_id rebuild mode.",
    }
  }

  const { companies } = await buildProspectSearchIndex(admin, "", {
    mode: "materialized",
    source_type:
      mode === "full"
        ? undefined
        : input.source_type,
    source_id: mode === "source_id" ? input.source_id : undefined,
  })

  let rows_indexed = 0
  let rows_updated = 0
  let rows_skipped = 0
  let rows_failed = 0
  const indexedKeys = new Set<string>()

  for (const company of companies) {
    if (!company.company_name?.trim()) {
      rows_skipped += 1
      continue
    }

    const materialized = indexCompanyToMaterializedRow(company)
    indexedKeys.add(`${materialized.source_type}:${materialized.source_id}`)

    try {
      const { data: existing } = await admin
        .schema("growth")
        .from("prospect_search_index")
        .select("id")
        .eq("source_type", materialized.source_type)
        .eq("source_id", materialized.source_id)
        .maybeSingle()

      const payload = materializedRowPayload(materialized)
      const { error } = existing?.id
        ? await admin
            .schema("growth")
            .from("prospect_search_index")
            .update(payload)
            .eq("id", existing.id)
        : await admin.schema("growth").from("prospect_search_index").insert(payload)

      if (error) {
        rows_failed += 1
        continue
      }

      if (existing?.id) rows_updated += 1
      else rows_indexed += 1
    } catch {
      rows_failed += 1
    }
  }

  if (mode === "full" || mode === "source_type") {
    await deactivateMissingProspectSearchIndexRows(admin, {
      mode,
      source_type: input.source_type,
      activeKeys: indexedKeys,
    })
  }

  const duration_ms = Date.now() - started
  const total = rows_indexed + rows_updated

  return {
    ok: rows_failed === 0 || total > 0,
    mode,
    rows_indexed,
    rows_updated,
    rows_skipped,
    rows_failed,
    duration_ms,
    message:
      total > 0
        ? `Indexed ${total} companies (${rows_indexed} new, ${rows_updated} updated) in ${duration_ms}ms.`
        : "No companies indexed.",
  }
}

function materializedRowPayload(row: ProspectSearchMaterializedIndexRow): Record<string, unknown> {
  return {
    source_type: row.source_type,
    source_id: row.source_id,
    company_name: row.company_name,
    normalized_company_name: row.normalized_company_name,
    domain: row.domain,
    website: row.website,
    email_domain: row.email_domain,
    phone: row.phone,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    location_label: row.location_label,
    industry: row.industry,
    vertical: row.vertical,
    service_area: row.service_area,
    metro: row.metro,
    lat: row.lat,
    lng: row.lng,
    normalized_geo_key: row.normalized_geo_key,
    employee_count: row.employee_count,
    employee_range: row.employee_range,
    estimated_annual_revenue: row.estimated_annual_revenue,
    revenue_range: row.revenue_range,
    crm_detected: row.crm_detected,
    field_service_software: row.field_service_software,
    website_platform: row.website_platform,
    technologies: row.technologies,
    company_signal_summary: row.company_signal_summary,
    signal_confidence: row.signal_confidence,
    signal_count: row.signal_count,
    lead_engine_score: row.lead_engine_score,
    lead_engine_score_label: row.lead_engine_score_label,
    buying_stage: row.buying_stage,
    buying_stage_confidence: row.buying_stage_confidence,
    intent_score: row.intent_score,
    company_match_confidence: row.company_match_confidence,
    existing_account_status: row.existing_account_status,
    is_customer: row.is_customer,
    is_prospect: row.is_prospect,
    is_in_lead_inbox: row.is_in_lead_inbox,
    is_suppressed: row.is_suppressed,
    suppression_reason_safe: row.suppression_reason_safe,
    suppression_scope_safe: row.suppression_scope_safe,
    source_updated_at: row.source_updated_at,
    indexed_at: new Date().toISOString(),
    metadata: row.metadata,
    is_active: true,
  }
}

async function deactivateMissingProspectSearchIndexRows(
  admin: SupabaseClient,
  input: {
    mode: ProspectSearchIndexRebuildMode
    source_type?: GrowthProspectSearchSourceType
    activeKeys: Set<string>
  },
): Promise<void> {
  try {
    let query = admin
      .schema("growth")
      .from("prospect_search_index")
      .select("id, source_type, source_id")
      .eq("is_active", true)

    if (input.mode === "source_type" && input.source_type) {
      query = query.eq("source_type", input.source_type)
    }

    const { data } = await query.limit(10000)
    const staleIds: string[] = []

    for (const raw of data ?? []) {
      const row = raw as Record<string, unknown>
      const id = asString(row.id)
      const key = `${asString(row.source_type)}:${asString(row.source_id)}`
      if (id && !input.activeKeys.has(key)) staleIds.push(id)
    }

    if (staleIds.length === 0) return

    for (let i = 0; i < staleIds.length; i += 200) {
      const batch = staleIds.slice(i, i + 200)
      await admin
        .schema("growth")
        .from("prospect_search_index")
        .update({ is_active: false })
        .in("id", batch)
    }
  } catch {
    /* non-fatal */
  }
}

import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { probeGrowthLeadArchiveSchema } from "@/lib/growth/lead-archive-schema-health"
import { hydrateInternalCompanySignals } from "@/lib/growth/prospect-search/internal-company-signal-hydration"
import {
  buildProspectSearchIndexSignals,
  mapCrmCustomerIndexEnrichment,
  mapCrmProspectIndexEnrichment,
  mapGrowthLeadIndexEnrichment,
  mapLeadInboxIndexEnrichment,
  type ProspectSearchCustomerLocationOverlay,
  type ProspectSearchResearchOverlay,
} from "@/lib/growth/prospect-search/prospect-search-index-enrichment"
import {
  applyProspectSearchQualificationToIndexRow,
  buyingStageOverlayFromAssessmentRow,
} from "@/lib/growth/prospect-search/prospect-search-qualification-overlays"
import type {
  GrowthProspectSearchIndexCompany,
  GrowthProspectSearchIndexPerson,
  GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { deriveProspectSearchCompanyStatus } from "@/lib/growth/prospect-search/prospect-search-status"
import {
  applyProspectSearchSuppressionOverlay,
  loadProspectSearchSuppressionLookup,
} from "@/lib/growth/prospect-search/prospect-search-suppression-overlays"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function sanitizeProspectSearchQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, 300)
    .replace(/%/g, "")
    .replace(/\\/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildProspectSearchIlikePattern(query: string): string {
  const sanitized = sanitizeProspectSearchQuery(query)
  return sanitized ? `%${sanitized}%` : "%"
}

export type { GrowthProspectSearchIndexCompany, GrowthProspectSearchIndexPerson } from "@/lib/growth/prospect-search/prospect-search-types"

type IntentOverlay = {
  intent_score?: number
  search_intent_category?: string | null
  returning_visitor?: boolean
}

type MatchOverlay = {
  company_match_confidence?: number
}

type BuyingOverlay = ProspectSearchBuyingStageOverlay

async function applyLeadArchiveFilter(
  admin: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
) {
  const probe = await probeGrowthLeadArchiveSchema(admin)
  return probe.archiveColumns ? query.is("archived_at", null) : query.neq("status", "archived")
}

async function loadIntentOverlays(admin: SupabaseClient): Promise<Map<string, IntentOverlay>> {
  const map = new Map<string, IntentOverlay>()
  try {
    const { data } = await admin
      .schema("growth")
      .from("search_intent_signals")
      .select("growth_lead_id, intent_category, intent_score, visitor_key")
      .not("growth_lead_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const leadKey = asString(r.growth_lead_id)
      if (!leadKey || seen.has(leadKey)) continue
      seen.add(leadKey)
      map.set(leadKey, {
        intent_score: typeof r.intent_score === "number" ? r.intent_score : undefined,
        search_intent_category: asString(r.intent_category) || null,
        returning_visitor: Boolean(r.visitor_key),
      })
    }
  } catch {
    /* optional table */
  }
  return map
}

async function loadCompanyMatchOverlays(admin: SupabaseClient): Promise<Map<string, MatchOverlay>> {
  const map = new Map<string, MatchOverlay>()
  try {
    const { data } = await admin
      .schema("growth")
      .from("company_identification_matches")
      .select("growth_lead_id, match_confidence")
      .not("growth_lead_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const leadKey = asString(r.growth_lead_id)
      if (!leadKey || seen.has(leadKey)) continue
      seen.add(leadKey)
      map.set(leadKey, {
        company_match_confidence:
          typeof r.match_confidence === "number" ? r.match_confidence : undefined,
      })
    }
  } catch {
    /* optional */
  }
  return map
}

async function loadBuyingStageOverlays(admin: SupabaseClient): Promise<Map<string, BuyingOverlay>> {
  const map = new Map<string, BuyingOverlay>()
  try {
    const { data } = await admin
      .schema("growth")
      .from("buying_stage_assessments")
      .select(
        "growth_lead_id, detected_stage, stage_confidence, stage_reasoning, evidence, updated_at, created_at",
      )
      .not("growth_lead_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const leadKey = asString(r.growth_lead_id)
      if (!leadKey || seen.has(leadKey)) continue
      seen.add(leadKey)
      map.set(leadKey, buyingStageOverlayFromAssessmentRow(r))
    }
  } catch {
    /* optional */
  }
  return map
}

async function loadProspectResearchOverlays(
  admin: SupabaseClient,
  runIds: string[],
): Promise<Map<string, ProspectSearchResearchOverlay>> {
  const map = new Map<string, ProspectSearchResearchOverlay>()
  const uniqueIds = [...new Set(runIds.filter(Boolean))].slice(0, 80)
  if (!uniqueIds.length) return map

  try {
    const { data } = await admin
      .schema("growth")
      .from("research_runs")
      .select("id, industry_guess, employee_size_guess, revenue_size_guess, detected_technologies, status")
      .in("id", uniqueIds)
      .eq("status", "completed")

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const id = asString(r.id)
      if (!id) continue
      map.set(id, {
        industry_guess: asString(r.industry_guess) || null,
        employee_size_guess: asString(r.employee_size_guess) || null,
        revenue_size_guess: asString(r.revenue_size_guess) || null,
        detected_technologies: Array.isArray(r.detected_technologies)
          ? (r.detected_technologies as string[]).filter((item) => typeof item === "string")
          : [],
      })
    }
  } catch {
    /* optional */
  }

  return map
}

async function loadCustomerDefaultLocations(
  admin: SupabaseClient,
  customerIds: string[],
  orgId: string,
): Promise<Map<string, ProspectSearchCustomerLocationOverlay>> {
  const map = new Map<string, ProspectSearchCustomerLocationOverlay>()
  const uniqueIds = [...new Set(customerIds.filter(Boolean))].slice(0, 60)
  if (!uniqueIds.length) return map

  try {
    const { data } = await admin
      .from("customer_locations")
      .select("customer_id, city, state, postal_code, address_line1, is_default")
      .eq("organization_id", orgId)
      .in("customer_id", uniqueIds)
      .order("is_default", { ascending: false })

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const customerId = asString(r.customer_id)
      if (!customerId || map.has(customerId)) continue
      map.set(customerId, {
        city: asString(r.city) || null,
        state: asString(r.state) || null,
        postal_code: asString(r.postal_code) || null,
        address_line1: asString(r.address_line1) || null,
      })
    }
  } catch {
    /* optional */
  }

  return map
}

function mergeKey(source: GrowthProspectSearchSourceType, id: string): string {
  return `${source}:${id}`
}

function applyProspectSearchSafetyOverlays(
  row: GrowthProspectSearchIndexCompany,
  suppressionLookup: Awaited<ReturnType<typeof loadProspectSearchSuppressionLookup>>,
): GrowthProspectSearchIndexCompany {
  const status = deriveProspectSearchCompanyStatus(row)
  return applyProspectSearchSuppressionOverlay(
    {
      ...row,
      ...status,
      is_suppressed: row.is_suppressed ?? false,
      suppression_reason: row.suppression_reason ?? null,
      suppression_scope: row.suppression_scope ?? null,
      suppressed_at: row.suppressed_at ?? null,
    },
    suppressionLookup,
  )
}

function applyInternalSignalHydration(
  row: GrowthProspectSearchIndexCompany,
): GrowthProspectSearchIndexCompany {
  const hydration = hydrateInternalCompanySignals(row)
  if (!hydration) return row
  return {
    ...row,
    company_signal_summary: hydration.company_signal_summary,
    signal_confidence: hydration.signal_confidence,
    signal_count: hydration.signal_count,
    signals: hydration.merged_signals,
  }
}

const INDEX_SAFETY_DEFAULTS = {
  in_revenue_queue: false,
  existing_customer: false,
  existing_prospect: false,
  already_pushed: false,
  is_suppressed: false,
  suppression_reason: null,
  suppression_scope: null,
  suppressed_at: null,
} satisfies Pick<
  GrowthProspectSearchIndexCompany,
  | "in_revenue_queue"
  | "existing_customer"
  | "existing_prospect"
  | "already_pushed"
  | "is_suppressed"
  | "suppression_reason"
  | "suppression_scope"
  | "suppressed_at"
>

export type ProspectSearchIndexBuildOptions = {
  mode?: "search" | "materialized"
  source_type?: GrowthProspectSearchSourceType
  source_id?: string
}

const MATERIALIZED_SOURCE_BATCH_SIZE = 200

async function fetchAllRows<T extends Record<string, unknown>>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = MATERIALIZED_SOURCE_BATCH_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  let offset = 0
  while (true) {
    const page = await fetchPage(offset, pageSize)
    if (!page.length) break
    rows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  return rows
}

export async function buildProspectSearchIndex(
  admin: SupabaseClient,
  query: string,
  options: ProspectSearchIndexBuildOptions = {},
): Promise<{ companies: GrowthProspectSearchIndexCompany[]; people: GrowthProspectSearchIndexPerson[] }> {
  const materialized = options.mode === "materialized"
  const pattern = buildProspectSearchIlikePattern(query)
  const hasQuery = !materialized && sanitizeProspectSearchQuery(query).length > 0
  const sourceTypeFilter = options.source_type
  const sourceIdFilter = options.source_id?.trim()
  const companyMap = new Map<string, GrowthProspectSearchIndexCompany>()
  const people: GrowthProspectSearchIndexPerson[] = []

  const [intentOverlays, matchOverlays, buyingOverlays, suppressionLookup] = await Promise.all([
    loadIntentOverlays(admin),
    loadCompanyMatchOverlays(admin),
    loadBuyingStageOverlays(admin),
    loadProspectSearchSuppressionLookup(admin),
  ])

  const upsertCompany = (row: GrowthProspectSearchIndexCompany) => {
    const normalized = { ...INDEX_SAFETY_DEFAULTS, ...row }
    const key = mergeKey(normalized.source_type, normalized.id)
    const existing = companyMap.get(key)
    if (!existing || (normalized.intent_score ?? 0) > (existing.intent_score ?? 0)) {
      companyMap.set(key, normalized)
    }
  }

  // growth.leads
  if (!sourceTypeFilter || sourceTypeFilter === "growth_lead") {
  try {
    const leadRows = materialized
      ? await fetchAllRows(async (offset, limit) => {
          let leadQuery = admin
            .schema("growth")
            .from("leads")
            .select(
              "id, company_name, website, city, state, country, address_line1, postal_code, notes, score, status, metadata, estimated_employee_count, estimated_annual_revenue, crm_detected, field_service_stack_detected, decision_maker_status, latest_prospect_research_run_id, updated_at",
            )
            .order("updated_at", { ascending: false })
            .range(offset, offset + limit - 1)
          if (sourceIdFilter) leadQuery = leadQuery.eq("id", sourceIdFilter)
          leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
          const { data } = await leadQuery
          return (data ?? []) as Record<string, unknown>[]
        })
      : await (async () => {
          let leadQuery = admin
            .schema("growth")
            .from("leads")
            .select(
              "id, company_name, website, city, state, country, address_line1, postal_code, notes, score, status, metadata, estimated_employee_count, estimated_annual_revenue, crm_detected, field_service_stack_detected, decision_maker_status, latest_prospect_research_run_id, updated_at",
            )
            .order("updated_at", { ascending: false })
            .limit(hasQuery ? 60 : 40)
          if (hasQuery) leadQuery = leadQuery.ilike("company_name", pattern)
          leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
          const { data } = await leadQuery
          return (data ?? []) as Record<string, unknown>[]
        })()
    const researchOverlays = await loadProspectResearchOverlays(
      admin,
      leadRows
        .map((row) => asString(row.latest_prospect_research_run_id))
        .filter(Boolean),
    )

    for (const r of leadRows) {
      const id = asString(r.id)
      if (!id) continue
      const researchRunId = asString(r.latest_prospect_research_run_id)
      const enrichment = mapGrowthLeadIndexEnrichment({
        raw: r,
        research: researchRunId ? researchOverlays.get(researchRunId) ?? null : null,
      })
      const signals = buildProspectSearchIndexSignals({
        source_type: "growth_lead",
        notes: enrichment.notes,
        crm_detected: enrichment.crm_detected,
        field_service_software: enrichment.field_service_software,
        website_platform: enrichment.website_platform,
        service_area: enrichment.service_area,
      })

      const intentOverlay = intentOverlays.get(id)
      const matchOverlay = matchOverlays.get(id)
      const buyingOverlay = buyingOverlays.get(id)
      const overlaySignals = [...signals]
      if (intentOverlay?.search_intent_category) {
        overlaySignals.unshift(`Search intent: ${intentOverlay.search_intent_category}`)
      }

      upsertCompany(
        applyProspectSearchQualificationToIndexRow(
          {
            id,
            source_type: "growth_lead",
            company_name: asString(r.company_name) || "Unknown",
            ...enrichment,
            intent_score: intentOverlay?.intent_score ?? null,
            buying_stage: buyingOverlay?.buying_stage ?? null,
            buying_stage_confidence: buyingOverlay?.buying_stage_confidence ?? null,
            buying_stage_reason: buyingOverlay?.buying_stage_reason ?? null,
            buying_stage_last_assessed_at: buyingOverlay?.buying_stage_last_assessed_at ?? null,
            lead_score: typeof r.score === "number" ? r.score : null,
            lead_engine_score: null,
            lead_engine_score_label: null,
            lead_engine_score_explanation: null,
            lead_engine_last_run_at: null,
            company_match_confidence: matchOverlay?.company_match_confidence ?? null,
            decision_maker_count: asString(r.decision_maker_status) === "identified" ? 1 : 0,
            verification_status: "unverified",
            priority: null,
            signals: [...new Set(overlaySignals)].slice(0, 6),
            search_intent_category: intentOverlay?.search_intent_category ?? null,
            returning_visitor: intentOverlay?.returning_visitor ?? false,
            existing_account: false,
            growth_lead_id: id,
            prospect_id: null,
            customer_id: null,
          },
          {
            metadata:
              r.metadata && typeof r.metadata === "object"
                ? (r.metadata as Record<string, unknown>)
                : {},
          },
        ),
      )
    }
  } catch {
    /* growth.leads optional */
  }
  }

  // growth.lead_inbox — retired from index loader (GE-LEADS-CANONICAL-4B); use growth.leads above.

  const orgId = getGrowthEngineAiOrgId()
  if (orgId) {
    if (!sourceTypeFilter || sourceTypeFilter === "crm_prospect") {
    try {
      const prospectRows = materialized
        ? await fetchAllRows(async (offset, limit) => {
            let prospectQuery = admin
              .from("prospects")
              .select(
                "id, company_name, website, notes, city, state, address_line1, postal_code, estimated_value_cents, updated_at",
              )
              .eq("organization_id", orgId)
              .order("updated_at", { ascending: false })
              .range(offset, offset + limit - 1)
            if (sourceIdFilter) prospectQuery = prospectQuery.eq("id", sourceIdFilter)
            const { data } = await prospectQuery
            return (data ?? []) as Record<string, unknown>[]
          })
        : await (async () => {
            let prospectQuery = admin
              .from("prospects")
              .select(
                "id, company_name, website, notes, city, state, address_line1, postal_code, estimated_value_cents, updated_at",
              )
              .eq("organization_id", orgId)
              .order("updated_at", { ascending: false })
              .limit(hasQuery ? 40 : 30)
            if (hasQuery) prospectQuery = prospectQuery.ilike("company_name", pattern)
            const { data } = await prospectQuery
            return (data ?? []) as Record<string, unknown>[]
          })()

      for (const raw of prospectRows) {
        const r = raw as Record<string, unknown>
        const id = asString(r.id)
        if (!id) continue
        const enrichment = mapCrmProspectIndexEnrichment({ raw: r })
        upsertCompany({
          id,
          source_type: "crm_prospect",
          company_name: asString(r.company_name) || "Unknown",
          ...enrichment,
          intent_score: null,
          buying_stage: null,
          buying_stage_confidence: null,
          buying_stage_reason: null,
          buying_stage_last_assessed_at: null,
          lead_score: null,
          lead_engine_score: null,
          lead_engine_score_label: null,
          lead_engine_score_explanation: null,
          lead_engine_last_run_at: null,
          company_match_confidence: null,
          decision_maker_count: 0,
          verification_status: "crm_prospect",
          priority: null,
          signals: buildProspectSearchIndexSignals({
            source_type: "crm_prospect",
            notes: enrichment.notes,
          }),
          search_intent_category: null,
          returning_visitor: false,
          existing_account: false,
          growth_lead_id: null,
          prospect_id: id,
          customer_id: null,
        })
      }
    } catch {
      /* optional */
    }
    }

    if (!sourceTypeFilter || sourceTypeFilter === "crm_customer") {
    try {
      const customerRows = materialized
        ? await fetchAllRows(async (offset, limit) => {
            let customerQuery = admin
              .from("customers")
              .select("id, company_name, notes, updated_at")
              .eq("organization_id", orgId)
              .order("updated_at", { ascending: false })
              .range(offset, offset + limit - 1)
            if (sourceIdFilter) customerQuery = customerQuery.eq("id", sourceIdFilter)
            const { data } = await customerQuery
            return (data ?? []) as Record<string, unknown>[]
          })
        : await (async () => {
            let customerQuery = admin
              .from("customers")
              .select("id, company_name, notes, updated_at")
              .eq("organization_id", orgId)
              .order("updated_at", { ascending: false })
              .limit(hasQuery ? 40 : 30)
            if (hasQuery) customerQuery = customerQuery.ilike("company_name", pattern)
            const { data } = await customerQuery
            return (data ?? []) as Record<string, unknown>[]
          })()
      const customerLocations = await loadCustomerDefaultLocations(
        admin,
        customerRows.map((row) => asString(row.id)).filter(Boolean),
        orgId,
      )

      for (const r of customerRows) {
        const id = asString(r.id)
        if (!id) continue
        const enrichment = mapCrmCustomerIndexEnrichment({
          raw: r,
          location: customerLocations.get(id) ?? null,
        })
        upsertCompany({
          id,
          source_type: "crm_customer",
          company_name: asString(r.company_name) || "Unknown",
          ...enrichment,
          intent_score: null,
          buying_stage: null,
          buying_stage_confidence: null,
          buying_stage_reason: null,
          buying_stage_last_assessed_at: null,
          lead_score: null,
          lead_engine_score: null,
          lead_engine_score_label: null,
          lead_engine_score_explanation: null,
          lead_engine_last_run_at: null,
          company_match_confidence: null,
          decision_maker_count: 0,
          verification_status: "existing_account",
          priority: null,
          signals: buildProspectSearchIndexSignals({
            source_type: "crm_customer",
            notes: enrichment.notes,
            existing_account: true,
          }),
          search_intent_category: null,
          returning_visitor: false,
          existing_account: true,
          growth_lead_id: null,
          prospect_id: null,
          customer_id: id,
        })
      }
    } catch {
      /* optional */
    }
    }
  }

  // Decision makers → people index
  if (!materialized) try {
    let dmQuery = admin
      .schema("growth")
      .from("lead_decision_makers")
      .select("id, lead_id, full_name, email, title, phone, verification_status")
      .order("updated_at", { ascending: false })
      .limit(hasQuery ? 80 : 50)
    if (hasQuery) {
      dmQuery = dmQuery.or(
        `full_name.ilike.${pattern},email.ilike.${pattern},title.ilike.${pattern}`,
      )
    }
    const { data } = await dmQuery
    const leadNames = new Map<string, string>()
    for (const c of companyMap.values()) {
      if (c.growth_lead_id) leadNames.set(c.growth_lead_id, c.company_name)
    }
    for (const raw of data ?? []) {
      const r = raw as Record<string, unknown>
      const leadId = asString(r.lead_id)
      const id = asString(r.id)
      if (!id || !leadId) continue
      people.push({
        id,
        source_type: "growth_lead",
        company_id: leadId,
        company_name: leadNames.get(leadId) ?? "Growth lead",
        full_name: asString(r.full_name) || null,
        title: asString(r.title) || null,
        email: asString(r.email) || null,
        phone: asString(r.phone) || null,
        role: asString(r.title) || null,
        verification_status: asString(r.verification_status) || "unverified",
      })
      const company = [...companyMap.values()].find((c) => c.growth_lead_id === leadId)
      if (company) {
        company.decision_maker_count += 1
      }
    }
  } catch {
    /* optional */
  }

  return {
    companies: [...companyMap.values()]
      .map(applyInternalSignalHydration)
      .map((row) => applyProspectSearchSafetyOverlays(row, suppressionLookup)),
    people,
  }
}

export function prospectSearchDedupeHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}

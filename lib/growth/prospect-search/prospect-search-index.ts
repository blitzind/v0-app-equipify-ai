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
import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"
import {
  applyProspectSearchQualificationToIndexRow,
  buyingStageOverlayFromAssessmentRow,
} from "@/lib/growth/prospect-search/prospect-search-qualification-overlays"
import type { ProspectSearchBuyingStageOverlay } from "@/lib/growth/prospect-search/prospect-search-qualification-overlays"

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

export type GrowthProspectSearchIndexCompany = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_name: string
  website: string | null
  industry: string | null
  subindustry: string | null
  employees: string | null
  revenue_range: string | null
  location: string | null
  city: string | null
  state: string | null
  service_area: string | null
  notes: string | null
  keywords: string[]
  crm_detected: string | null
  website_platform: string | null
  field_service_software: string | null
  intent_score: number | null
  buying_stage: string | null
  buying_stage_confidence: number | null
  buying_stage_reason: string | null
  buying_stage_last_assessed_at: string | null
  lead_score: number | null
  lead_engine_score: number | null
  lead_engine_score_label: string | null
  lead_engine_score_explanation: string | null
  lead_engine_last_run_at: string | null
  company_match_confidence: number | null
  decision_maker_count: number
  verification_status: string
  priority: string | null
  signals: string[]
  search_intent_category: string | null
  returning_visitor: boolean
  existing_account: boolean
  lead_inbox_id: string | null
  growth_lead_id: string | null
  prospect_id: string | null
  customer_id: string | null
  /** Evidence-backed signal summary from internal hydration (in-memory). */
  company_signal_summary?: GrowthCompanySignalUiSummary | null
  signal_confidence?: number | null
  signal_count?: number
}

export type GrowthProspectSearchIndexPerson = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_id: string
  company_name: string
  full_name: string | null
  title: string | null
  email: string | null
  phone: string | null
  role: string | null
  verification_status: string
}

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
      .select("lead_inbox_id, intent_category, intent_score, visitor_key")
      .not("lead_inbox_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const inboxId = asString(r.lead_inbox_id)
      if (!inboxId || seen.has(inboxId)) continue
      seen.add(inboxId)
      map.set(inboxId, {
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
      .select("lead_inbox_id, match_confidence")
      .not("lead_inbox_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const inboxId = asString(r.lead_inbox_id)
      if (!inboxId || seen.has(inboxId)) continue
      seen.add(inboxId)
      map.set(inboxId, {
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
      .select("lead_inbox_id, detected_stage, stage_confidence, stage_reasoning, evidence, updated_at, created_at")
      .not("lead_inbox_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const inboxId = asString(r.lead_inbox_id)
      if (!inboxId || seen.has(inboxId)) continue
      seen.add(inboxId)
      map.set(inboxId, buyingStageOverlayFromAssessmentRow(r))
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

export async function buildProspectSearchIndex(
  admin: SupabaseClient,
  query: string,
): Promise<{ companies: GrowthProspectSearchIndexCompany[]; people: GrowthProspectSearchIndexPerson[] }> {
  const pattern = buildProspectSearchIlikePattern(query)
  const hasQuery = sanitizeProspectSearchQuery(query).length > 0
  const companyMap = new Map<string, GrowthProspectSearchIndexCompany>()
  const people: GrowthProspectSearchIndexPerson[] = []

  const [intentOverlays, matchOverlays, buyingOverlays] = await Promise.all([
    loadIntentOverlays(admin),
    loadCompanyMatchOverlays(admin),
    loadBuyingStageOverlays(admin),
  ])

  const upsertCompany = (row: GrowthProspectSearchIndexCompany) => {
    const key = mergeKey(row.source_type, row.id)
    const existing = companyMap.get(key)
    if (!existing || (row.intent_score ?? 0) > (existing.intent_score ?? 0)) {
      companyMap.set(key, row)
    }
  }

  // growth.leads
  try {
    let leadQuery = admin
      .schema("growth")
      .from("leads")
      .select(
        "id, company_name, website, city, state, country, address_line1, postal_code, notes, score, status, metadata, estimated_employee_count, estimated_annual_revenue, crm_detected, field_service_stack_detected, decision_maker_status, latest_prospect_research_run_id",
      )
      .order("updated_at", { ascending: false })
      .limit(hasQuery ? 60 : 40)
    if (hasQuery) leadQuery = leadQuery.ilike("company_name", pattern)
    leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
    const { data } = await leadQuery
    const leadRows = (data ?? []) as Record<string, unknown>[]
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

      upsertCompany(
        applyProspectSearchQualificationToIndexRow(
          {
            id,
            source_type: "growth_lead",
            company_name: asString(r.company_name) || "Unknown",
            ...enrichment,
            intent_score: null,
            buying_stage: null,
            buying_stage_confidence: null,
            buying_stage_reason: null,
            buying_stage_last_assessed_at: null,
            lead_score: typeof r.score === "number" ? r.score : null,
            lead_engine_score: null,
            lead_engine_score_label: null,
            lead_engine_score_explanation: null,
            lead_engine_last_run_at: null,
            company_match_confidence: null,
            decision_maker_count: asString(r.decision_maker_status) === "identified" ? 1 : 0,
            verification_status: "unverified",
            priority: null,
            signals,
            search_intent_category: null,
            returning_visitor: false,
            existing_account: false,
            lead_inbox_id: null,
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

  // growth.lead_inbox
  try {
    let inboxQuery = admin
      .schema("growth")
      .from("lead_inbox")
      .select(
        "id, company_name, domain, intent_score, candidate_priority, status, metadata, existing_account_match",
      )
      .order("updated_at", { ascending: false })
      .limit(hasQuery ? 60 : 40)
    if (hasQuery) inboxQuery = inboxQuery.ilike("company_name", pattern)
    const { data } = await inboxQuery
    for (const raw of data ?? []) {
      const r = raw as Record<string, unknown>
      const id = asString(r.id)
      if (!id) continue
      const meta =
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : {}
      const buying = meta.buying_stage_summary as Record<string, unknown> | undefined
      const intentOverlay = intentOverlays.get(id)
      const matchOverlay = matchOverlays.get(id)
      const buyingOverlay = buyingOverlays.get(id)
      const accountMatch =
        r.existing_account_match && typeof r.existing_account_match === "object"
          ? (r.existing_account_match as { matched?: boolean })
          : null
      const enrichment = mapLeadInboxIndexEnrichment({ raw: r })
      const existing_account = accountMatch?.matched === true
      const signals = buildProspectSearchIndexSignals({
        source_type: "lead_inbox",
        crm_detected: enrichment.crm_detected,
        field_service_software: enrichment.field_service_software,
        website_platform: enrichment.website_platform,
        service_area: enrichment.service_area,
        existing_account,
      })
      if (intentOverlay?.search_intent_category) {
        signals.unshift(`Search intent: ${intentOverlay.search_intent_category}`)
      }

      upsertCompany(
        applyProspectSearchQualificationToIndexRow(
          {
            id,
            source_type: "lead_inbox",
            company_name: asString(r.company_name) || "Unknown",
            ...enrichment,
            intent_score:
              typeof r.intent_score === "number"
                ? r.intent_score
                : (intentOverlay?.intent_score ?? null),
            buying_stage:
              (typeof buying?.detected_stage === "string" ? buying.detected_stage : null) ??
              buyingOverlay?.buying_stage ??
              null,
            buying_stage_confidence: buyingOverlay?.buying_stage_confidence ?? null,
            buying_stage_reason: buyingOverlay?.buying_stage_reason ?? null,
            buying_stage_last_assessed_at: buyingOverlay?.buying_stage_last_assessed_at ?? null,
            lead_score: typeof r.intent_score === "number" ? r.intent_score : null,
            lead_engine_score: null,
            lead_engine_score_label: null,
            lead_engine_score_explanation: null,
            lead_engine_last_run_at: null,
            company_match_confidence: matchOverlay?.company_match_confidence ?? null,
            decision_maker_count: 0,
            verification_status: "candidate",
            priority: asString(r.candidate_priority) || null,
            signals: [...new Set(signals)].slice(0, 6),
            search_intent_category: intentOverlay?.search_intent_category ?? null,
            returning_visitor: intentOverlay?.returning_visitor ?? false,
            existing_account,
            lead_inbox_id: id,
            growth_lead_id: null,
            prospect_id: null,
            customer_id: null,
          },
          {
            metadata: meta,
            buyingOverlay: buyingOverlay ?? null,
          },
        ),
      )
    }
  } catch {
    /* optional */
  }

  const orgId = getGrowthEngineAiOrgId()
  if (orgId) {
    try {
      let prospectQuery = admin
        .from("prospects")
        .select(
          "id, company_name, website, notes, city, state, address_line1, postal_code, estimated_value_cents",
        )
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(hasQuery ? 40 : 30)
      if (hasQuery) prospectQuery = prospectQuery.ilike("company_name", pattern)
      const { data } = await prospectQuery
      for (const raw of data ?? []) {
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
          lead_inbox_id: null,
          growth_lead_id: null,
          prospect_id: id,
          customer_id: null,
        })
      }
    } catch {
      /* optional */
    }

    try {
      let customerQuery = admin
        .from("customers")
        .select("id, company_name, notes")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(hasQuery ? 40 : 30)
      if (hasQuery) customerQuery = customerQuery.ilike("company_name", pattern)
      const { data: customerData } = await customerQuery
      const customerRows = (customerData ?? []) as Record<string, unknown>[]
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
          lead_inbox_id: null,
          growth_lead_id: null,
          prospect_id: null,
          customer_id: id,
        })
      }
    } catch {
      /* optional */
    }
  }

  // Decision makers → people index
  try {
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
    companies: [...companyMap.values()].map(applyInternalSignalHydration),
    people,
  }
}

export function prospectSearchDedupeHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}

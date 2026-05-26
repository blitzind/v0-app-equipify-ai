import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { probeGrowthLeadArchiveSchema } from "@/lib/growth/lead-archive-schema-health"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

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
  lead_score: number | null
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

type BuyingOverlay = {
  buying_stage?: string | null
}

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
      .select("lead_inbox_id, detected_stage")
      .not("lead_inbox_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const inboxId = asString(r.lead_inbox_id)
      if (!inboxId || seen.has(inboxId)) continue
      seen.add(inboxId)
      map.set(inboxId, { buying_stage: asString(r.detected_stage) || null })
    }
  } catch {
    /* optional */
  }
  return map
}

function mergeKey(source: GrowthProspectSearchSourceType, id: string): string {
  return `${source}:${id}`
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
        "id, company_name, website, city, state, country, notes, score, status, estimated_employee_count, estimated_annual_revenue, crm_detected, field_service_stack_detected, decision_maker_status",
      )
      .order("updated_at", { ascending: false })
      .limit(hasQuery ? 60 : 40)
    if (hasQuery) leadQuery = leadQuery.ilike("company_name", pattern)
    leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
    const { data } = await leadQuery
    for (const raw of data ?? []) {
      const r = raw as Record<string, unknown>
      const id = asString(r.id)
      if (!id) continue
      const location = [asString(r.city), asString(r.state), asString(r.country)].filter(Boolean).join(", ")
      upsertCompany({
        id,
        source_type: "growth_lead",
        company_name: asString(r.company_name) || "Unknown",
        website: asString(r.website) || null,
        industry: null,
        subindustry: null,
        employees: asString(r.estimated_employee_count) || null,
        revenue_range: asString(r.estimated_annual_revenue) || null,
        location: location || null,
        city: asString(r.city) || null,
        state: asString(r.state) || null,
        service_area: null,
        notes: asString(r.notes) || null,
        keywords: [],
        crm_detected: asString(r.crm_detected) || null,
        website_platform: null,
        field_service_software: asString(r.field_service_stack_detected) || null,
        intent_score: null,
        buying_stage: null,
        lead_score: typeof r.score === "number" ? r.score : null,
        company_match_confidence: null,
        decision_maker_count: asString(r.decision_maker_status) === "identified" ? 1 : 0,
        verification_status: "unverified",
        priority: null,
        signals: asString(r.notes) ? [`Notes: ${asString(r.notes).slice(0, 80)}`] : [],
        search_intent_category: null,
        returning_visitor: false,
        existing_account: false,
        lead_inbox_id: null,
        growth_lead_id: id,
        prospect_id: null,
        customer_id: null,
      })
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

      upsertCompany({
        id,
        source_type: "lead_inbox",
        company_name: asString(r.company_name) || "Unknown",
        website: asString(r.domain) || null,
        industry: asString(meta.industry) || null,
        subindustry: null,
        employees: null,
        revenue_range: null,
        location: asString(meta.location) || null,
        city: null,
        state: null,
        service_area: null,
        notes: null,
        keywords: [],
        crm_detected: null,
        website_platform: null,
        field_service_software: null,
        intent_score:
          typeof r.intent_score === "number"
            ? r.intent_score
            : (intentOverlay?.intent_score ?? null),
        buying_stage:
          (typeof buying?.detected_stage === "string" ? buying.detected_stage : null) ??
          buyingOverlay?.buying_stage ??
          null,
        lead_score: typeof r.intent_score === "number" ? r.intent_score : null,
        company_match_confidence: matchOverlay?.company_match_confidence ?? null,
        decision_maker_count: 0,
        verification_status: "candidate",
        priority: asString(r.candidate_priority) || null,
        signals: intentOverlay?.search_intent_category
          ? [`Search intent: ${intentOverlay.search_intent_category}`]
          : [],
        search_intent_category: intentOverlay?.search_intent_category ?? null,
        returning_visitor: intentOverlay?.returning_visitor ?? false,
        existing_account: accountMatch?.matched === true,
        lead_inbox_id: id,
        growth_lead_id: null,
        prospect_id: null,
        customer_id: null,
      })
    }
  } catch {
    /* optional */
  }

  const orgId = getGrowthEngineAiOrgId()
  if (orgId) {
    try {
      let prospectQuery = admin
        .from("prospects")
        .select("id, company_name, website, notes")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(hasQuery ? 40 : 30)
      if (hasQuery) prospectQuery = prospectQuery.ilike("company_name", pattern)
      const { data } = await prospectQuery
      for (const raw of data ?? []) {
        const r = raw as Record<string, unknown>
        const id = asString(r.id)
        if (!id) continue
        upsertCompany({
          id,
          source_type: "crm_prospect",
          company_name: asString(r.company_name) || "Unknown",
          website: asString(r.website) || null,
          industry: null,
          subindustry: null,
          employees: null,
          revenue_range: null,
          location: null,
          city: null,
          state: null,
          service_area: null,
          notes: asString(r.notes) || null,
          keywords: [],
          crm_detected: null,
          website_platform: null,
          field_service_software: null,
          intent_score: null,
          buying_stage: null,
          lead_score: null,
          company_match_confidence: null,
          decision_maker_count: 0,
          verification_status: "crm_prospect",
          priority: null,
          signals: ["CRM prospect record."],
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
      const { data } = await customerQuery
      for (const raw of data ?? []) {
        const r = raw as Record<string, unknown>
        const id = asString(r.id)
        if (!id) continue
        upsertCompany({
          id,
          source_type: "crm_customer",
          company_name: asString(r.company_name) || "Unknown",
          website: null,
          industry: null,
          subindustry: null,
          employees: null,
          revenue_range: null,
          location: null,
          city: null,
          state: null,
          service_area: null,
          notes: asString(r.notes) || null,
          keywords: [],
          crm_detected: null,
          website_platform: null,
          field_service_software: null,
          intent_score: null,
          buying_stage: null,
          lead_score: null,
          company_match_confidence: null,
          decision_maker_count: 0,
          verification_status: "existing_account",
          priority: null,
          signals: ["Existing CRM customer."],
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

  return { companies: [...companyMap.values()], people }
}

export function prospectSearchDedupeHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}

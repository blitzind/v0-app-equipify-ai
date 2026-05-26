import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine, getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizePhone,
  normalizeWebsiteDomain,
} from "@/lib/growth/import/normalize"
import { probeGrowthLeadArchiveSchema } from "@/lib/growth/lead-archive-schema-health"
import type {
  CallWorkspaceLeadSearchDiagnostics,
  CallWorkspaceLeadSearchEntityType,
  CallWorkspaceLeadSearchResult,
  CallWorkspaceLeadSearchSourceCounts,
} from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

export type { CallWorkspaceLeadSearchResult, CallWorkspaceLeadSearchDiagnostics } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
export { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

const LEAD_SELECT =
  "id, company_name, contact_name, contact_email, contact_phone, website, source_kind, relationship_summary, promoted_prospect_id, archived_at, status"

type LeadRow = {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  source_kind: string | null
  relationship_summary: string | null
  promoted_prospect_id: string | null
  archived_at: string | null
  status: string | null
}

function escapePostgrestIlikeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "")
}

function buildIlikePattern(query: string): string {
  return `%${escapePostgrestIlikeValue(query.trim())}%`
}

function scoreTextMatch(input: {
  query: string
  value: string | null | undefined
  exactBoost?: number
  containsBoost?: number
}): { confidence: number; matchedField: string } | null {
  const needle = input.query.trim().toLowerCase()
  const hay = (input.value ?? "").trim().toLowerCase()
  if (!needle || !hay) return null
  if (hay === needle) {
    return { confidence: input.exactBoost ?? 0.95, matchedField: "exact" }
  }
  if (hay.includes(needle)) {
    return { confidence: input.containsBoost ?? 0.82, matchedField: "contains" }
  }
  const normalizedHay = normalizeCompanyName(hay)
  const normalizedNeedle = normalizeCompanyName(needle)
  if (normalizedHay && normalizedNeedle && normalizedHay === normalizedNeedle) {
    return { confidence: 0.93, matchedField: "normalized_exact" }
  }
  if (normalizedHay && normalizedNeedle && normalizedHay.includes(normalizedNeedle)) {
    return { confidence: 0.86, matchedField: "normalized_contains" }
  }
  return null
}

function mapLeadRow(
  row: LeadRow,
  input: {
    query: string
    entityType: CallWorkspaceLeadSearchEntityType
    matchedField: string
    confidence: number
    contactNameOverride?: string | null
    contactEmailOverride?: string | null
    contactPhoneOverride?: string | null
  },
): CallWorkspaceLeadSearchResult {
  return {
    leadId: row.id,
    companyName: row.company_name,
    contactName: input.contactNameOverride ?? row.contact_name,
    contactEmail: input.contactEmailOverride ?? row.contact_email,
    contactPhone: input.contactPhoneOverride ?? row.contact_phone,
    domain: normalizeWebsiteDomain(row.website),
    entityType: input.entityType,
    matchedField: input.matchedField,
    confidence: input.confidence,
    sourceKind: row.source_kind,
  }
}

function upsertResult(
  map: Map<string, CallWorkspaceLeadSearchResult>,
  candidate: CallWorkspaceLeadSearchResult,
): void {
  const existing = map.get(candidate.leadId)
  if (!existing || candidate.confidence > existing.confidence) {
    map.set(candidate.leadId, candidate)
  }
}

async function applyLeadArchiveFilter(
  admin: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
) {
  const probe = await probeGrowthLeadArchiveSchema(admin)
  return probe.archiveColumns ? query.is("archived_at", null) : query.neq("status", "archived")
}

async function searchGrowthLeads(
  admin: SupabaseClient,
  query: string,
  phoneDigits: string | null,
): Promise<{ results: CallWorkspaceLeadSearchResult[]; counts: Partial<CallWorkspaceLeadSearchSourceCounts> }> {
  const pattern = buildIlikePattern(query)
  const orFilters = [
    `company_name.ilike.${pattern}`,
    `contact_name.ilike.${pattern}`,
    `contact_email.ilike.${pattern}`,
    `contact_phone.ilike.${pattern}`,
    `website.ilike.${pattern}`,
    `city.ilike.${pattern}`,
    `state.ilike.${pattern}`,
    `relationship_summary.ilike.${pattern}`,
    `notes.ilike.${pattern}`,
    `external_ref.ilike.${pattern}`,
  ]
  if (phoneDigits) {
    orFilters.push(`contact_phone.ilike.%${phoneDigits}%`)
  }

  let leadQuery = admin
    .schema("growth")
    .from("leads")
    .select(LEAD_SELECT)
    .or(orFilters.join(","))
    .order("updated_at", { ascending: false })
    .limit(40)

  leadQuery = await applyLeadArchiveFilter(admin, leadQuery)

  const { data, error } = await leadQuery
  if (error) throw new Error(error.message)

  const map = new Map<string, CallWorkspaceLeadSearchResult>()
  let importCount = 0
  let relationshipCount = 0

  for (const row of (data ?? []) as LeadRow[]) {
    const companyMatch = scoreTextMatch({ query, value: row.company_name, exactBoost: 0.96, containsBoost: 0.88 })
    const contactMatch = scoreTextMatch({ query, value: row.contact_name, containsBoost: 0.8 })
    const emailMatch =
      normalizeEmail(query) && normalizeEmail(row.contact_email) === normalizeEmail(query)
        ? { confidence: 0.9, matchedField: "email_exact" }
        : scoreTextMatch({ query, value: row.contact_email, containsBoost: 0.78 })
    const phoneMatch =
      phoneDigits && normalizePhone(row.contact_phone) === phoneDigits
        ? { confidence: 0.9, matchedField: "phone_exact" }
        : null
    const websiteMatch =
      scoreTextMatch({ query, value: row.website, containsBoost: 0.76 }) ??
      (normalizeWebsiteDomain(query) &&
      normalizeWebsiteDomain(row.website) === normalizeWebsiteDomain(query)
        ? { confidence: 0.88, matchedField: "domain_exact" }
        : null)
    const relationshipMatch = row.relationship_summary
      ? scoreTextMatch({ query, value: row.relationship_summary, containsBoost: 0.72 })
      : null

    const best =
      companyMatch ??
      contactMatch ??
      emailMatch ??
      phoneMatch ??
      websiteMatch ??
      relationshipMatch ??
      ({ confidence: 0.7, matchedField: "db_ilike" } as const)

    const entityType: CallWorkspaceLeadSearchEntityType =
      row.source_kind === "import"
        ? "import_lead"
        : relationshipMatch
          ? "relationship_memory"
          : "growth_lead"

    if (entityType === "import_lead") importCount += 1
    if (entityType === "relationship_memory") relationshipCount += 1

    upsertResult(
      map,
      mapLeadRow(row, {
        query,
        entityType,
        matchedField: best.matchedField,
        confidence: best.confidence,
      }),
    )
  }

  return {
    results: [...map.values()],
    counts: {
      growth_leads: map.size - importCount - relationshipCount,
      import_leads: importCount,
      relationship_memory: relationshipCount,
    },
  }
}

async function searchDecisionMakers(
  admin: SupabaseClient,
  query: string,
  phoneDigits: string | null,
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const pattern = buildIlikePattern(query)
  const orFilters = [
    `full_name.ilike.${pattern}`,
    `email.ilike.${pattern}`,
    `title.ilike.${pattern}`,
    `phone.ilike.${pattern}`,
  ]
  if (phoneDigits) orFilters.push(`phone.ilike.%${phoneDigits}%`)

  const { data, error } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, lead_id, full_name, email, phone, title")
    .or(orFilters.join(","))
    .not("lead_id", "is", null)
    .limit(25)
  if (error) return { results: [], count: 0 }

  const leadIds = [...new Set((data ?? []).map((row) => row.lead_id as string).filter(Boolean))]
  if (leadIds.length === 0) return { results: [], count: 0 }

  let leadsQuery = admin.schema("growth").from("leads").select(LEAD_SELECT).in("id", leadIds)
  leadsQuery = await applyLeadArchiveFilter(admin, leadsQuery)
  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) return { results: [], count: 0 }

  const leadMap = new Map((leads ?? []).map((row) => [(row as LeadRow).id, row as LeadRow]))
  const results: CallWorkspaceLeadSearchResult[] = []

  for (const dm of data ?? []) {
    const lead = leadMap.get(dm.lead_id as string)
    if (!lead) continue
    const nameMatch = scoreTextMatch({ query, value: dm.full_name as string, containsBoost: 0.8 })
    const emailMatch =
      normalizeEmail(query) && normalizeEmail(dm.email as string) === normalizeEmail(query)
        ? { confidence: 0.88, matchedField: "dm_email_exact" }
        : scoreTextMatch({ query, value: dm.email as string, containsBoost: 0.75 })
    const phoneMatch =
      phoneDigits && normalizePhone(dm.phone as string) === phoneDigits
        ? { confidence: 0.88, matchedField: "dm_phone_exact" }
        : null
    const best = nameMatch ?? emailMatch ?? phoneMatch ?? { confidence: 0.74, matchedField: "dm_ilike" }
    results.push(
      mapLeadRow(lead, {
        query,
        entityType: "decision_maker",
        matchedField: best.matchedField,
        confidence: best.confidence,
        contactNameOverride: (dm.full_name as string) ?? lead.contact_name,
        contactEmailOverride: (dm.email as string) ?? lead.contact_email,
        contactPhoneOverride: (dm.phone as string) ?? lead.contact_phone,
      }),
    )
  }

  return { results, count: results.length }
}

async function searchOutboundContacts(
  admin: SupabaseClient,
  query: string,
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const email = normalizeEmail(query)
  if (!email && query.trim().length < 3) return { results: [], count: 0 }

  const pattern = buildIlikePattern(email ?? query)
  const { data, error } = await admin
    .schema("growth")
    .from("outbound_contacts")
    .select("lead_id, email")
    .ilike("email", pattern)
    .not("lead_id", "is", null)
    .limit(20)
  if (error) return { results: [], count: 0 }

  const leadIds = [...new Set((data ?? []).map((row) => row.lead_id as string))]
  if (leadIds.length === 0) return { results: [], count: 0 }

  let leadsQuery = admin.schema("growth").from("leads").select(LEAD_SELECT).in("id", leadIds)
  leadsQuery = await applyLeadArchiveFilter(admin, leadsQuery)
  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) return { results: [], count: 0 }

  const emailMap = new Map((data ?? []).map((row) => [row.lead_id as string, row.email as string]))
  return {
    results: (leads ?? []).map((row) =>
      mapLeadRow(row as LeadRow, {
        query,
        entityType: "outbound_contact",
        matchedField: "outbound_email",
        confidence: 0.8,
        contactEmailOverride: emailMap.get((row as LeadRow).id) ?? (row as LeadRow).contact_email,
      }),
    ),
    count: (leads ?? []).length,
  }
}

async function searchProspects(
  admin: SupabaseClient,
  query: string,
  phoneDigits: string | null,
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const orgId = getGrowthEngineAiOrgId()
  const pattern = buildIlikePattern(query)
  const orFilters = [
    `company_name.ilike.${pattern}`,
    `contact_name.ilike.${pattern}`,
    `contact_email.ilike.${pattern}`,
    `contact_phone.ilike.${pattern}`,
    `website.ilike.${pattern}`,
  ]
  if (phoneDigits) orFilters.push(`contact_phone.ilike.%${phoneDigits}%`)

  let prospectQuery = admin
    .from("prospects")
    .select("id, company_name, contact_name, contact_email, contact_phone, website, organization_id")
    .or(orFilters.join(","))
    .limit(25)
  if (orgId) prospectQuery = prospectQuery.eq("organization_id", orgId)

  const { data: prospects, error } = await prospectQuery
  if (error) return { results: [], count: 0 }

  const prospectIds = (prospects ?? []).map((row) => row.id as string)
  if (prospectIds.length === 0) return { results: [], count: 0 }

  let leadsQuery = admin
    .schema("growth")
    .from("leads")
    .select(LEAD_SELECT)
    .in("promoted_prospect_id", prospectIds)
  leadsQuery = await applyLeadArchiveFilter(admin, leadsQuery)
  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) return { results: [], count: 0 }

  const leadByProspect = new Map<string, LeadRow>()
  for (const row of leads ?? []) {
    const lead = row as LeadRow
    if (lead.promoted_prospect_id) leadByProspect.set(lead.promoted_prospect_id, lead)
  }

  const results: CallWorkspaceLeadSearchResult[] = []
  for (const prospect of prospects ?? []) {
    const lead = leadByProspect.get(prospect.id as string)
    if (!lead) continue
    const companyMatch = scoreTextMatch({
      query,
      value: prospect.company_name as string,
      exactBoost: 0.94,
      containsBoost: 0.86,
    })
    const best =
      companyMatch ??
      scoreTextMatch({ query, value: prospect.contact_name as string, containsBoost: 0.78 }) ??
      ({ confidence: 0.72, matchedField: "prospect_ilike" } as const)
    results.push(
      mapLeadRow(lead, {
        query,
        entityType: "prospect",
        matchedField: best.matchedField,
        confidence: best.confidence,
        contactNameOverride: (prospect.contact_name as string) ?? lead.contact_name,
        contactEmailOverride: (prospect.contact_email as string) ?? lead.contact_email,
        contactPhoneOverride: (prospect.contact_phone as string) ?? lead.contact_phone,
      }),
    )
  }

  return { results, count: results.length }
}

function pickAutoSelectLeadId(results: CallWorkspaceLeadSearchResult[]): string | null {
  const high = results.filter((row) => row.confidence >= 0.9)
  if (high.length === 1) return high[0]!.leadId
  if (results.length === 1 && results[0]!.confidence >= 0.85) return results[0]!.leadId
  return null
}

export async function searchCallWorkspaceLeads(
  admin: SupabaseClient,
  query: string,
): Promise<{ results: CallWorkspaceLeadSearchResult[]; diagnostics: CallWorkspaceLeadSearchDiagnostics }> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return {
      results: [],
      diagnostics: {
        qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
        query: trimmed,
        sourceCounts: {
          growth_leads: 0,
          prospects: 0,
          decision_makers: 0,
          outbound_contacts: 0,
          import_leads: 0,
          relationship_memory: 0,
        },
        matchedEntityTypes: [],
        resultCount: 0,
        autoSelectedLeadId: null,
      },
    }
  }

  const phoneDigits = normalizePhone(trimmed)
  const merged = new Map<string, CallWorkspaceLeadSearchResult>()

  const growth = await searchGrowthLeads(admin, trimmed, phoneDigits)
  for (const row of growth.results) upsertResult(merged, row)

  const decisionMakers = await searchDecisionMakers(admin, trimmed, phoneDigits)
  for (const row of decisionMakers.results) upsertResult(merged, row)

  const outbound = await searchOutboundContacts(admin, trimmed)
  for (const row of outbound.results) upsertResult(merged, row)

  const prospects = await searchProspects(admin, trimmed, phoneDigits)
  for (const row of prospects.results) upsertResult(merged, row)

  const results = [...merged.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12)

  const sourceCounts: CallWorkspaceLeadSearchSourceCounts = {
    growth_leads: results.filter((row) => row.entityType === "growth_lead").length,
    prospects: results.filter((row) => row.entityType === "prospect").length,
    decision_makers: results.filter((row) => row.entityType === "decision_maker").length,
    outbound_contacts: results.filter((row) => row.entityType === "outbound_contact").length,
    import_leads: results.filter((row) => row.entityType === "import_lead").length,
    relationship_memory: results.filter((row) => row.entityType === "relationship_memory").length,
  }

  const autoSelectedLeadId = pickAutoSelectLeadId(results)
  const matchedEntityTypes = [...new Set(results.map((row) => row.entityType))]

  const diagnostics: CallWorkspaceLeadSearchDiagnostics = {
    qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
    query: trimmed,
    sourceCounts,
    matchedEntityTypes,
    resultCount: results.length,
    autoSelectedLeadId,
  }

  logGrowthEngine("native_dialer_lead_search", {
    ...diagnostics,
    topMatch: results[0]
      ? { leadId: results[0].leadId, entityType: results[0].entityType, confidence: results[0].confidence }
      : null,
  })

  return { results, diagnostics }
}

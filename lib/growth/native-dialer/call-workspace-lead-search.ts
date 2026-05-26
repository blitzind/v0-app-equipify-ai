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
  CallWorkspaceLeadSearchDebugSource,
  CallWorkspaceLeadSearchDiagnostics,
  CallWorkspaceLeadSearchEntityType,
  CallWorkspaceLeadSearchResult,
  CallWorkspaceLeadSearchSource,
  CallWorkspaceLeadSearchSourceCounts,
} from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

export type { CallWorkspaceLeadSearchResult, CallWorkspaceLeadSearchDiagnostics } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
export { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"

const LEAD_SELECT =
  "id, company_name, contact_name, contact_email, contact_phone, website, source_kind, relationship_summary, promoted_prospect_id, archived_at, status"

const GROWTH_LEAD_ILIKE_FIELDS = [
  "company_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "website",
  "city",
  "state",
  "relationship_summary",
  "notes",
  "external_ref",
] as const

const DECISION_MAKER_ILIKE_FIELDS = ["full_name", "email", "title", "phone"] as const

const PROSPECT_ILIKE_FIELDS = [
  "company_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "website",
  "notes",
] as const

const CUSTOMER_ILIKE_FIELDS = ["company_name", "notes"] as const

const CUSTOMER_CONTACT_ILIKE_FIELDS = ["full_name", "email", "phone", "role"] as const

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

export type CallWorkspaceLeadSearchOptions = {
  debug?: boolean
}

/** Strip ilike metacharacters; commas break PostgREST `or()` parsing. */
export function sanitizeCallWorkspaceSearchQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, 80)
    .replace(/%/g, "")
    .replace(/\\/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildCallWorkspaceIlikePattern(query: string): string {
  const sanitized = sanitizeCallWorkspaceSearchQuery(query)
  return sanitized ? `%${sanitized}%` : "%"
}

function safeSourceErrorLabel(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "query_failed"
  const code = error.code?.trim()
  if (code) return code
  const message = (error.message ?? "").toLowerCase()
  if (message.includes("column")) return "column_error"
  if (message.includes("syntax")) return "syntax_error"
  return "query_failed"
}

function scoreTextMatch(input: {
  query: string
  value: string | null | undefined
  exactBoost?: number
  containsBoost?: number
}): { confidence: number; matchedField: string } | null {
  const needle = sanitizeCallWorkspaceSearchQuery(input.query).toLowerCase()
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

function buildHit(input: {
  id: string
  displayName: string
  companyName: string
  email: string | null
  phone: string | null
  source: CallWorkspaceLeadSearchSource
  confidence: number
  matchedField: string
  attachLeadId?: string | null
  domain?: string | null
  sourceKind?: string | null
  contactName?: string | null
}): CallWorkspaceLeadSearchResult {
  const attachLeadId =
    input.attachLeadId ??
    (input.source === "growth_lead" ||
    input.source === "import_lead" ||
    input.source === "relationship_memory"
      ? input.id
      : null)
  const contactName = input.contactName ?? null
  const email = input.email
  const phone = input.phone
  return {
    id: input.id,
    displayName: input.displayName,
    companyName: input.companyName,
    email,
    phone,
    source: input.source,
    confidence: input.confidence,
    attachLeadId,
    leadId: attachLeadId ?? input.id,
    contactName,
    contactEmail: email,
    contactPhone: phone,
    domain: input.domain ?? null,
    entityType: input.source,
    matchedField: input.matchedField,
    sourceKind: input.sourceKind ?? null,
  }
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
  const contactName = input.contactNameOverride ?? row.contact_name
  const email = input.contactEmailOverride ?? row.contact_email
  const phone = input.contactPhoneOverride ?? row.contact_phone
  return buildHit({
    id: row.id,
    displayName: contactName?.trim() || row.company_name,
    companyName: row.company_name,
    email,
    phone,
    source: input.entityType,
    confidence: input.confidence,
    matchedField: input.matchedField,
    attachLeadId: row.id,
    domain: normalizeWebsiteDomain(row.website),
    sourceKind: row.source_kind,
    contactName,
  })
}

function resultMergeKey(candidate: CallWorkspaceLeadSearchResult): string {
  if (candidate.attachLeadId) return `lead:${candidate.attachLeadId}`
  return `${candidate.source}:${candidate.id}`
}

function upsertResult(
  map: Map<string, CallWorkspaceLeadSearchResult>,
  candidate: CallWorkspaceLeadSearchResult,
): void {
  const key = resultMergeKey(candidate)
  const existing = map.get(key)
  if (!existing || candidate.confidence > existing.confidence) {
    map.set(key, candidate)
  }
}

async function findGrowthLeadIdByCompanyName(
  admin: SupabaseClient,
  companyName: string,
): Promise<string | null> {
  const normalized = normalizeCompanyName(companyName)
  if (!normalized) return null
  try {
    let leadQuery = admin
      .schema("growth")
      .from("leads")
      .select("id, company_name")
      .ilike("company_name", `%${sanitizeCallWorkspaceSearchQuery(companyName)}%`)
      .limit(5)
    leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
    const { data } = await leadQuery
    for (const row of data ?? []) {
      if (normalizeCompanyName((row as { company_name: string }).company_name) === normalized) {
        return (row as { id: string }).id
      }
    }
  } catch {
    return null
  }
  return null
}

function ingestLeadRows(
  map: Map<string, CallWorkspaceLeadSearchResult>,
  rows: LeadRow[],
  query: string,
  matchedFieldHint?: string,
): { importCount: number; relationshipCount: number } {
  let importCount = 0
  let relationshipCount = 0

  for (const row of rows) {
    const companyMatch = scoreTextMatch({ query, value: row.company_name, exactBoost: 0.96, containsBoost: 0.88 })
    const contactMatch = scoreTextMatch({ query, value: row.contact_name, containsBoost: 0.8 })
    const emailMatch =
      normalizeEmail(query) && normalizeEmail(row.contact_email) === normalizeEmail(query)
        ? { confidence: 0.9, matchedField: "email_exact" }
        : scoreTextMatch({ query, value: row.contact_email, containsBoost: 0.78 })
    const phoneDigits = normalizePhone(query)
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
      ({ confidence: 0.7, matchedField: matchedFieldHint ?? "db_ilike" } as const)

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

  return { importCount, relationshipCount }
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
  debugSources: CallWorkspaceLeadSearchDebugSource[],
): Promise<{ results: CallWorkspaceLeadSearchResult[]; counts: Partial<CallWorkspaceLeadSearchSourceCounts> }> {
  const pattern = buildCallWorkspaceIlikePattern(query)
  const map = new Map<string, CallWorkspaceLeadSearchResult>()
  let importCount = 0
  let relationshipCount = 0

  for (const field of GROWTH_LEAD_ILIKE_FIELDS) {
    const sourceName = `growth.leads.${field}`
    try {
      let leadQuery = admin
        .schema("growth")
        .from("leads")
        .select(LEAD_SELECT)
        .ilike(field, pattern)
        .order("updated_at", { ascending: false })
        .limit(40)

      leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
      const { data, error } = await leadQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
        continue
      }
      const rows = (data ?? []) as LeadRow[]
      debugSources.push({ name: sourceName, count: rows.length, error: null })
      const tallies = ingestLeadRows(map, rows, query, `growth_${field}`)
      importCount += tallies.importCount
      relationshipCount += tallies.relationshipCount
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  if (phoneDigits) {
    const sourceName = "growth.leads.contact_phone_digits"
    try {
      let leadQuery = admin
        .schema("growth")
        .from("leads")
        .select(LEAD_SELECT)
        .ilike("contact_phone", `%${phoneDigits}%`)
        .order("updated_at", { ascending: false })
        .limit(40)
      leadQuery = await applyLeadArchiveFilter(admin, leadQuery)
      const { data, error } = await leadQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
      } else {
        const rows = (data ?? []) as LeadRow[]
        debugSources.push({ name: sourceName, count: rows.length, error: null })
        const tallies = ingestLeadRows(map, rows, query, "phone_digits")
        importCount += tallies.importCount
        relationshipCount += tallies.relationshipCount
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
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
  debugSources: CallWorkspaceLeadSearchDebugSource[],
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const pattern = buildCallWorkspaceIlikePattern(query)
  const dmById = new Map<string, Record<string, unknown>>()

  for (const field of DECISION_MAKER_ILIKE_FIELDS) {
    const sourceName = `growth.lead_decision_makers.${field}`
    try {
      const { data, error } = await admin
        .schema("growth")
        .from("lead_decision_makers")
        .select("id, lead_id, full_name, email, phone, title")
        .ilike(field, pattern)
        .not("lead_id", "is", null)
        .limit(25)
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
        continue
      }
      const rows = data ?? []
      debugSources.push({ name: sourceName, count: rows.length, error: null })
      for (const row of rows) {
        dmById.set(row.id as string, row as Record<string, unknown>)
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  if (phoneDigits) {
    const sourceName = "growth.lead_decision_makers.phone_digits"
    try {
      const { data, error } = await admin
        .schema("growth")
        .from("lead_decision_makers")
        .select("id, lead_id, full_name, email, phone, title")
        .ilike("phone", `%${phoneDigits}%`)
        .not("lead_id", "is", null)
        .limit(25)
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
      } else {
        debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })
        for (const row of data ?? []) {
          dmById.set(row.id as string, row as Record<string, unknown>)
        }
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  const leadIds = [...new Set([...dmById.values()].map((row) => row.lead_id as string).filter(Boolean))]
  if (leadIds.length === 0) return { results: [], count: 0 }

  let leadsQuery = admin.schema("growth").from("leads").select(LEAD_SELECT).in("id", leadIds)
  leadsQuery = await applyLeadArchiveFilter(admin, leadsQuery)
  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) {
    debugSources.push({
      name: "growth.leads.decision_maker_join",
      count: 0,
      error: safeSourceErrorLabel(leadsError),
    })
    return { results: [], count: 0 }
  }

  const leadMap = new Map((leads ?? []).map((row) => [(row as LeadRow).id, row as LeadRow]))
  const results: CallWorkspaceLeadSearchResult[] = []

  for (const dm of dmById.values()) {
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
  debugSources: CallWorkspaceLeadSearchDebugSource[],
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const email = normalizeEmail(query)
  if (!email && query.trim().length < 3) return { results: [], count: 0 }

  const pattern = buildCallWorkspaceIlikePattern(email ?? query)
  const sourceName = "growth.outbound_contacts.email"
  try {
    const { data, error } = await admin
      .schema("growth")
      .from("outbound_contacts")
      .select("lead_id, email")
      .ilike("email", pattern)
      .not("lead_id", "is", null)
      .limit(20)
    if (error) {
      debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
      return { results: [], count: 0 }
    }
    debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })

    const leadIds = [...new Set((data ?? []).map((row) => row.lead_id as string))]
    if (leadIds.length === 0) return { results: [], count: 0 }

    let leadsQuery = admin.schema("growth").from("leads").select(LEAD_SELECT).in("id", leadIds)
    leadsQuery = await applyLeadArchiveFilter(admin, leadsQuery)
    const { data: leads, error: leadsError } = await leadsQuery
    if (leadsError) {
      debugSources.push({
        name: "growth.leads.outbound_join",
        count: 0,
        error: safeSourceErrorLabel(leadsError),
      })
      return { results: [], count: 0 }
    }

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
  } catch {
    debugSources.push({ name: sourceName, count: 0, error: "exception" })
    return { results: [], count: 0 }
  }
}

async function searchProspects(
  admin: SupabaseClient,
  query: string,
  phoneDigits: string | null,
  debugSources: CallWorkspaceLeadSearchDebugSource[],
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const orgId = getGrowthEngineAiOrgId()
  const pattern = buildCallWorkspaceIlikePattern(query)
  const prospectById = new Map<string, Record<string, unknown>>()

  for (const field of PROSPECT_ILIKE_FIELDS) {
    const sourceName = `public.prospects.${field}`
    try {
      let prospectQuery = admin
        .from("prospects")
        .select("id, company_name, contact_name, contact_email, contact_phone, website, organization_id")
        .is("archived_at", null)
        .ilike(field, pattern)
        .limit(25)
      if (orgId) prospectQuery = prospectQuery.eq("organization_id", orgId)

      const { data, error } = await prospectQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
        continue
      }
      debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })
      for (const row of data ?? []) {
        prospectById.set(row.id as string, row as Record<string, unknown>)
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  if (phoneDigits) {
    const sourceName = "public.prospects.contact_phone_digits"
    try {
      let prospectQuery = admin
        .from("prospects")
        .select("id, company_name, contact_name, contact_email, contact_phone, website, organization_id")
        .is("archived_at", null)
        .ilike("contact_phone", `%${phoneDigits}%`)
        .limit(25)
      if (orgId) prospectQuery = prospectQuery.eq("organization_id", orgId)
      const { data, error } = await prospectQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
      } else {
        debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })
        for (const row of data ?? []) {
          prospectById.set(row.id as string, row as Record<string, unknown>)
        }
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  const prospectIds = [...prospectById.keys()]
  if (prospectIds.length === 0) return { results: [], count: 0 }

  let leadsQuery = admin
    .schema("growth")
    .from("leads")
    .select(LEAD_SELECT)
    .in("promoted_prospect_id", prospectIds)
  leadsQuery = await applyLeadArchiveFilter(admin, leadsQuery)
  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) {
    debugSources.push({
      name: "growth.leads.prospect_join",
      count: 0,
      error: safeSourceErrorLabel(leadsError),
    })
    return { results: [], count: 0 }
  }

  const leadByProspect = new Map<string, LeadRow>()
  for (const row of leads ?? []) {
    const lead = row as LeadRow
    if (lead.promoted_prospect_id) leadByProspect.set(lead.promoted_prospect_id, lead)
  }

  const results: CallWorkspaceLeadSearchResult[] = []
  for (const prospect of prospectById.values()) {
    const lead = leadByProspect.get(prospect.id as string)
    const companyName = (prospect.company_name as string) ?? ""
    const contactName = (prospect.contact_name as string) ?? null
    const companyMatch = scoreTextMatch({
      query,
      value: companyName,
      exactBoost: 0.94,
      containsBoost: 0.86,
    })
    const best =
      companyMatch ??
      scoreTextMatch({ query, value: contactName, containsBoost: 0.78 }) ??
      ({ confidence: 0.72, matchedField: "prospect_ilike" } as const)

    if (lead) {
      results.push(
        mapLeadRow(lead, {
          query,
          entityType: "prospect",
          matchedField: best.matchedField,
          confidence: best.confidence,
          contactNameOverride: contactName ?? lead.contact_name,
          contactEmailOverride: (prospect.contact_email as string) ?? lead.contact_email,
          contactPhoneOverride: (prospect.contact_phone as string) ?? lead.contact_phone,
        }),
      )
      continue
    }

    results.push(
      buildHit({
        id: prospect.id as string,
        displayName: contactName?.trim() || companyName,
        companyName,
        email: (prospect.contact_email as string) ?? null,
        phone: (prospect.contact_phone as string) ?? null,
        source: "prospect",
        confidence: best.confidence,
        matchedField: best.matchedField,
        attachLeadId: null,
        domain: normalizeWebsiteDomain(prospect.website as string | null),
        contactName,
      }),
    )
  }

  return { results, count: results.length }
}

async function searchAccounts(
  admin: SupabaseClient,
  query: string,
  debugSources: CallWorkspaceLeadSearchDebugSource[],
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const orgId = getGrowthEngineAiOrgId()
  const pattern = buildCallWorkspaceIlikePattern(query)
  const customerById = new Map<string, Record<string, unknown>>()

  for (const field of CUSTOMER_ILIKE_FIELDS) {
    const sourceName = `public.customers.${field}`
    try {
      let customerQuery = admin
        .from("customers")
        .select("id, company_name, notes")
        .eq("is_archived", false)
        .ilike(field, pattern)
        .limit(25)
      if (orgId) customerQuery = customerQuery.eq("organization_id", orgId)
      const { data, error } = await customerQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
        continue
      }
      debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })
      for (const row of data ?? []) {
        customerById.set(row.id as string, row as Record<string, unknown>)
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  const results: CallWorkspaceLeadSearchResult[] = []
  for (const customer of customerById.values()) {
    const companyName = (customer.company_name as string) ?? ""
    const best =
      scoreTextMatch({ query, value: companyName, exactBoost: 0.9, containsBoost: 0.82 }) ??
      ({ confidence: 0.7, matchedField: "account_ilike" } as const)
    const attachLeadId = await findGrowthLeadIdByCompanyName(admin, companyName)
    results.push(
      buildHit({
        id: customer.id as string,
        displayName: companyName,
        companyName,
        email: null,
        phone: null,
        source: "account",
        confidence: best.confidence,
        matchedField: best.matchedField,
        attachLeadId,
        contactName: null,
      }),
    )
  }

  return { results, count: results.length }
}

async function searchCustomerContacts(
  admin: SupabaseClient,
  query: string,
  phoneDigits: string | null,
  debugSources: CallWorkspaceLeadSearchDebugSource[],
): Promise<{ results: CallWorkspaceLeadSearchResult[]; count: number }> {
  const orgId = getGrowthEngineAiOrgId()
  const pattern = buildCallWorkspaceIlikePattern(query)
  const contactById = new Map<string, Record<string, unknown>>()

  for (const field of CUSTOMER_CONTACT_ILIKE_FIELDS) {
    const sourceName = `public.customer_contacts.${field}`
    try {
      let contactQuery = admin
        .from("customer_contacts")
        .select("id, customer_id, full_name, email, phone, role")
        .ilike(field, pattern)
        .limit(25)
      if (orgId) contactQuery = contactQuery.eq("organization_id", orgId)
      const { data, error } = await contactQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
        continue
      }
      debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })
      for (const row of data ?? []) {
        contactById.set(row.id as string, row as Record<string, unknown>)
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  if (phoneDigits) {
    const sourceName = "public.customer_contacts.phone_digits"
    try {
      let contactQuery = admin
        .from("customer_contacts")
        .select("id, customer_id, full_name, email, phone, role")
        .ilike("phone", `%${phoneDigits}%`)
        .limit(25)
      if (orgId) contactQuery = contactQuery.eq("organization_id", orgId)
      const { data, error } = await contactQuery
      if (error) {
        debugSources.push({ name: sourceName, count: 0, error: safeSourceErrorLabel(error) })
      } else {
        debugSources.push({ name: sourceName, count: (data ?? []).length, error: null })
        for (const row of data ?? []) {
          contactById.set(row.id as string, row as Record<string, unknown>)
        }
      }
    } catch {
      debugSources.push({ name: sourceName, count: 0, error: "exception" })
    }
  }

  const customerIds = [...new Set([...contactById.values()].map((row) => row.customer_id as string))]
  const companyByCustomer = new Map<string, string>()
  if (customerIds.length > 0) {
    try {
      let customerQuery = admin.from("customers").select("id, company_name").in("id", customerIds)
      if (orgId) customerQuery = customerQuery.eq("organization_id", orgId)
      const { data } = await customerQuery
      for (const row of data ?? []) {
        companyByCustomer.set(row.id as string, row.company_name as string)
      }
    } catch {
      debugSources.push({ name: "public.customers.contact_join", count: 0, error: "exception" })
    }
  }

  const results: CallWorkspaceLeadSearchResult[] = []
  for (const contact of contactById.values()) {
    const fullName = (contact.full_name as string) ?? ""
    const companyName = companyByCustomer.get(contact.customer_id as string) ?? fullName
    const best =
      scoreTextMatch({ query, value: fullName, containsBoost: 0.8 }) ??
      scoreTextMatch({ query, value: contact.email as string, containsBoost: 0.76 }) ??
      ({ confidence: 0.72, matchedField: "contact_ilike" } as const)
    const attachLeadId = await findGrowthLeadIdByCompanyName(admin, companyName)
    results.push(
      buildHit({
        id: contact.id as string,
        displayName: fullName,
        companyName,
        email: (contact.email as string) ?? null,
        phone: (contact.phone as string) ?? null,
        source: "contact",
        confidence: best.confidence,
        matchedField: best.matchedField,
        attachLeadId,
        contactName: fullName,
      }),
    )
  }

  return { results, count: results.length }
}

function pickAutoSelectLeadId(results: CallWorkspaceLeadSearchResult[]): string | null {
  const attachable = results.filter((row) => row.attachLeadId)
  const high = attachable.filter((row) => row.confidence >= 0.9)
  if (high.length === 1) return high[0]!.attachLeadId
  if (attachable.length === 1 && attachable[0]!.confidence >= 0.85) {
    return attachable[0]!.attachLeadId
  }
  return null
}

export async function searchCallWorkspaceLeads(
  admin: SupabaseClient,
  query: string,
  options: CallWorkspaceLeadSearchOptions = {},
): Promise<{ results: CallWorkspaceLeadSearchResult[]; diagnostics: CallWorkspaceLeadSearchDiagnostics }> {
  const trimmed = sanitizeCallWorkspaceSearchQuery(query)
  const debugSources: CallWorkspaceLeadSearchDebugSource[] = []

  if (trimmed.length < 2) {
    return {
      results: [],
      diagnostics: {
        qaMarker: GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER,
        query: trimmed,
        sourceCounts: {
          growth_leads: 0,
          prospects: 0,
          contacts: 0,
          accounts: 0,
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

  try {
    const growth = await searchGrowthLeads(admin, trimmed, phoneDigits, debugSources)
    for (const row of growth.results) upsertResult(merged, row)
  } catch {
    debugSources.push({ name: "growth.leads", count: 0, error: "exception" })
  }

  try {
    const decisionMakers = await searchDecisionMakers(admin, trimmed, phoneDigits, debugSources)
    for (const row of decisionMakers.results) upsertResult(merged, row)
  } catch {
    debugSources.push({ name: "growth.lead_decision_makers", count: 0, error: "exception" })
  }

  try {
    const outbound = await searchOutboundContacts(admin, trimmed, debugSources)
    for (const row of outbound.results) upsertResult(merged, row)
  } catch {
    debugSources.push({ name: "growth.outbound_contacts", count: 0, error: "exception" })
  }

  try {
    const prospects = await searchProspects(admin, trimmed, phoneDigits, debugSources)
    for (const row of prospects.results) upsertResult(merged, row)
  } catch {
    debugSources.push({ name: "public.prospects", count: 0, error: "exception" })
  }

  try {
    const accounts = await searchAccounts(admin, trimmed, debugSources)
    for (const row of accounts.results) upsertResult(merged, row)
  } catch {
    debugSources.push({ name: "public.customers", count: 0, error: "exception" })
  }

  try {
    const contacts = await searchCustomerContacts(admin, trimmed, phoneDigits, debugSources)
    for (const row of contacts.results) upsertResult(merged, row)
  } catch {
    debugSources.push({ name: "public.customer_contacts", count: 0, error: "exception" })
  }

  const results = [...merged.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12)

  const sourceCounts: CallWorkspaceLeadSearchSourceCounts = {
    growth_leads: results.filter((row) => row.source === "growth_lead").length,
    prospects: results.filter((row) => row.source === "prospect").length,
    contacts: results.filter((row) => row.source === "contact").length,
    accounts: results.filter((row) => row.source === "account").length,
    decision_makers: results.filter((row) => row.source === "decision_maker").length,
    outbound_contacts: results.filter((row) => row.source === "outbound_contact").length,
    import_leads: results.filter((row) => row.source === "import_lead").length,
    relationship_memory: results.filter((row) => row.source === "relationship_memory").length,
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
    ...(options.debug
      ? {
          debug: {
            sources: debugSources,
            mergedCount: results.length,
            autoSelectedLeadId,
          },
        }
      : {}),
  }

  logGrowthEngine("native_dialer_lead_search", {
    ...diagnostics,
    topMatch: results[0]
      ? {
          id: results[0].id,
          attachLeadId: results[0].attachLeadId,
          source: results[0].source,
          displayName: results[0].displayName,
          confidence: results[0].confidence,
        }
      : null,
  })

  return { results, diagnostics }
}

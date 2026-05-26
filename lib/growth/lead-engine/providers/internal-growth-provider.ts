import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createProviderResponse,
  type GrowthLeadEngineCompanyResearchProvider,
  type GrowthLeadEngineContactResearchProvider,
  type GrowthLeadEngineDecisionMakerResearchProvider,
  type GrowthLeadEngineIntentSignalProvider,
  type GrowthLeadEngineProviderBundle,
  type GrowthLeadEngineProviderContext,
  type GrowthLeadEngineProviderResponse,
  type GrowthLeadEngineProviderSourceAttribution,
  type GrowthLeadEngineVerificationProvider,
  type GrowthLeadEngineWebsiteResearchProvider,
} from "@/lib/growth/lead-engine/providers/provider-types"
import {
  providerFailureResponse,
  providerSkippedResponse,
  runProviderIsolated,
} from "@/lib/growth/lead-engine/providers/provider-errors"
import { isGrowthIntentPixelSchemaReady } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"

const INTERNAL_PROVIDER_NAME = "lead_engine_internal_growth_provider"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function domainFromQuery(context: GrowthLeadEngineProviderContext): string {
  return asString(context.query.domain).toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? ""
}

function attributionFromRows(
  rows: Array<{ source: string; evidence: string; confidence?: number }>,
  section: string,
): GrowthLeadEngineProviderSourceAttribution[] {
  if (rows.length === 0) {
    return [
      {
        source: INTERNAL_PROVIDER_NAME,
        section,
        signal: "no_records",
        evidence: "No matching Growth Engine records — empty result, not fabricated.",
        confidence: 0,
      },
    ]
  }
  return rows.map((row) => ({
    source: row.source,
    section,
    signal: "growth_record",
    evidence: row.evidence,
    confidence: Math.max(0, Math.min(1, row.confidence ?? 0.6)),
  }))
}

async function safeTableQuery<T>(
  label: string,
  run: () => Promise<{ data: T | null; error: { message: string } | null }>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await run()
    if (error) return { data: null, error: `${label}: ${error.message}` }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: `${label}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function fetchMatchingLeads(
  admin: SupabaseClient,
  context: GrowthLeadEngineProviderContext,
): Promise<{ leads: Record<string, unknown>[]; errors: string[] }> {
  const errors: string[] = []
  const company = asString(context.query.company_name)
  const domain = domainFromQuery(context)

  let query = admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, contact_name, contact_email, contact_phone, website, status, notes, city, state, country, estimated_employee_count, estimated_annual_revenue",
    )
    .limit(10)

  if (company) query = query.ilike("company_name", `%${company}%`)
  const { data, error } = await safeTableQuery("growth.leads", () => query)
  if (error) {
    errors.push(error)
    return { leads: [], errors }
  }

  let leads = (data ?? []) as Record<string, unknown>[]
  if (domain) {
    leads = leads.filter((row) => {
      const website = asString(row.website).toLowerCase()
      return website.includes(domain)
    })
  }
  return { leads, errors }
}

async function fetchDecisionMakers(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<{ rows: Record<string, unknown>[]; errors: string[] }> {
  if (leadIds.length === 0) return { rows: [], errors: [] }
  const { data, error } = await safeTableQuery("growth.lead_decision_makers", () =>
    admin
      .schema("growth")
      .from("lead_decision_makers")
      .select("id, lead_id, full_name, title, email, phone, linkedin_url, source, confidence, evidence_excerpt, status, is_primary")
      .in("lead_id", leadIds)
      .limit(25),
  )
  if (error) return { rows: [], errors: [error] }
  return { rows: (data ?? []) as Record<string, unknown>[], errors: [] }
}

async function fetchProspects(
  admin: SupabaseClient,
  company: string,
): Promise<{ rows: Record<string, unknown>[]; errors: string[] }> {
  if (!company) return { rows: [], errors: [] }
  const { data, error } = await safeTableQuery("public.prospects", () =>
    admin.from("prospects").select("id, company_name, contact_name, email, phone").ilike("company_name", `%${company}%`).limit(10),
  )
  if (error) return { rows: [], errors: [error] }
  return { rows: (data ?? []) as Record<string, unknown>[], errors: [] }
}

async function fetchCustomers(
  admin: SupabaseClient,
  company: string,
): Promise<{ rows: Record<string, unknown>[]; errors: string[] }> {
  if (!company) return { rows: [], errors: [] }
  const { data, error } = await safeTableQuery("public.customers", () =>
    admin.from("customers").select("id, company_name").ilike("company_name", `%${company}%`).limit(10),
  )
  if (error) return { rows: [], errors: [error] }
  return { rows: (data ?? []) as Record<string, unknown>[], errors: [] }
}

async function fetchIntentSessions(
  admin: SupabaseClient,
  domain: string,
): Promise<{ count: number; errors: string[] }> {
  const ready = await isGrowthIntentPixelSchemaReady(admin)
  if (!ready) return { count: 0, errors: ["intent_pixel schema not ready"] }

  const { data: sites } = await safeTableQuery("growth.intent_pixel_sites", () =>
    admin.schema("growth").from("intent_pixel_sites").select("id").limit(1),
  )
  if (!sites || (Array.isArray(sites) && sites.length === 0)) {
    return { count: 0, errors: [] }
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let query = admin
    .schema("growth")
    .from("intent_visitor_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", since)

  if (domain) {
    query = query.or(`last_page_url.ilike.%${domain}%,first_landing_url.ilike.%${domain}%`)
  }

  try {
    const result = await query
    if (result.error) return { count: 0, errors: [`growth.intent_visitor_sessions: ${result.error.message}`] }
    return { count: result.count ?? 0, errors: [] }
  } catch (e) {
    return { count: 0, errors: [`growth.intent_visitor_sessions: ${e instanceof Error ? e.message : String(e)}`] }
  }
}

function wrapInternalProvider<T extends GrowthLeadEngineProviderResponse["provider_type"]>(
  admin: SupabaseClient | null | undefined,
  providerType: T,
  handler: (admin: SupabaseClient, context: GrowthLeadEngineProviderContext, requestId: string) => Promise<GrowthLeadEngineProviderResponse>,
): {
  provider_type: T
  research?: (context: GrowthLeadEngineProviderContext) => Promise<GrowthLeadEngineProviderResponse>
  verify?: (context: GrowthLeadEngineProviderContext) => Promise<GrowthLeadEngineProviderResponse>
  collect?: (context: GrowthLeadEngineProviderContext) => Promise<GrowthLeadEngineProviderResponse>
} {
  const invoke = async (context: GrowthLeadEngineProviderContext) => {
    const requestId = randomUUID()
    if (!admin) {
      return providerSkippedResponse(
        INTERNAL_PROVIDER_NAME,
        providerType,
        context,
        requestId,
        "Internal Growth provider requires service-role Supabase client.",
      )
    }
    return runProviderIsolated(INTERNAL_PROVIDER_NAME, providerType, context, requestId, () =>
      handler(admin, context, requestId),
    )
  }

  if (providerType === "verification") {
    return { provider_type: providerType, verify: invoke }
  }
  if (providerType === "intent_signal") {
    return { provider_type: providerType, collect: invoke }
  }
  return { provider_type: providerType, research: invoke }
}

export function createInternalGrowthLeadEngineProviderBundle(
  admin: SupabaseClient | null | undefined,
): GrowthLeadEngineProviderBundle {
  const company = wrapInternalProvider(admin, "company_research", async (client, context, requestId) => {
    const { leads, errors } = await fetchMatchingLeads(client, context)
    const attribution = attributionFromRows(
      leads.map((row) => ({
        source: "growth.leads",
        evidence: `Lead ${asString(row.id)}: ${asString(row.company_name)} (${asString(row.status)})`,
        confidence: 0.65,
      })),
      "company_research",
    )
    const normalized = { leads, lead_count: leads.length }
    return createProviderResponse({
      provider_name: INTERNAL_PROVIDER_NAME,
      provider_type: "company_research",
      request_id: requestId,
      query: { ...context.query, stage_id: context.stage_id },
      status: leads.length > 0 ? "success" : "partial",
      confidence: leads.length > 0 ? 0.65 : 0,
      source_attribution: attribution,
      raw_payload: { leads },
      normalized_payload: normalized,
      warnings: errors,
      errors: [],
    })
  })

  const decisionMaker = wrapInternalProvider(admin, "decision_maker_research", async (client, context, requestId) => {
    const { leads, errors: leadErrors } = await fetchMatchingLeads(client, context)
    const leadIds = leads.map((row) => asString(row.id)).filter(Boolean)
    const { rows, errors: dmErrors } = await fetchDecisionMakers(client, leadIds)
    const attribution = attributionFromRows(
      rows.map((row) => ({
        source: "growth.lead_decision_makers",
        evidence: `${asString(row.full_name)} — ${asString(row.title)} (${asString(row.source)})`,
        confidence: typeof row.confidence === "number" ? row.confidence / 100 : 0.5,
      })),
      "decision_maker_research",
    )
    const normalized = { decision_makers: rows, count: rows.length }
    return createProviderResponse({
      provider_name: INTERNAL_PROVIDER_NAME,
      provider_type: "decision_maker_research",
      request_id: requestId,
      query: { ...context.query, stage_id: context.stage_id },
      status: rows.length > 0 ? "success" : "partial",
      confidence: rows.length > 0 ? 0.6 : 0,
      source_attribution: attribution,
      raw_payload: { decision_makers: rows },
      normalized_payload: normalized,
      warnings: [...leadErrors, ...dmErrors],
      errors: [],
    })
  })

  const contact = wrapInternalProvider(admin, "contact_research", async (client, context, requestId) => {
    const { leads, errors: leadErrors } = await fetchMatchingLeads(client, context)
    const company = asString(context.query.company_name)
    const prospects = await fetchProspects(client, company)
    const customers = await fetchCustomers(client, company)

    const contacts = [
      ...leads.map((row) => ({
        source: "growth.leads",
        full_name: asString(row.contact_name) || null,
        email: asString(row.contact_email) || null,
        phone: asString(row.contact_phone) || null,
        company_name: asString(row.company_name),
      })),
      ...prospects.rows.map((row) => ({
        source: "public.prospects",
        full_name: asString(row.contact_name) || null,
        email: asString(row.email) || null,
        phone: asString(row.phone) || null,
        company_name: asString(row.company_name),
      })),
    ]

    const attribution = attributionFromRows(
      contacts
        .filter((c) => c.full_name || c.email || c.phone)
        .map((c) => ({
          source: c.source,
          evidence: [c.full_name, c.email, c.phone].filter(Boolean).join(" · "),
          confidence: 0.55,
        })),
      "contact_research",
    )

    const normalized = {
      contacts,
      contact_count: contacts.length,
      customers_found: customers.rows.length,
    }

    return createProviderResponse({
      provider_name: INTERNAL_PROVIDER_NAME,
      provider_type: "contact_research",
      request_id: requestId,
      query: { ...context.query, stage_id: context.stage_id },
      status: contacts.length > 0 ? "success" : "partial",
      confidence: contacts.length > 0 ? 0.55 : 0,
      source_attribution: attribution,
      raw_payload: { contacts, prospects: prospects.rows, customers: customers.rows },
      normalized_payload: normalized,
      warnings: [...leadErrors, ...prospects.errors, ...customers.errors],
      errors: [],
    })
  })

  const verificationProvider = wrapInternalProvider(admin, "verification", async (client, context, requestId) => {
    const { leads, errors } = await fetchMatchingLeads(client, context)
    const verified = leads.filter((row) => asString(row.contact_email) || asString(row.contact_phone))
    const attribution = attributionFromRows(
      verified.map((row) => ({
        source: "growth.leads",
        evidence: `Contact channel present on lead ${asString(row.id)}.`,
        confidence: 0.5,
      })),
      "verification",
    )
    return createProviderResponse({
      provider_name: INTERNAL_PROVIDER_NAME,
      provider_type: "verification",
      request_id: requestId,
      query: { ...context.query, stage_id: context.stage_id },
      status: verified.length > 0 ? "partial" : "skipped",
      confidence: verified.length > 0 ? 0.5 : 0,
      source_attribution: attribution,
      raw_payload: { verified_lead_ids: verified.map((r) => r.id) },
      normalized_payload: { verified_count: verified.length, lead_count: leads.length },
      warnings: [...errors, "Internal verification is record-presence only — no external verification API."],
      errors: [],
    })
  })

  const website = wrapInternalProvider(admin, "website_research", async (_client, context, requestId) => {
    const domain = domainFromQuery(context)
    const { leads } = admin ? await fetchMatchingLeads(admin, context) : { leads: [], errors: [] }
    const websites = leads.map((row) => asString(row.website)).filter(Boolean)
    const normalized = {
      domain: domain || null,
      websites,
      website_count: websites.length,
    }
    return createProviderResponse({
      provider_name: INTERNAL_PROVIDER_NAME,
      provider_type: "website_research",
      request_id: requestId,
      query: { ...context.query, stage_id: context.stage_id },
      status: websites.length > 0 || domain ? "partial" : "skipped",
      confidence: websites.length > 0 ? 0.45 : 0,
      source_attribution: attributionFromRows(
        websites.map((url) => ({
          source: "growth.leads",
          evidence: `Known website: ${url}`,
          confidence: 0.45,
        })),
        "website_research",
      ),
      raw_payload: normalized,
      normalized_payload: normalized,
      warnings: ["No website scraping — internal provider uses stored website fields only."],
      errors: [],
    })
  })

  const intent = wrapInternalProvider(admin, "intent_signal", async (client, context, requestId) => {
    const domain = domainFromQuery(context)
    const { count, errors } = await fetchIntentSessions(client, domain)
    const normalized = {
      intent_session_count_7d: count,
      domain: domain || null,
    }
    return createProviderResponse({
      provider_name: INTERNAL_PROVIDER_NAME,
      provider_type: "intent_signal",
      request_id: requestId,
      query: { ...context.query, stage_id: context.stage_id },
      status: count > 0 ? "success" : "partial",
      confidence: count > 0 ? 0.5 : 0,
      source_attribution: [
        {
          source: "growth.intent_visitor_sessions",
          section: "intent_signal",
          signal: "session_count",
          evidence:
            count > 0
              ? `${count} intent pixel session(s) in last 7 days for domain context.`
              : "No intent pixel sessions matched — empty result.",
          confidence: count > 0 ? 0.5 : 0,
        },
      ],
      raw_payload: normalized,
      normalized_payload: normalized,
      warnings: errors,
      errors: [],
    })
  })

  return {
    mode: "internal",
    company_research: company as GrowthLeadEngineCompanyResearchProvider,
    decision_maker_research: decisionMaker as GrowthLeadEngineDecisionMakerResearchProvider,
    contact_research: contact as GrowthLeadEngineContactResearchProvider,
    verification: verificationProvider as GrowthLeadEngineVerificationProvider,
    website_research: website as GrowthLeadEngineWebsiteResearchProvider,
    intent_signal: intent as GrowthLeadEngineIntentSignalProvider,
  }
}

/** Future external providers (Apollo, Seamless, etc.) — not implemented. */
export function createFutureExternalLeadEngineProviderBundle(): GrowthLeadEngineProviderBundle {
  const stub = (providerType: GrowthLeadEngineProviderResponse["provider_type"], context: GrowthLeadEngineProviderContext) =>
    providerSkippedResponse(
      "lead_engine_future_external_provider",
      providerType,
      context,
      randomUUID(),
      "future_external provider mode is reserved — no paid or external API integration.",
    )

  const noopResearch = (providerType: GrowthLeadEngineProviderResponse["provider_type"]) => ({
    provider_type: providerType,
    research: (context: GrowthLeadEngineProviderContext) => stub(providerType, context),
  })

  return {
    mode: "future_external",
    company_research: noopResearch("company_research") as GrowthLeadEngineCompanyResearchProvider,
    decision_maker_research: noopResearch("decision_maker_research") as GrowthLeadEngineDecisionMakerResearchProvider,
    contact_research: noopResearch("contact_research") as GrowthLeadEngineContactResearchProvider,
    verification: {
      provider_type: "verification",
      verify: (context) => stub("verification", context),
    },
    website_research: noopResearch("website_research") as GrowthLeadEngineWebsiteResearchProvider,
    intent_signal: {
      provider_type: "intent_signal",
      collect: (context) => stub("intent_signal", context),
    },
  }
}

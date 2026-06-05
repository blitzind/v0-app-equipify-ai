/**
 * Phase 7.PS-QA — Real-world Prospect Search field validation (read-only report).
 * Run: NODE_OPTIONS='--require ./scripts/shim-server-only.cjs' pnpm tsx scripts/qa-growth-prospect-search-field-7-ps-qa.ts
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

for (const path of [
  ".env.local",
  ".env.local.active",
  ".env.vercel.production",
  ".vercel/.env.production.local",
]) {
  loadEnvFile(path)
}
function resolveSupabaseUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.startsWith("http"))
  if (candidates[0]) return candidates[0]

  const jwt = extractJwtFromEnvFiles()
  if (!jwt) return null
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
      ref?: string
    }
    if (payload.ref) return `https://${payload.ref}.supabase.co`
  } catch {
    return null
  }
  return null
}

function extractJwtFromEnvFiles(): string | null {
  const direct = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
  if (direct.startsWith("eyJ")) return direct
  for (const path of [".env.local.active", ".env.local"]) {
    try {
      const raw = readFileSync(path, "utf8")
      const jwt = raw.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
      if (jwt) return jwt
    } catch {
      /* optional */
    }
  }
  return null
}

function resolveServiceRoleKey(): string | null {
  return extractJwtFromEnvFiles()
}

const resolvedCredentials = {
  url: resolveSupabaseUrl(),
  key: resolveServiceRoleKey(),
}
if (resolvedCredentials.url) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = resolvedCredentials.url
  process.env.SUPABASE_URL = resolvedCredentials.url
}
if (resolvedCredentials.key) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = resolvedCredentials.key
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = resolvedCredentials.key
  }
}

const SEARCHES = [
  "biomedical equipment service companies",
  "medical equipment repair companies",
  "dental equipment service companies",
  "calibration service companies",
  "regional field service businesses",
]

async function main() {
  const url = resolvedCredentials.url
  const key = resolvedCredentials.key
  if (!url || !key) {
    console.error("Missing Supabase credentials — cannot run live field validation.")
    process.exit(1)
  }

  const { runProspectSearch } = await import(
    "../lib/growth/prospect-search/prospect-search-repository"
  )
  const { buildProspectSearchOperatorWorkspace } = await import(
    "../lib/growth/prospect-search/prospect-search-workspace"
  )
  type GrowthProspectSearchCompanyResult = import("../lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchCompanyResult

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const growthEnabled = process.env.GROWTH_ENGINE_ENABLED?.trim() === "true"

  function summarizeCompany(company: GrowthProspectSearchCompanyResult) {
    const intel = company.contact_intelligence
    const engine = intel?.engine_intelligence ?? null
    const readiness = intel?.engine_readiness ?? null
    const coverage = intel?.engine_coverage ?? null
    const contacts = intel?.contacts ?? []
    const decisionMakers = contacts
      .filter((c) => {
        const title = (c.title ?? "").toLowerCase()
        return (
          title.includes("owner") ||
          title.includes("president") ||
          title.includes("director") ||
          title.includes("manager") ||
          title.includes("ceo") ||
          title.includes("operations")
        )
      })
      .slice(0, 5)
      .map((c) => ({
        name: c.full_name ?? c.id,
        title: c.title ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        canonical_person_id: c.canonical_person_id ?? null,
      }))

    return {
      company_name: company.company_name,
      company_id: company.id,
      source_type: company.source_type,
      domain: company.domain ?? company.website ?? null,
      canonical_company_id:
        engine?.canonical_company_id ?? company.canonical_company_id ?? null,
      canonical_resolved:
        coverage?.company?.resolved === true || readiness?.has_canonical_company === true,
      contact_count: contacts.length,
      linked_contacts: contacts.filter((c) => Boolean(c.canonical_person_id)).length,
      verified_emails: engine?.verified_channels?.persons_with_verified_email ?? 0,
      verified_phones: engine?.verified_channels?.persons_with_verified_phone ?? 0,
      verified_social: engine?.verified_channels?.persons_with_verified_profile ?? 0,
      committee_verified: engine?.buying_committee?.verified_member_count ?? 0,
      committee_roles_present: engine?.buying_committee?.roles_present ?? [],
      committee_roles_missing: engine?.buying_committee?.roles_missing ?? [],
      company_intelligence_verified: Boolean(engine?.company_intelligence?.has_verified_intelligence),
      intelligence_categories: engine?.company_intelligence?.categories_present?.length ?? 0,
      prioritization_tier: readiness?.prioritization_tier ?? null,
      research_completeness: readiness?.research_completeness ?? null,
      decision_makers: decisionMakers,
    }
  }

  const report: Record<string, unknown> = {
    qa_phase: "7.PS-QA",
    growth_engine_enabled: growthEnabled,
    searched_at: new Date().toISOString(),
    searches: [] as unknown[],
  }

  for (const query of SEARCHES) {
    const entry: Record<string, unknown> = { query, error: null as string | null }
    try {
      const result = await runProspectSearch(admin, {
        query,
        discovery_mode: "discover_external",
        result_mode: "companies",
        limit: 10,
        page: 1,
        page_size: 10,
        filters: {},
      })

      const companies = result.companies ?? []
      const summaries = companies.map(summarizeCompany)
      const workspace = buildProspectSearchOperatorWorkspace(companies)

      entry.discovery_mode = result.discovery_mode
      entry.provider_status_label = result.provider_status_label ?? null
      entry.provider_status_message = (result.provider_status_message ?? "").slice(0, 240)
      entry.built_query = result.real_world_built_query ?? null
      entry.total_companies = result.total_companies
      entry.hydration_summary = result.discovery_hydration?.summary ?? null
      entry.hydration_complete = result.discovery_hydration?.hydration_complete ?? null
      entry.companies = summaries
      entry.aggregate = {
        with_canonical: summaries.filter((s) => s.canonical_resolved).length,
        with_contacts: summaries.filter((s) => s.contact_count > 0).length,
        with_verified_email: summaries.filter((s) => s.verified_emails > 0).length,
        with_verified_phone: summaries.filter((s) => s.verified_phones > 0).length,
        with_verified_social: summaries.filter((s) => s.verified_social > 0).length,
        with_committee: summaries.filter((s) => s.committee_verified > 0).length,
        with_company_intel: summaries.filter((s) => s.company_intelligence_verified).length,
        outreach_ready: workspace.aggregates.prioritization.find(
          (r) => r.key === "accounts_ready_for_outreach",
        )?.count,
        research_first: workspace.aggregates.prioritization.find(
          (r) => r.key === "research_first_accounts",
        )?.count,
      }
      entry.workspace_queues = {
        missing_email: workspace.aggregates.research_queues.find(
          (q) => q.queue_id === "missing_verified_email",
        )?.count,
        missing_phone: workspace.aggregates.research_queues.find(
          (q) => q.queue_id === "missing_verified_phone",
        )?.count,
        missing_committee: workspace.aggregates.research_queues.find(
          (q) => q.queue_id === "missing_committee",
        )?.count,
      }
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e)
    }
    ;(report.searches as unknown[]).push(entry)
  }

  console.log(JSON.stringify(report, null, 2))
}

void main()

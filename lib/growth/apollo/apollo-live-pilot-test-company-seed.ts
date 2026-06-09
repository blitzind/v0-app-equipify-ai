/** Apollo LE-3 live pilot test company seed — server-only, no Apollo HTTP. */

import "server-only"

import { createHash, randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const APOLLO_LIVE_PILOT_TEST_COMPANY_SEED_QA_MARKER =
  "apollo-live-pilot-test-company-seed-le-3-v1" as const

export const APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER =
  "apollo-live-pilot-test-company-le-3-v1" as const

export type ApolloLivePilotTestCompanySeedInput = {
  company_name: string
  domain: string
  website: string
}

export type ApolloLivePilotTestCompanySeedResult = {
  ok: boolean
  created: boolean
  company_candidate_id: string | null
  company_id: string | null
  company_name: string | null
  domain: string | null
  website: string | null
  source_marker: typeof APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER
  env_hint: string | null
  message: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeApolloTestCompanyDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]!
}

export function normalizeApolloTestCompanyWebsite(domain: string, website?: string): string {
  const raw = website?.trim()
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw
    return `https://${raw.replace(/^\/\//, "")}`
  }
  return `https://${normalizeApolloTestCompanyDomain(domain)}`
}

export function buildApolloTestCompanyDedupeHash(domain: string): string {
  return createHash("sha256")
    .update([APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER, normalizeApolloTestCompanyDomain(domain)].join("|"))
    .digest("hex")
    .slice(0, 32)
}

export function validateApolloLivePilotTestCompanySeedEnv(
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; errors: string[]; input: ApolloLivePilotTestCompanySeedInput | null } {
  const errors: string[] = []

  if (env.APOLLO_TEST_COMPANY_SEED_ACK !== "1") {
    errors.push("Set APOLLO_TEST_COMPANY_SEED_ACK=1 to seed one Apollo live pilot test company")
  }

  const company_name = env.APOLLO_TEST_COMPANY_NAME?.trim() ?? ""
  const domainRaw = env.APOLLO_TEST_COMPANY_DOMAIN?.trim() ?? ""
  const websiteRaw = env.APOLLO_TEST_COMPANY_WEBSITE?.trim() ?? ""

  if (!company_name) errors.push("APOLLO_TEST_COMPANY_NAME is required")
  if (!domainRaw) errors.push("APOLLO_TEST_COMPANY_DOMAIN is required")
  if (!websiteRaw && !domainRaw) errors.push("APOLLO_TEST_COMPANY_WEBSITE or APOLLO_TEST_COMPANY_DOMAIN is required")

  if (errors.length > 0) return { ok: false, errors, input: null }

  const domain = normalizeApolloTestCompanyDomain(domainRaw)
  const website = normalizeApolloTestCompanyWebsite(domain, websiteRaw || domainRaw)

  if (!domain.includes(".")) {
    errors.push("APOLLO_TEST_COMPANY_DOMAIN must look like a valid domain")
  }

  return {
    ok: errors.length === 0,
    errors,
    input: errors.length === 0 ? { company_name, domain, website } : null,
  }
}

export async function findExistingSeededApolloTestCompany(
  admin: SupabaseClient,
  domain: string,
): Promise<Record<string, unknown> | null> {
  const normalized = normalizeApolloTestCompanyDomain(domain)
  const dedupe_hash = buildApolloTestCompanyDedupeHash(normalized)

  const { data: byHash } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, domain, website, is_suppressed, is_duplicate, metadata")
    .eq("dedupe_hash", dedupe_hash)
    .limit(1)
    .maybeSingle()

  if (byHash) return byHash as Record<string, unknown>

  const { data: rows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, domain, website, is_suppressed, is_duplicate, metadata")
    .eq("domain", normalized)
    .limit(10)

  for (const row of rows ?? []) {
    const metadata = (row as Record<string, unknown>).metadata
    if (
      metadata &&
      typeof metadata === "object" &&
      (metadata as Record<string, unknown>).source_marker === APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER
    ) {
      return row as Record<string, unknown>
    }
  }

  return null
}

export async function seedApolloLivePilotTestCompany(
  admin: SupabaseClient,
  input: ApolloLivePilotTestCompanySeedInput,
): Promise<ApolloLivePilotTestCompanySeedResult> {
  const domain = normalizeApolloTestCompanyDomain(input.domain)
  const website = normalizeApolloTestCompanyWebsite(domain, input.website)
  const dedupe_hash = buildApolloTestCompanyDedupeHash(domain)

  const existing = await findExistingSeededApolloTestCompany(admin, domain)
  if (existing) {
    const companyId = asString(existing.company_id) || asString(existing.id)
    return {
      ok: true,
      created: false,
      company_candidate_id: companyId,
      company_id: asString(existing.company_id) || null,
      company_name: asString(existing.company_name) || input.company_name,
      domain: asString(existing.domain) || domain,
      website: asString(existing.website) || website,
      source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
      env_hint: `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=${companyId}`,
      message: "Existing seeded Apollo live pilot test company found — no duplicate created.",
    }
  }

  const company_id = randomUUID()
  const now = new Date().toISOString()

  const { data: run, error: runError } = await admin
    .schema("growth")
    .from("discovery_runs")
    .insert({
      run_type: "manual",
      segment_key: "apollo_live_pilot_test",
      discovery_source_type: "manual_seed",
      query_text: `Apollo live pilot test company seed: ${input.company_name}`,
      industry: "biomedical_services",
      status: "completed",
      new_companies_found: 1,
      started_at: now,
      completed_at: now,
      metadata: {
        source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
        seed_phase: "LE-3",
        purpose: "apollo_live_pilot_only",
      },
    })
    .select("id")
    .single()

  if (runError || !run) {
    return {
      ok: false,
      created: false,
      company_candidate_id: null,
      company_id: null,
      company_name: input.company_name,
      domain,
      website,
      source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
      env_hint: null,
      message: runError?.message ?? "Failed to create discovery_runs row",
    }
  }

  const run_id = asString((run as Record<string, unknown>).id)

  const { data: inserted, error: insertError } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .insert({
      run_id,
      company_id,
      source_type: "external_discovered",
      company_name: input.company_name,
      website,
      domain,
      industry: "biomedical_services",
      discovery_source_type: "manual_seed",
      source_confidence: 90,
      evidence: [
        {
          claim: "Operator-seeded Apollo live pilot test company",
          evidence: `LE-3 seed for controlled Apollo pilot only — domain ${domain}`,
          source: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
        },
      ],
      reason_discovered: "Apollo live pilot test company (LE-3 operator seed — no outreach)",
      dedupe_hash,
      is_suppressed: false,
      is_duplicate: false,
      high_fit: true,
      metadata: {
        source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
        seed_phase: "LE-3",
        no_outreach: true,
        no_enrollment: true,
        apollo_live_pilot_only: true,
      },
      discovered_at: now,
    })
    .select("id, company_id, company_name, domain, website")
    .single()

  if (insertError || !inserted) {
    return {
      ok: false,
      created: false,
      company_candidate_id: null,
      company_id: null,
      company_name: input.company_name,
      domain,
      website,
      source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
      env_hint: null,
      message: insertError?.message ?? "Failed to insert discovery_candidates row",
    }
  }

  const row = inserted as Record<string, unknown>
  const candidateId = asString(row.company_id) || asString(row.id)

  return {
    ok: true,
    created: true,
    company_candidate_id: candidateId,
    company_id: asString(row.company_id) || null,
    company_name: asString(row.company_name) || input.company_name,
    domain: asString(row.domain) || domain,
    website: asString(row.website) || website,
    source_marker: APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
    env_hint: `GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=${candidateId}`,
    message: "Seeded one Apollo live pilot test company (no outreach, no Apollo HTTP).",
  }
}

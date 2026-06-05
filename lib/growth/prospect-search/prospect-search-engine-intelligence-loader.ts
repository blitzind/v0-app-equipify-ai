import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { analyzeBuyingCommitteeCoverage } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-coverage"
import { loadCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-operator-status"
import {
  resolveProspectSearchCanonicalCompanyId,
  resolveProspectSearchCompanyCoverageBatch,
} from "@/lib/growth/prospect-search/prospect-search-canonical-resolution"
import { probeProspectSearchEngineIntelligenceSchema } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-schema-health"
import {
  GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
  type GrowthProspectSearchBuyingCommitteeMember,
  type GrowthProspectSearchEngineIntelligence,
  type GrowthProspectSearchVerifiedChannelPerson,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function loadCompanyIntelligenceRead(
  admin: SupabaseClient,
  company_id: string,
): Promise<GrowthProspectSearchEngineIntelligence["company_intelligence"]> {
  const status = await loadCompanyIntelligenceOperatorStatus(admin, { company_id })
  if (!status) return null

  const { data: snapshots } = await admin
    .schema("growth")
    .from("company_intelligence_snapshots")
    .select("intelligence_category, intelligence_key, value_text, confidence, verification_status")
    .eq("company_id", company_id)
    .eq("verification_status", "verified")
    .order("confidence", { ascending: false })
    .limit(24)

  return {
    has_verified_intelligence: status.has_verified_intelligence,
    snapshot_count: status.snapshot_count,
    categories_present: status.categories_present,
    discovery_status: status.discovery_status,
    snapshots: (snapshots ?? []).map((row) => ({
      intelligence_category: asString(row.intelligence_category),
      intelligence_key: asString(row.intelligence_key),
      value_text: asString(row.value_text) || null,
      confidence: asNumber(row.confidence),
      verification_status: asString(row.verification_status) || "verified",
    })),
  }
}

async function loadBuyingCommitteeRead(
  admin: SupabaseClient,
  company_id: string,
): Promise<GrowthProspectSearchEngineIntelligence["buying_committee"]> {
  const { data: rows } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("person_id, full_name, job_title, committee_role, confidence, verification_status")
    .eq("company_id", company_id)
    .eq("verification_status", "verified")
    .order("confidence", { ascending: false })
    .limit(50)

  const members: GrowthProspectSearchBuyingCommitteeMember[] = (rows ?? []).map((row) => ({
    person_id: asString(row.person_id),
    full_name: asString(row.full_name) || "Unknown",
    job_title: asString(row.job_title) || null,
    committee_role: asString(row.committee_role),
    confidence: asNumber(row.confidence),
  }))

  const verified_roles = [...new Set(members.map((m) => String(m.committee_role)).filter(Boolean))]
  const verified_person_ids = [...new Set(members.map((m) => m.person_id).filter(Boolean))]
  const coverage = analyzeBuyingCommitteeCoverage({ verified_roles, verified_person_ids })

  return {
    member_count: members.length,
    verified_member_count: members.length,
    coverage_score: coverage.coverage_score,
    single_thread_risk: coverage.single_thread_risk,
    roles_present: verified_roles,
    roles_missing: coverage.roles_missing,
    members,
  }
}

async function loadVerifiedChannelsRead(
  admin: SupabaseClient,
  company_id: string,
  extraPersonIds: string[],
): Promise<GrowthProspectSearchEngineIntelligence["verified_channels"]> {
  const { data: roles } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id")
    .eq("company_id", company_id)
    .limit(200)

  const personIds = [
    ...new Set(
      [...(roles ?? []).map((r) => asString(r.person_id)), ...extraPersonIds.map(asString)].filter(Boolean),
    ),
  ]

  if (personIds.length === 0) {
    return {
      person_count: 0,
      persons_with_verified_email: 0,
      persons_with_verified_phone: 0,
      persons_with_verified_profile: 0,
      by_person_id: {},
    }
  }

  const [emailsResult, phonesResult, profilesResult] = await Promise.all([
    admin
      .schema("growth")
      .from("person_emails")
      .select("person_id, email, normalized_email, is_primary, confidence")
      .in("person_id", personIds)
      .eq("verification_status", "verified")
      .order("is_primary", { ascending: false })
      .order("confidence", { ascending: false }),
    admin
      .schema("growth")
      .from("person_phones")
      .select("person_id, phone, normalized_phone, is_primary, confidence")
      .in("person_id", personIds)
      .eq("verification_status", "verified")
      .order("is_primary", { ascending: false })
      .order("confidence", { ascending: false }),
    admin
      .schema("growth")
      .from("person_profiles")
      .select("person_id, profile_url, normalized_profile_key, is_primary, confidence")
      .in("person_id", personIds)
      .eq("verification_status", "verified")
      .order("is_primary", { ascending: false })
      .order("confidence", { ascending: false }),
  ])

  const by_person_id: Record<string, GrowthProspectSearchVerifiedChannelPerson> = {}
  for (const person_id of personIds) {
    by_person_id[person_id] = {
      person_id,
      has_verified_email: false,
      verified_email: null,
      has_verified_phone: false,
      verified_phone: null,
      has_verified_profile: false,
      verified_profile_url: null,
    }
  }

  for (const row of emailsResult.data ?? []) {
    const person_id = asString(row.person_id)
    const bucket = by_person_id[person_id]
    if (!bucket || bucket.has_verified_email) continue
    bucket.has_verified_email = true
    bucket.verified_email =
      asString(row.email) || asString(row.normalized_email) || null
  }

  for (const row of phonesResult.data ?? []) {
    const person_id = asString(row.person_id)
    const bucket = by_person_id[person_id]
    if (!bucket || bucket.has_verified_phone) continue
    bucket.has_verified_phone = true
    bucket.verified_phone =
      asString(row.phone) || asString(row.normalized_phone) || null
  }

  for (const row of profilesResult.data ?? []) {
    const person_id = asString(row.person_id)
    const bucket = by_person_id[person_id]
    if (!bucket || bucket.has_verified_profile) continue
    bucket.has_verified_profile = true
    bucket.verified_profile_url =
      asString(row.profile_url) || asString(row.normalized_profile_key) || null
  }

  const persons = Object.values(by_person_id)
  return {
    person_count: persons.length,
    persons_with_verified_email: persons.filter((p) => p.has_verified_email).length,
    persons_with_verified_phone: persons.filter((p) => p.has_verified_phone).length,
    persons_with_verified_profile: persons.filter((p) => p.has_verified_profile).length,
    by_person_id,
  }
}

export async function loadProspectSearchEngineIntelligence(
  admin: SupabaseClient,
  input: {
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
    canonical_company_id?: string | null
    extra_person_ids?: string[]
    schema_health?: GrowthSchemaHealthSummary | null
  },
): Promise<GrowthProspectSearchEngineIntelligence> {
  const schema_health =
    input.schema_health ?? (await probeProspectSearchEngineIntelligenceSchema(admin))
  const schema_ready = schema_health.ready

  const canonical_company_id =
    asString(input.canonical_company_id) ||
    (await resolveProspectSearchCanonicalCompanyId(admin, input))

  const source_labels: string[] = []
  if (canonical_company_id) source_labels.push("growth.canonical_companies")

  if (!canonical_company_id || !schema_ready) {
    return {
      qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
      schema_ready,
      schema_health,
      canonical_company_id,
      has_canonical_company: Boolean(canonical_company_id),
      company_intelligence: null,
      buying_committee: null,
      verified_channels: null,
      source_labels,
    }
  }

  const [company_intelligence, buying_committee, verified_channels] = await Promise.all([
    loadCompanyIntelligenceRead(admin, canonical_company_id).catch(() => null),
    loadBuyingCommitteeRead(admin, canonical_company_id).catch(() => null),
    loadVerifiedChannelsRead(admin, canonical_company_id, input.extra_person_ids ?? []).catch(
      () => null,
    ),
  ])

  if (company_intelligence) source_labels.push("growth.company_intelligence")
  if (buying_committee?.verified_member_count) source_labels.push("growth.buying_committee_intelligence")
  if (verified_channels?.persons_with_verified_email) source_labels.push("growth.email_discovery")
  if (verified_channels?.persons_with_verified_phone) source_labels.push("growth.phone_discovery")
  if (verified_channels?.persons_with_verified_profile) {
    source_labels.push("growth.social_profile_discovery")
  }

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
    schema_ready,
    schema_health,
    canonical_company_id,
    has_canonical_company: true,
    company_intelligence,
    buying_committee,
    verified_channels,
    source_labels,
  }
}

export async function loadProspectSearchEngineIntelligenceBatch(
  admin: SupabaseClient,
  companies: Array<{
    key: string
    source_type: GrowthProspectSearchSourceType
    id: string
    growth_lead_id: string | null
    website?: string | null
    extra_person_ids?: string[]
    lead_metadata?: Record<string, unknown> | null
    canonical_company_id?: string | null
  }>,
): Promise<Map<string, GrowthProspectSearchEngineIntelligence>> {
  const map = new Map<string, GrowthProspectSearchEngineIntelligence>()
  if (companies.length === 0) return map

  let schema_health: GrowthSchemaHealthSummary
  try {
    schema_health = await probeProspectSearchEngineIntelligenceSchema(admin)
  } catch {
    schema_health = {
      ready: false,
      verified: false,
      uncertain: true,
      missing_objects: [],
      warning_message: "Growth Engine intelligence schema probe unavailable.",
      env_hint: null,
    }
  }

  const coverageByKey = await resolveProspectSearchCompanyCoverageBatch(
    admin,
    companies.map((company) => ({
      key: company.key,
      source_type: company.source_type,
      id: company.id,
      growth_lead_id: company.growth_lead_id,
      website: company.website,
      lead_metadata: company.lead_metadata ?? null,
    })),
  )

  await Promise.allSettled(
    companies.map(async (company) => {
      try {
        const intelligence = await loadProspectSearchEngineIntelligence(admin, {
          ...company,
          canonical_company_id:
            company.canonical_company_id ??
            coverageByKey.get(company.key)?.canonical_company_id ??
            null,
          schema_health,
        })
        map.set(company.key, intelligence)
      } catch {
        map.set(company.key, {
          qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
          schema_ready: schema_health.ready,
          schema_health,
          canonical_company_id: canonicalByKey.get(company.key) ?? null,
          has_canonical_company: Boolean(canonicalByKey.get(company.key)),
          company_intelligence: null,
          buying_committee: null,
          verified_channels: null,
          source_labels: [],
        })
      }
    }),
  )

  return map
}

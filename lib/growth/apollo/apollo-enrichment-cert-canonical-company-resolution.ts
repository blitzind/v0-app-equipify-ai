/** Apollo EN-3 canonical company resolution — server-only, no Apollo HTTP. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emptyApolloEnrichmentCertCanonicalCompanyResolutionEvidence,
  summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure,
  type ApolloEnrichmentCertCanonicalCompanyResolutionEvidence,
} from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"
import { promoteCanonicalCompanyCandidates } from "@/lib/growth/canonical-companies/canonical-company-backfill"
import {
  mapDiscoveryCandidateRow,
  mapExternalCompanyCandidateRow,
  mapRealWorldCompanyCandidateRow,
} from "@/lib/growth/canonical-companies/canonical-company-candidate-mappers"
import {
  canonicalNameCityKey,
  canonicalNameStateKey,
  canonicalNormalizedCompanyName,
  canonicalNormalizedDomain,
} from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  ensureStagingCanonicalCompanyLinkage,
  loadStagingCompanyCandidateRow,
  type GrowthStagingCompanyCandidateTable,
} from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"

export type {
  ApolloEnrichmentCertCanonicalCompanyResolutionEvidence,
} from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"
export {
  APOLLO_ENRICHMENT_CERT_CANONICAL_COMPANY_RESOLUTION_EVIDENCE_QA_MARKER,
  emptyApolloEnrichmentCertCanonicalCompanyResolutionEvidence,
  summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure,
} from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution-evidence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stagingDomainRaw(row: Record<string, unknown>): string | null {
  return asString(row.domain) || asString(row.website) || null
}

function mapStagingRowToCanonicalInput(
  source_table: GrowthStagingCompanyCandidateTable,
  row: Record<string, unknown>,
) {
  if (source_table === "external_company_candidates") return mapExternalCompanyCandidateRow(row)
  if (source_table === "real_world_company_candidates") return mapRealWorldCompanyCandidateRow(row)
  return mapDiscoveryCandidateRow(row)
}

async function resolveCanonicalCompanyIdFromDomain(
  admin: SupabaseClient,
  domain: string | null,
): Promise<string | null> {
  const normalized = canonicalNormalizedDomain(domain, null)
  if (!normalized) return null

  const { data: primary } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", normalized)
    .eq("status", "active")
    .maybeSingle()
  const primaryId = asString(primary?.id)
  if (primaryId) return primaryId

  const { data: alias } = await admin
    .schema("growth")
    .from("company_domains")
    .select("company_id")
    .eq("normalized_domain", normalized)
    .limit(1)
    .maybeSingle()
  return asString(alias?.company_id) || null
}

async function resolveCanonicalCompanyIdFromCompanyName(
  admin: SupabaseClient,
  input: {
    company_name: string | null
    city?: string | null
    state?: string | null
  },
): Promise<{ company_id: string; method: "name_city" | "name_state" | "normalized_name" } | null> {
  const company_name = asString(input.company_name)
  if (!company_name) return null

  const nameCityKey = canonicalNameCityKey(company_name, input.city)
  const nameStateKey = canonicalNameStateKey(company_name, input.state)
  const normalizedName = canonicalNormalizedCompanyName(company_name)

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, normalized_name, city, state")
    .eq("status", "active")
    .limit(5000)

  for (const raw of companies ?? []) {
    const row = raw as Record<string, unknown>
    const id = asString(row.id)
    if (!id) continue

    const rowNameCity = canonicalNameCityKey(
      asString(row.normalized_name) || company_name,
      asString(row.city),
    )
    if (nameCityKey && rowNameCity && rowNameCity === nameCityKey) {
      return { company_id: id, method: "name_city" }
    }

    const rowNameState = canonicalNameStateKey(
      asString(row.normalized_name) || company_name,
      asString(row.state),
    )
    if (nameStateKey && rowNameState && rowNameState === nameStateKey) {
      return { company_id: id, method: "name_state" }
    }

    if (normalizedName && asString(row.normalized_name) === normalizedName) {
      return { company_id: id, method: "normalized_name" }
    }
  }

  return null
}

async function promoteStagingRowViaBackfill(
  admin: SupabaseClient,
  staging: NonNullable<Awaited<ReturnType<typeof loadStagingCompanyCandidateRow>>>,
): Promise<{
  company_id: string | null
  ok: boolean
  errors: string[]
  company_ids: string[]
}> {
  const mapped = mapStagingRowToCanonicalInput(staging.source_table, staging.row)
  mapped.source_id = staging.staging_row_id

  const { outcomes } = await promoteCanonicalCompanyCandidates(admin, {
    mode: "apply",
    candidates: [mapped],
  })

  const company_ids = outcomes
    .map((outcome) => (outcome.ok ? asString(outcome.company_id) : ""))
    .filter(Boolean)
  const errors = outcomes
    .filter((outcome) => !outcome.ok)
    .map((outcome) => ("error" in outcome ? outcome.error : "unknown_backfill_error"))

  const outcome = outcomes[0]
  if (!outcome?.ok || !outcome.company_id) {
    return { company_id: null, ok: false, errors, company_ids }
  }

  return { company_id: outcome.company_id, ok: true, errors, company_ids }
}

export async function resolveApolloEnrichmentCanonicalCompanyId(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    domain?: string | null
    explicit_canonical_company_id?: string | null
  },
): Promise<{
  canonical_company_id: string | null
  resolution_blockers: string[]
  evidence: ApolloEnrichmentCertCanonicalCompanyResolutionEvidence
}> {
  const lookup_key = input.company_candidate_id.trim()
  const evidence = emptyApolloEnrichmentCertCanonicalCompanyResolutionEvidence(lookup_key)
  const resolution_blockers: string[] = []

  const staging = await loadStagingCompanyCandidateRow(admin, lookup_key)
  if (staging) {
    evidence.staging_table_detected = staging.source_table
    evidence.staging_row_id = staging.staging_row_id
    evidence.candidate_company_name = asString(staging.row.company_name) || null
    evidence.candidate_domain_raw = stagingDomainRaw(staging.row)
    evidence.candidate_domain_normalized = canonicalNormalizedDomain(
      asString(staging.row.domain),
      asString(staging.row.website),
    )
  }

  const domain =
    evidence.candidate_domain_normalized ??
    canonicalNormalizedDomain(input.domain, null)

  const explicit = asString(input.explicit_canonical_company_id)
  if (explicit) {
    await ensureStagingCanonicalCompanyLinkage(admin, lookup_key, {
      explicit_canonical_company_id: explicit,
    }).catch(() => null)
    evidence.final_canonical_company_id = explicit
    evidence.staging_linkage_method = "explicit"
    evidence.staging_linkage_canonical_company_id = explicit
    return { canonical_company_id: explicit, resolution_blockers, evidence }
  }

  const linkage = await ensureStagingCanonicalCompanyLinkage(admin, lookup_key, {
    upsert_lineage: true,
  })
  evidence.staging_linkage_method = linkage.method
  evidence.staging_linkage_canonical_company_id = linkage.canonical_company_id
  if (linkage.source_table && !evidence.staging_table_detected) {
    evidence.staging_table_detected = linkage.source_table
  }
  if (linkage.canonical_company_id) {
    evidence.final_canonical_company_id = linkage.canonical_company_id
    return { canonical_company_id: linkage.canonical_company_id, resolution_blockers, evidence }
  }

  evidence.domain_lookup_attempted = Boolean(domain)
  if (domain) {
    const fromDomain = await resolveCanonicalCompanyIdFromDomain(admin, domain)
    evidence.domain_lookup_company_id = fromDomain
    if (fromDomain) {
      await ensureStagingCanonicalCompanyLinkage(admin, lookup_key, {
        explicit_canonical_company_id: fromDomain,
      }).catch(() => null)
      evidence.final_canonical_company_id = fromDomain
      return { canonical_company_id: fromDomain, resolution_blockers, evidence }
    }
  }

  evidence.name_lookup_attempted = Boolean(evidence.candidate_company_name)
  if (evidence.candidate_company_name) {
    const fromName = await resolveCanonicalCompanyIdFromCompanyName(admin, {
      company_name: evidence.candidate_company_name,
      city: asString(staging?.row.city) || null,
      state: asString(staging?.row.state) || null,
    })
    if (fromName) {
      evidence.name_lookup_company_id = fromName.company_id
      evidence.name_lookup_method = fromName.method
      await ensureStagingCanonicalCompanyLinkage(admin, lookup_key, {
        explicit_canonical_company_id: fromName.company_id,
      }).catch(() => null)
      evidence.final_canonical_company_id = fromName.company_id
      return { canonical_company_id: fromName.company_id, resolution_blockers, evidence }
    }
  }

  if (staging) {
    evidence.promote_backfill_ran = true
    const backfill = await promoteStagingRowViaBackfill(admin, staging)
    evidence.promote_backfill_ok = backfill.ok
    evidence.promote_backfill_company_ids = backfill.company_ids
    evidence.promote_backfill_errors = backfill.errors
    if (backfill.company_id) {
      await ensureStagingCanonicalCompanyLinkage(admin, lookup_key, {
        explicit_canonical_company_id: backfill.company_id,
      }).catch(() => null)
      evidence.final_canonical_company_id = backfill.company_id
      return { canonical_company_id: backfill.company_id, resolution_blockers, evidence }
    }
  }

  if (!evidence.staging_table_detected) {
    resolution_blockers.push("staging_company_candidate_not_found")
  }
  if (domain) {
    resolution_blockers.push(`no_active_canonical_company_for_domain:${domain}`)
  } else {
    resolution_blockers.push("company_domain_missing_for_canonical_fallback")
  }
  if (evidence.promote_backfill_ran && evidence.promote_backfill_ok === false) {
    resolution_blockers.push(
      `promote_canonical_company_candidates_failed:${evidence.promote_backfill_errors.join("|") || "unknown"}`,
    )
  } else if (evidence.promote_backfill_ran && evidence.promote_backfill_company_ids.length === 0) {
    resolution_blockers.push("promote_canonical_company_candidates_no_company_id")
  }
  resolution_blockers.push(
    "Canonical company id could not be resolved — company_contacts sync skipped to avoid ID fragmentation.",
  )

  evidence.blocker_reason = summarizeApolloEnrichmentCertCanonicalCompanyResolutionFailure(evidence)
  return { canonical_company_id: null, resolution_blockers, evidence }
}

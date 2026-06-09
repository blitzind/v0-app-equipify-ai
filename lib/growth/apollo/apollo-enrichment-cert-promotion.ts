/** Apollo EN-3 post-enrichment promotion — server-only, no outreach/enrollment. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listContactCandidatesForCompany,
  syncContactCandidatesToCompanyContactsWithResolution,
} from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"
import {
  buildApolloEnrichmentPromotionBlockers,
  countEnrichedCandidateChannels,
  isSequenceReadyCompanyContact,
  selectApolloCandidatesForPromotion,
} from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import { promoteCanonicalCompanyCandidates } from "@/lib/growth/canonical-companies/canonical-company-backfill"
import {
  mapDiscoveryCandidateRow,
  mapExternalCompanyCandidateRow,
  mapRealWorldCompanyCandidateRow,
} from "@/lib/growth/canonical-companies/canonical-company-candidate-mappers"
import {
  ensureStagingCanonicalCompanyLinkage,
  type GrowthStagingCompanyCandidateTable,
} from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

export {
  APOLLO_ENRICHMENT_CERT_PROMOTION_EVIDENCE_QA_MARKER as APOLLO_ENRICHMENT_CERT_PROMOTION_QA_MARKER,
  buildApolloEnrichmentPromotionBlockers,
  countEnrichedCandidateChannels,
  isSequenceReadyCompanyContact,
  selectApolloCandidatesForPromotion,
} from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ApolloEnrichmentPromotionInput = {
  company_candidate_id: string
  domain: string | null
  canonical_company_id?: string | null
  /** Candidate rows processed during enrichment (in-memory or reloaded). */
  enriched_candidates: GrowthContactCandidate[]
}

export type ApolloEnrichmentPromotionResult = {
  qa_marker: "apollo-enrichment-cert-promotion-evidence-en-3-v1"
  enriched_candidates_with_email: number
  enriched_candidates_with_linkedin: number
  promotion_attempted: boolean
  promotion_blockers: string[]
  company_contacts_created: number
  company_contacts_updated: number
  company_contacts_synced: number
  contactable_after_promotion: number
  sequence_ready_after_promotion: number
  canonical_company_id: string | null
  canonical_person_backfill: { rows_processed: number; persons_linked: number }
  rejection_reasons: Record<string, number>
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

function mapStagingRowToCanonicalInput(
  source_table: GrowthStagingCompanyCandidateTable,
  row: Record<string, unknown>,
) {
  if (source_table === "external_company_candidates") return mapExternalCompanyCandidateRow(row)
  if (source_table === "real_world_company_candidates") return mapRealWorldCompanyCandidateRow(row)
  return mapDiscoveryCandidateRow(row)
}

async function loadStagingRowForPromotion(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<{ source_table: GrowthStagingCompanyCandidateTable; row: Record<string, unknown> } | null> {
  const tables: GrowthStagingCompanyCandidateTable[] = [
    "real_world_company_candidates",
    "external_company_candidates",
    "discovery_candidates",
  ]
  for (const table of tables) {
    const select =
      table === "discovery_candidates"
        ? "id, run_id, company_id, source_type, discovery_source_type, company_name, website, domain, industry, location, city, state, source_confidence, dedupe_hash, discovered_at, created_at, metadata, canonical_company_id"
        : "id, run_id, provider_name, provider_type, company_name, website, domain, phone, address, city, state, country, industry, confidence, dedupe_hash, created_at, metadata, canonical_company_id, query"
    const { data } = await admin.schema("growth").from(table).select(select).eq("id", company_candidate_id).maybeSingle()
    if (data) return { source_table: table, row: data as Record<string, unknown> }
  }
  return null
}

async function ensureCanonicalCompanyViaBackfill(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<string | null> {
  const staging = await loadStagingRowForPromotion(admin, company_candidate_id)
  if (!staging) return null

  const mapped = mapStagingRowToCanonicalInput(staging.source_table, staging.row)
  const { outcomes } = await promoteCanonicalCompanyCandidates(admin, {
    mode: "apply",
    candidates: [mapped],
  })
  const outcome = outcomes[0]
  if (!outcome?.ok || !outcome.company_id) return null
  return outcome.company_id
}

export async function loadPersistedApolloCandidatesForPromotion(
  admin: SupabaseClient,
  company_candidate_id: string,
  limit = 200,
): Promise<GrowthContactCandidate[]> {
  const all = await listContactCandidatesForCompany(admin, company_candidate_id, limit)
  return all.filter(
    (candidate) =>
      candidate.provider_type === "future_apollo" && candidateHasObservedContactChannel(candidate),
  )
}

export async function resolveApolloEnrichmentCanonicalCompanyId(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    domain: string | null
    explicit_canonical_company_id?: string | null
  },
): Promise<{ canonical_company_id: string | null; resolution_blockers: string[] }> {
  const explicit = asString(input.explicit_canonical_company_id)
  if (explicit) {
    await ensureStagingCanonicalCompanyLinkage(admin, input.company_candidate_id, {
      explicit_canonical_company_id: explicit,
    }).catch(() => null)
    return { canonical_company_id: explicit, resolution_blockers: [] }
  }

  const linkage = await ensureStagingCanonicalCompanyLinkage(admin, input.company_candidate_id, {
    upsert_lineage: true,
  })
  if (linkage.canonical_company_id) {
    return { canonical_company_id: linkage.canonical_company_id, resolution_blockers: [] }
  }

  const fromDomain = await resolveCanonicalCompanyIdFromDomain(admin, input.domain)
  if (fromDomain) {
    await ensureStagingCanonicalCompanyLinkage(admin, input.company_candidate_id, {
      explicit_canonical_company_id: fromDomain,
    }).catch(() => null)
    return { canonical_company_id: fromDomain, resolution_blockers: [] }
  }

  const fromBackfill = await ensureCanonicalCompanyViaBackfill(admin, input.company_candidate_id)
  if (fromBackfill) {
    await ensureStagingCanonicalCompanyLinkage(admin, input.company_candidate_id, {
      explicit_canonical_company_id: fromBackfill,
    }).catch(() => null)
    return { canonical_company_id: fromBackfill, resolution_blockers: [] }
  }

  const blockers: string[] = []
  if (!linkage.source_table) {
    blockers.push("staging_company_candidate_not_found")
  }
  if (input.domain) {
    blockers.push(`no_active_canonical_company_for_domain:${input.domain}`)
  } else {
    blockers.push("company_domain_missing_for_canonical_fallback")
  }
  blockers.push(
    "Canonical company id could not be resolved — company_contacts sync skipped to avoid ID fragmentation.",
  )
  return { canonical_company_id: null, resolution_blockers: blockers }
}

export async function reloadEnrichedApolloCandidates(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    candidate_ids: string[]
  },
): Promise<GrowthContactCandidate[]> {
  const all = await listContactCandidatesForCompany(admin, input.company_candidate_id, 200)
  const channelReady = all.filter(
    (candidate) =>
      candidate.provider_type === "future_apollo" && candidateHasObservedContactChannel(candidate),
  )
  if (input.candidate_ids.length === 0) return channelReady

  const idSet = new Set(input.candidate_ids)
  return channelReady.filter((candidate) => idSet.has(candidate.id))
}

function isContactableCompanyContact(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

export async function countApolloEnrichmentReadinessAfterPromotion(
  admin: SupabaseClient,
  canonical_company_id: string | null,
): Promise<{ contactable: number; sequence_ready: number }> {
  if (!canonical_company_id) return { contactable: 0, sequence_ready: 0 }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "full_name, title, email, phone, email_status, phone_status, linkedin_url, canonical_person_id, metadata",
    )
    .eq("company_id", canonical_company_id)

  let contactable = 0
  let sequence_ready = 0
  for (const raw of contacts ?? []) {
    const row = raw as Record<string, unknown>
    if (isContactableCompanyContact(row)) contactable += 1
    if (isSequenceReadyCompanyContact(row)) sequence_ready += 1
  }
  return { contactable, sequence_ready }
}

export async function promoteEnrichedApolloCandidatesToCompanyContacts(
  admin: SupabaseClient,
  input: ApolloEnrichmentPromotionInput,
): Promise<ApolloEnrichmentPromotionResult> {
  const persisted = await loadPersistedApolloCandidatesForPromotion(admin, input.company_candidate_id)
  const seedCandidates =
    input.enriched_candidates.length > 0 ? input.enriched_candidates : persisted
  const channelCounts = countEnrichedCandidateChannels(
    seedCandidates.length > 0 ? seedCandidates : persisted,
  )
  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id: input.company_candidate_id,
    domain: input.domain,
    explicit_canonical_company_id: input.canonical_company_id,
  })

  const reloaded = await reloadEnrichedApolloCandidates(admin, {
    company_candidate_id: input.company_candidate_id,
    candidate_ids: seedCandidates.map((candidate) => candidate.id),
  })
  const promotionCandidates =
    reloaded.length > 0
      ? reloaded
      : selectApolloCandidatesForPromotion(seedCandidates.length > 0 ? seedCandidates : persisted)

  const promotion_attempted = promotionCandidates.length > 0
  let company_contacts_synced = 0
  let company_contacts_created = 0
  let company_contacts_updated = 0
  let rejection_reasons: Record<string, number> = {}
  let canonical_company_id = resolution.canonical_company_id

  if (promotion_attempted) {
    try {
      const sync = await syncContactCandidatesToCompanyContactsWithResolution(admin, {
        company_candidate_id: input.company_candidate_id,
        canonical_company_id,
        candidates: promotionCandidates,
        require_contact_channel: true,
      })
      company_contacts_synced = sync.synced
      company_contacts_created = sync.created
      company_contacts_updated = sync.updated
      rejection_reasons = sync.rejection_reasons
      if (sync.resolution?.canonical_company_id) {
        canonical_company_id = sync.resolution.canonical_company_id
      }
    } catch (error) {
      rejection_reasons = {
        sync_failed: promotionCandidates.length,
      }
      resolution.resolution_blockers.push(
        error instanceof Error ? error.message : "company_contacts_sync_failed",
      )
    }
  }

  const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
    company_candidate_id: input.company_candidate_id,
    canonical_company_id,
    mode: "apply",
  })

  const readiness = await countApolloEnrichmentReadinessAfterPromotion(admin, canonical_company_id)
  const promotion_blockers = buildApolloEnrichmentPromotionBlockers({
    canonical_company_id,
    candidates_with_channel: promotionCandidates.length,
    resolution_diagnostics: resolution.resolution_blockers,
    rejection_reasons,
  })

  return {
    qa_marker: "apollo-enrichment-cert-promotion-evidence-en-3-v1",
    enriched_candidates_with_email: channelCounts.with_email,
    enriched_candidates_with_linkedin: channelCounts.with_linkedin,
    promotion_attempted,
    promotion_blockers,
    company_contacts_created,
    company_contacts_updated,
    company_contacts_synced,
    contactable_after_promotion: readiness.contactable,
    sequence_ready_after_promotion: readiness.sequence_ready,
    canonical_company_id,
    canonical_person_backfill: {
      rows_processed: backfill.rows_processed,
      persons_linked: backfill.persons_linked,
    },
    rejection_reasons,
  }
}

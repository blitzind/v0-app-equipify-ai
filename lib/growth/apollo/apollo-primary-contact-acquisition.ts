/** Apollo-Primary-1 contact acquisition orchestration — server-only, no outreach/enrollment. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runApolloLivePilotContactDiscovery } from "@/lib/growth/apollo/apollo-live-pilot-contact-discovery"
import { enrichApolloCandidatesNeedingEmail } from "@/lib/growth/apollo/apollo-candidate-email-enrichment"
import { buildApolloAcquisitionSearchEvidence } from "@/lib/growth/apollo/apollo-acquisition-search-evidence"
import { apolloCandidateNeedsEmailEnrichment } from "@/lib/growth/apollo/apollo-email-channel-evidence"
import {
  loadPersistedApolloCandidatesForPromotion,
  promoteEnrichedApolloCandidatesToCompanyContacts,
} from "@/lib/growth/apollo/apollo-enrichment-cert-promotion"
import {
  emptyApolloPrimaryContactAcquisitionEvidence,
  type ApolloPrimaryContactAcquisitionCompanyEvidence,
  type ApolloPrimaryContactAcquisitionEvidence,
  type ApolloPrimaryContactEmailEnrichmentEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { emptyApolloTieredPeopleSearchEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import type { ApolloTieredPeopleSearchEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import { isApolloPrimaryContactAcquisitionEnabled } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { loadStagingCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { isSequenceReadyCompanyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"

export {
  APOLLO_PRIMARY_CONTACT_ACQUISITION_EVIDENCE_QA_MARKER,
  type ApolloPrimaryContactAcquisitionEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
export { isApolloPrimaryContactAcquisitionEnabled } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyEmailEnrichmentEvidence(
  skipped_reason: string | null = null,
  overrides?: Partial<ApolloPrimaryContactEmailEnrichmentEvidence>,
) {
  return {
    candidates_selected: 0,
    candidates_updated: 0,
    verified_status_without_email_selected: 0,
    channel_less_selected: 0,
    skipped_reason,
    error: null,
    error_stage: null,
    ...overrides,
  }
}

function isContactableCompanyContact(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

async function loadCompanyAcquisitionContext(
  admin: SupabaseClient,
  lookupKey: string,
): Promise<{
  company_candidate_id: string
  company_name: string
  domain: string | null
  website_url: string | null
  city: string | null
  state: string | null
} | null> {
  const staging = await loadStagingCompanyCandidateRow(admin, lookupKey)
  if (!staging) return null

  const row = staging.row
  const company_candidate_id = asString(row.company_id) || staging.lookup_key
  const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
  const website_url = asString(row.website) || (domain ? `https://${domain}` : null)

  return {
    company_candidate_id,
    company_name: asString(row.company_name) || company_candidate_id,
    domain,
    website_url,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
  }
}

async function countExistingContactReuse(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    canonical_company_id: string | null
  },
): Promise<{
  existing_contacts_reused: number
  existing_contactable_before: number
  existing_apollo_candidates: number
  existing_apollo_with_channel: number
}> {
  let existing_contacts_reused = 0
  let existing_contactable_before = 0

  if (input.canonical_company_id) {
    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("email, phone, email_status, phone_status, canonical_person_id")
      .eq("company_id", input.canonical_company_id)

    for (const raw of contacts ?? []) {
      const row = raw as Record<string, unknown>
      existing_contacts_reused += 1
      if (isContactableCompanyContact(row)) existing_contactable_before += 1
    }
  }

  const { data: apolloRows } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id")
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(500)

  const existing_apollo_candidates = (apolloRows ?? []).length

  const persisted = await loadPersistedApolloCandidatesForPromotion(
    admin,
    input.company_candidate_id,
  )
  const existing_apollo_with_channel = persisted.length

  return {
    existing_contacts_reused,
    existing_contactable_before,
    existing_apollo_candidates,
    existing_apollo_with_channel,
  }
}

async function countReadinessAfterPromotion(
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

function readSearchStrategyFromDiscovery(
  discovery: Awaited<ReturnType<typeof runApolloLivePilotContactDiscovery>>,
): ApolloTieredPeopleSearchEvidence {
  const metadata = discovery.apollo_provider_result?.metadata
  if (
    metadata &&
    typeof metadata === "object" &&
    (metadata as Record<string, unknown>).apollo_search_strategy &&
    typeof (metadata as Record<string, unknown>).apollo_search_strategy === "object"
  ) {
    return (metadata as Record<string, unknown>).apollo_search_strategy as ApolloTieredPeopleSearchEvidence
  }
  return emptyApolloTieredPeopleSearchEvidence()
}

export async function runApolloPrimaryContactAcquisitionForCompany(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    skip_apollo_search_if_existing_contactable?: boolean
  },
): Promise<ApolloPrimaryContactAcquisitionCompanyEvidence> {
  const env = input.env ?? process.env
  const contact_limit = input.contact_limit ?? 10
  const lookupKey = input.company_candidate_id.trim()
  const blockers: string[] = []

  const context = await loadCompanyAcquisitionContext(admin, lookupKey)
  if (!context) {
    return {
      company_candidate_id: lookupKey,
      company_name: lookupKey,
      domain: null,
      canonical_company_id: null,
      apollo_search_attempted: false,
      apollo_search_skipped_reason: "staging_company_candidate_not_found",
      apollo_people_found: 0,
      existing_contacts_reused: 0,
      existing_contactable_before: 0,
      enrichment_attempted: false,
      enrichment_skipped_reason: "company_context_missing",
      enrichment_candidates_updated: 0,
      email_enrichment: emptyEmailEnrichmentEvidence("company_context_missing"),
      credits_consumed: 0,
      promoted_contacts: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: ["staging_company_candidate_not_found"],
      search_strategy: null,
      apollo_search_evidence: null,
      verified_email_promotion: null,
    }
  }

  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id: context.company_candidate_id,
    domain: context.domain,
  })
  const canonical_company_id = resolution.canonical_company_id
  if (!canonical_company_id) {
    blockers.push("canonical_company_id_unresolved")
    for (const diagnostic of resolution.resolution_blockers) {
      if (!blockers.includes(diagnostic)) blockers.push(diagnostic)
    }
  }

  const existing = await countExistingContactReuse(admin, {
    company_candidate_id: context.company_candidate_id,
    canonical_company_id,
  })

  const skipSearch =
    input.skip_apollo_search_if_existing_contactable !== false &&
    ((existing.existing_contactable_before > 0 && existing.existing_apollo_with_channel > 0) ||
      existing.existing_apollo_with_channel >= contact_limit)

  let apollo_search_attempted = false
  let apollo_search_skipped_reason: string | null = null
  let apollo_people_found = 0
  let apollo_persisted_this_run = 0
  let search_strategy: ApolloTieredPeopleSearchEvidence | null = null

  if (skipSearch) {
    apollo_search_skipped_reason =
      existing.existing_contactable_before > 0
        ? "existing_contactable_company_contacts"
        : "existing_apollo_candidates_with_channels"
  } else {
    apollo_search_attempted = true
    const discovery = await runApolloLivePilotContactDiscovery(admin, {
      company_candidate_id: context.company_candidate_id,
      company_name: context.company_name,
      domain: context.domain,
      website_url: context.website_url,
      city: context.city,
      state: context.state,
      created_by: input.created_by ?? null,
      limit: contact_limit,
    })

    if (discovery.apollo_outcome?.status === "failed") {
      blockers.push(
        discovery.apollo_outcome.provider_error ??
          discovery.apollo_outcome.message ??
          "apollo_search_failed",
      )
    } else if (discovery.apollo_outcome?.status === "skipped") {
      apollo_search_skipped_reason = discovery.apollo_outcome.message ?? "apollo_search_skipped"
      apollo_search_attempted = false
    }

    search_strategy = readSearchStrategyFromDiscovery(discovery)
    apollo_persisted_this_run =
      typeof discovery.apollo_outcome?.contacts_persisted === "number"
        ? discovery.apollo_outcome.contacts_persisted
        : discovery.apollo_provider_result?.status === "success"
          ? discovery.apollo_provider_result.contacts.length
          : 0
    apollo_people_found = search_strategy?.mapped_contacts ?? apollo_persisted_this_run

    if (apollo_people_found === 0 && apollo_search_attempted) {
      if (
        existing.existing_contactable_before > 0 &&
        existing.existing_apollo_candidates === 0
      ) {
        search_strategy = {
          ...(search_strategy ?? emptyApolloTieredPeopleSearchEvidence()),
          legacy_fallback_used: true,
          legacy_contactable_count: existing.existing_contactable_before,
        }
      }
    }
  }

  let enrichment_attempted = false
  let enrichment_skipped_reason: string | null = null
  let enrichment_candidates_updated = 0
  let credits_consumed = 0

  const channelLessBefore = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, email, phone, linkedin_url, metadata, provider_type")
    .eq("company_candidate_id", context.company_candidate_id)
    .eq("provider_type", "future_apollo")

  const needsEnrichment = ((channelLessBefore.data ?? []) as GrowthContactCandidate[]).some((candidate) =>
    apolloCandidateNeedsEmailEnrichment(candidate),
  )

  let email_enrichment = emptyEmailEnrichmentEvidence()

  if (!needsEnrichment) {
    enrichment_skipped_reason = "no_candidates_need_email_enrichment"
    email_enrichment = emptyEmailEnrichmentEvidence(enrichment_skipped_reason)
  } else {
    enrichment_attempted = true
    const enrichment = await enrichApolloCandidatesNeedingEmail(admin, {
      company_candidate_id: context.company_candidate_id,
      domain: context.domain,
      max_people: contact_limit,
      env,
    })
    enrichment_candidates_updated = enrichment.candidates_updated
    credits_consumed += enrichment.credits_consumed
    enrichment_skipped_reason = enrichment.skipped_reason
    if (enrichment.skipped_reason) enrichment_attempted = false
    email_enrichment = {
      candidates_selected: enrichment.candidates_selected,
      candidates_updated: enrichment.candidates_updated,
      verified_status_without_email_selected: enrichment.verified_status_without_email_selected,
      channel_less_selected: enrichment.channel_less_selected,
      skipped_reason: enrichment.skipped_reason,
      error: enrichment.error,
      error_stage: enrichment.error_stage,
    }
    if (enrichment.error) {
      blockers.push(`apollo_email_enrichment:${enrichment.error_stage ?? "unknown"}:${enrichment.error}`)
    }
  }

  const enrichedCandidates = await loadPersistedApolloCandidatesForPromotion(
    admin,
    context.company_candidate_id,
  )

  const promotion = await promoteEnrichedApolloCandidatesToCompanyContacts(admin, {
    company_candidate_id: context.company_candidate_id,
    domain: context.domain,
    canonical_company_id,
    enriched_candidates: enrichedCandidates,
  })

  if (promotion.promotion_blockers.length > 0) {
    for (const blocker of promotion.promotion_blockers) {
      if (!blockers.includes(blocker)) blockers.push(blocker)
    }
  }

  const readiness = await countReadinessAfterPromotion(
    admin,
    promotion.canonical_company_id ?? canonical_company_id,
  )

  const searchEvidence = buildApolloAcquisitionSearchEvidence({
    company_name: context.company_name,
    company_domain: context.domain,
    apollo_search_attempted,
    apollo_search_skipped_reason,
    apollo_persisted_this_run,
    existing_contactable_before: existing.existing_contactable_before,
    blockers,
    search_strategy,
    env,
  })

  return {
    company_candidate_id: context.company_candidate_id,
    company_name: context.company_name,
    domain: context.domain,
    canonical_company_id: promotion.canonical_company_id ?? canonical_company_id,
    apollo_search_attempted,
    apollo_search_skipped_reason,
    apollo_people_found: searchEvidence.apollo_mapped_people_count,
    existing_contacts_reused: existing.existing_contacts_reused,
    existing_contactable_before: existing.existing_contactable_before,
    enrichment_attempted,
    enrichment_skipped_reason,
    enrichment_candidates_updated,
    email_enrichment,
    credits_consumed,
    promoted_contacts: promotion.company_contacts_synced,
    contactable_contacts: readiness.contactable,
    sequence_ready_contacts: readiness.sequence_ready,
    blockers: searchEvidence.apollo_search_blockers,
    search_strategy,
    apollo_search_evidence: searchEvidence.apollo_search_evidence,
    verified_email_promotion: promotion.verified_email_promotion,
  }
}

export async function runApolloPrimaryContactAcquisition(
  admin: SupabaseClient,
  input: {
    company_candidate_ids: string[]
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    skip_apollo_search_if_existing_contactable?: boolean
  },
): Promise<ApolloPrimaryContactAcquisitionEvidence> {
  const env = input.env ?? process.env
  const started = Date.now()
  const mock = isApolloMockEnabled(env)
  const evidence = emptyApolloPrimaryContactAcquisitionEvidence(mock)
  const errors: string[] = []

  beginApolloRunGuardrails()

  try {
    const uniqueIds = [...new Set(input.company_candidate_ids.map((id) => id.trim()).filter(Boolean))]
    evidence.companies_searched = uniqueIds.length

    for (const company_candidate_id of uniqueIds) {
      try {
        const company = await runApolloPrimaryContactAcquisitionForCompany(admin, {
          company_candidate_id,
          contact_limit: input.contact_limit,
          created_by: input.created_by,
          env,
          skip_apollo_search_if_existing_contactable:
            input.skip_apollo_search_if_existing_contactable,
        })
        evidence.companies.push(company)

        evidence.apollo_people_found += company.apollo_people_found
        evidence.existing_contacts_reused += company.existing_contacts_reused
        if (company.enrichment_attempted) evidence.enrichment_attempted += 1
        else evidence.enrichment_skipped += 1
        evidence.credits_consumed += company.credits_consumed
        evidence.promoted_contacts += company.promoted_contacts
        evidence.contactable_contacts += company.contactable_contacts
        evidence.sequence_ready_contacts += company.sequence_ready_contacts
        for (const blocker of company.blockers) {
          if (!evidence.blockers.includes(blocker)) evidence.blockers.push(blocker)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "company_acquisition_failed"
        errors.push(`${company_candidate_id}: ${message}`)
      }
    }
  } finally {
    const guardrails = getApolloRunGuardrailSnapshot()
    evidence.runtime.api_calls = guardrails?.api_calls ?? guardrails?.search_api_calls ?? 0
    evidence.runtime.duration_ms = Date.now() - started
    evidence.runtime.errors = errors
    evidence.acquired_at = new Date().toISOString()
    resetApolloRunGuardrails()
  }

  return evidence
}

export function isApolloPrimaryContactAcquisitionActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return isApolloPrimaryContactAcquisitionEnabled(env)
}

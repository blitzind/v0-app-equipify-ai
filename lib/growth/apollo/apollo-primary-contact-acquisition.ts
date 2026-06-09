/** Apollo-Primary-1 contact acquisition orchestration — server-only, no outreach/enrollment. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runApolloLivePilotContactDiscovery } from "@/lib/growth/apollo/apollo-live-pilot-contact-discovery"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import {
  loadPersistedApolloCandidatesForPromotion,
  promoteEnrichedApolloCandidatesToCompanyContacts,
} from "@/lib/growth/apollo/apollo-enrichment-cert-promotion"
import {
  emptyApolloPrimaryContactAcquisitionEvidence,
  type ApolloPrimaryContactAcquisitionCompanyEvidence,
  type ApolloPrimaryContactAcquisitionEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { isApolloPrimaryContactAcquisitionEnabled } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { loadStagingCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isApolloEmailEnrichmentEnabled, isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { enrichApolloPeopleWithBulkMatch } from "@/lib/growth/providers/apollo/apollo-enrich-people"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
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

function readApolloPersonId(candidate: GrowthContactCandidate): string | null {
  const metadata =
    candidate.metadata && typeof candidate.metadata === "object"
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  return asString(metadata.apollo_person_id) || null
}

function candidateToApolloPersonRecord(candidate: GrowthContactCandidate): ApolloPersonRecord {
  const metadata =
    candidate.metadata && typeof candidate.metadata === "object"
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  return {
    id: readApolloPersonId(candidate),
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    title: candidate.job_title,
    linkedin_url: candidate.linkedin_url,
    email: candidate.email,
    email_status: asString(metadata.apollo_email_status) || null,
    organization: {
      name: asString(metadata.company_name) || null,
    },
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

  const persisted = await loadPersistedApolloCandidatesForPromotion(
    admin,
    input.company_candidate_id,
  )
  const existing_apollo_with_channel = persisted.length

  return {
    existing_contacts_reused,
    existing_contactable_before,
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

async function enrichChannelLessApolloCandidates(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    domain: string | null
    max_people: number
    env: NodeJS.ProcessEnv
  },
): Promise<{ candidates_updated: number; credits_consumed: number; skipped_reason: string | null }> {
  if (!isApolloEmailEnrichmentEnabled(input.env)) {
    return {
      candidates_updated: 0,
      credits_consumed: 0,
      skipped_reason: "enrichment_gates_blocked",
    }
  }

  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, email, phone, linkedin_url, first_name, last_name, job_title, metadata, provider_type",
    )
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(Math.max(input.max_people * 3, input.max_people))

  const channelLess = ((data ?? []) as GrowthContactCandidate[]).filter(
    (candidate) =>
      !candidateHasObservedContactChannel(candidate) && Boolean(readApolloPersonId(candidate)),
  )
  if (channelLess.length === 0) {
    return {
      candidates_updated: 0,
      credits_consumed: 0,
      skipped_reason: "no_channel_less_apollo_candidates",
    }
  }

  const mock = isApolloMockEnabled(input.env)
  const people = channelLess.slice(0, input.max_people).map(candidateToApolloPersonRecord)
  const enriched = await enrichApolloPeopleWithBulkMatch({
    people,
    mock,
    domain: input.domain,
    env: input.env,
    record_guardrails: true,
  })

  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: enriched.people,
    company_name: input.company_candidate_id,
    domain: input.domain,
    mock,
  })

  const enrichedByPersonId = new Map<string, (typeof mapped.contacts)[number]>()
  for (const contact of mapped.contacts) {
    const personId =
      contact.metadata && typeof contact.metadata === "object"
        ? asString((contact.metadata as Record<string, unknown>).apollo_person_id)
        : asString(contact.external_provider_contact_id)
    if (personId) enrichedByPersonId.set(personId, contact)
  }

  let candidates_updated = 0
  for (const candidate of channelLess.slice(0, input.max_people)) {
    const personId = readApolloPersonId(candidate)
    if (!personId) continue
    const enrichedContact = enrichedByPersonId.get(personId)
    if (!enrichedContact) continue

    const nextEmail = asString(enrichedContact.email) || candidate.email
    const nextPhone = asString(enrichedContact.phone) || candidate.phone
    const nextLinkedin = asString(enrichedContact.linkedin_url) || candidate.linkedin_url
    if (
      nextEmail === candidate.email &&
      nextPhone === candidate.phone &&
      nextLinkedin === candidate.linkedin_url
    ) {
      continue
    }

    const metadata = {
      ...(candidate.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>)
        : {}),
      apollo_enriched_at: new Date().toISOString(),
      apollo_email_status:
        enrichedContact.metadata && typeof enrichedContact.metadata === "object"
          ? asString((enrichedContact.metadata as Record<string, unknown>).apollo_email_status)
          : null,
    }

    const { error } = await admin
      .schema("growth")
      .from("contact_candidates")
      .update({
        email: nextEmail || null,
        phone: nextPhone || null,
        linkedin_url: nextLinkedin || null,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id)

    if (!error) candidates_updated += 1
  }

  const guardrails = getApolloRunGuardrailSnapshot()
  return {
    candidates_updated,
    credits_consumed: guardrails?.credits_estimate ?? enriched.credits_estimate,
    skipped_reason: null,
  }
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
      credits_consumed: 0,
      promoted_contacts: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: ["staging_company_candidate_not_found"],
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
    (existing.existing_contactable_before > 0 || existing.existing_apollo_with_channel >= contact_limit)

  let apollo_search_attempted = false
  let apollo_search_skipped_reason: string | null = null
  let apollo_people_found = existing.existing_apollo_with_channel

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

    apollo_people_found = discovery.apollo_contacts.length
    if (apollo_people_found === 0 && apollo_search_attempted) {
      blockers.push("apollo_zero_contacts_mapped")
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

  const needsEnrichment = ((channelLessBefore.data ?? []) as GrowthContactCandidate[]).some(
    (candidate) =>
      !candidateHasObservedContactChannel(candidate) && Boolean(readApolloPersonId(candidate)),
  )

  if (!needsEnrichment) {
    enrichment_skipped_reason = "all_candidates_have_contact_channels_or_no_apollo_rows"
  } else {
    enrichment_attempted = true
    const enrichment = await enrichChannelLessApolloCandidates(admin, {
      company_candidate_id: context.company_candidate_id,
      domain: context.domain,
      max_people: contact_limit,
      env,
    })
    enrichment_candidates_updated = enrichment.candidates_updated
    credits_consumed += enrichment.credits_consumed
    enrichment_skipped_reason = enrichment.skipped_reason
    if (enrichment.skipped_reason) enrichment_attempted = false
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

  return {
    company_candidate_id: context.company_candidate_id,
    company_name: context.company_name,
    domain: context.domain,
    canonical_company_id: promotion.canonical_company_id ?? canonical_company_id,
    apollo_search_attempted,
    apollo_search_skipped_reason,
    apollo_people_found,
    existing_contacts_reused: existing.existing_contacts_reused,
    existing_contactable_before: existing.existing_contactable_before,
    enrichment_attempted,
    enrichment_skipped_reason,
    enrichment_candidates_updated,
    credits_consumed,
    promoted_contacts: promotion.company_contacts_synced,
    contactable_contacts: readiness.contactable,
    sequence_ready_contacts: readiness.sequence_ready,
    blockers,
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

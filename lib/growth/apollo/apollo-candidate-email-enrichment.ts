/** Apollo candidate email enrichment — bulk_match for verified-status-without-email. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  apolloCandidateNeedsEmailEnrichment,
  readApolloPersonIdFromCandidate,
} from "@/lib/growth/apollo/apollo-email-channel-evidence"
import { isApolloVerifiedEmailStatus, readApolloEmailStatusFromCandidate } from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isApolloEmailEnrichmentEnabled, isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { enrichApolloPeopleWithBulkMatch } from "@/lib/growth/providers/apollo/apollo-enrich-people"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import { getApolloRunGuardrailSnapshot } from "@/lib/growth/providers/apollo/apollo-run-guardrails"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function candidateToApolloPersonRecord(candidate: GrowthContactCandidate): ApolloPersonRecord {
  const metadata =
    candidate.metadata && typeof candidate.metadata === "object"
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  return {
    id: readApolloPersonIdFromCandidate(candidate),
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

export type ApolloCandidateEmailEnrichmentResult = {
  candidates_selected: number
  candidates_updated: number
  verified_status_without_email_selected: number
  channel_less_selected: number
  credits_consumed: number
  skipped_reason: string | null
  error: string | null
  error_stage:
    | "email_enrichment_selection"
    | "apollo_bulk_match_enrichment"
    | "candidate_persistence"
    | null
}

function emptyEnrichmentResult(
  skipped_reason: string | null,
  overrides?: Partial<ApolloCandidateEmailEnrichmentResult>,
): ApolloCandidateEmailEnrichmentResult {
  return {
    candidates_selected: 0,
    candidates_updated: 0,
    verified_status_without_email_selected: 0,
    channel_less_selected: 0,
    credits_consumed: 0,
    skipped_reason,
    error: null,
    error_stage: null,
    ...overrides,
  }
}

export async function enrichApolloCandidatesNeedingEmail(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    domain: string | null
    max_people: number
    env: NodeJS.ProcessEnv
  },
): Promise<ApolloCandidateEmailEnrichmentResult> {
  if (!isApolloEmailEnrichmentEnabled(input.env)) {
    return emptyEnrichmentResult("enrichment_gates_blocked")
  }

  const { data, error: loadError } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, email, phone, linkedin_url, first_name, last_name, job_title, metadata, provider_type, full_name",
    )
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(Math.max(input.max_people * 3, input.max_people))

  if (loadError) {
    return emptyEnrichmentResult("candidate_load_failed", {
      error: loadError.message,
      error_stage: "email_enrichment_selection" as ApolloCandidateEmailEnrichmentResult["error_stage"],
    })
  }

  const candidates = (data ?? []) as GrowthContactCandidate[]
  const selected = candidates.filter((candidate) => apolloCandidateNeedsEmailEnrichment(candidate))

  if (selected.length === 0) {
    return emptyEnrichmentResult("no_candidates_need_email_enrichment")
  }

  let verified_status_without_email_selected = 0
  let channel_less_selected = 0
  for (const candidate of selected) {
    const status = readApolloEmailStatusFromCandidate(candidate)
    if (isApolloVerifiedEmailStatus(status) && !asString(candidate.email)) {
      verified_status_without_email_selected += 1
    } else {
      channel_less_selected += 1
    }
  }

  let enriched: Awaited<ReturnType<typeof enrichApolloPeopleWithBulkMatch>>
  try {
    const mock = isApolloMockEnabled(input.env)
    const people = selected
      .slice(0, input.max_people)
      .map(candidateToApolloPersonRecord)
      .filter((person) => asString(person.id))

    if (people.length === 0) {
      return emptyEnrichmentResult("no_apollo_person_ids_for_enrichment", {
        candidates_selected: selected.length,
        verified_status_without_email_selected,
        channel_less_selected,
        error: "missing_apollo_person_id",
        error_stage: "apollo_bulk_match_enrichment",
      })
    }

    enriched = await enrichApolloPeopleWithBulkMatch({
      people,
      mock,
      domain: input.domain,
      env: input.env,
      record_guardrails: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return emptyEnrichmentResult("apollo_bulk_match_failed", {
      candidates_selected: selected.length,
      verified_status_without_email_selected,
      channel_less_selected,
      error: message,
      error_stage: "apollo_bulk_match_enrichment",
    })
  }

  let mapped: ReturnType<typeof mapApolloPeopleToContactDiscoveryRaw>
  try {
    const mock = isApolloMockEnabled(input.env)
    mapped = mapApolloPeopleToContactDiscoveryRaw({
      people: enriched.people ?? [],
      company_name: input.company_candidate_id,
      domain: input.domain,
      mock,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return emptyEnrichmentResult("candidate_mapping_failed", {
      candidates_selected: selected.length,
      verified_status_without_email_selected,
      channel_less_selected,
      credits_consumed: enriched.credits_estimate ?? 0,
      error: message,
      error_stage: "apollo_bulk_match_enrichment",
    })
  }

  const enrichedByPersonId = new Map<string, (typeof mapped.contacts)[number]>()
  for (const contact of mapped.contacts ?? []) {
    const personId =
      contact.metadata && typeof contact.metadata === "object"
        ? asString((contact.metadata as Record<string, unknown>).apollo_person_id)
        : asString(contact.external_provider_contact_id)
    if (personId) enrichedByPersonId.set(personId, contact)
  }

  let candidates_updated = 0
  let persistence_error: string | null = null
  for (const candidate of selected.slice(0, input.max_people)) {
    const candidateId = asString(candidate.id)
    const personId = readApolloPersonIdFromCandidate(candidate)
    if (!candidateId || !personId) continue
    const enrichedContact = enrichedByPersonId.get(personId)
    if (!enrichedContact) continue

    const nextEmail = asString(enrichedContact.email) || asString(candidate.email) || null
    const nextPhone = asString(enrichedContact.phone) || asString(candidate.phone) || null
    const nextLinkedin = asString(enrichedContact.linkedin_url) || asString(candidate.linkedin_url) || null
    const enrichedEmailStatus =
      enrichedContact.metadata && typeof enrichedContact.metadata === "object"
        ? asString((enrichedContact.metadata as Record<string, unknown>).apollo_email_status)
        : null

    const metadata = {
      ...(candidate.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>)
        : {}),
      apollo_enriched_at: new Date().toISOString(),
      apollo_email_status: enrichedEmailStatus || readApolloEmailStatusFromCandidate(candidate),
      ...(nextEmail ? { apollo_enriched_email: nextEmail, apollo_email_enrichment_source: "bulk_match" } : {}),
    }

    if (
      nextEmail === asString(candidate.email) &&
      nextPhone === asString(candidate.phone) &&
      nextLinkedin === asString(candidate.linkedin_url)
    ) {
      continue
    }

    const { error: updateError } = await admin
      .schema("growth")
      .from("contact_candidates")
      .update({
        email: nextEmail,
        phone: nextPhone,
        linkedin_url: nextLinkedin,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId)

    if (updateError) {
      persistence_error = updateError.message
      continue
    }
    candidates_updated += 1
  }

  const guardrails = getApolloRunGuardrailSnapshot()
  return {
    candidates_selected: selected.length,
    candidates_updated,
    verified_status_without_email_selected,
    channel_less_selected,
    credits_consumed: guardrails?.credits_estimate ?? enriched.credits_estimate ?? 0,
    skipped_reason: persistence_error ? "candidate_persistence_partial_failure" : null,
    error: persistence_error,
    error_stage: persistence_error ? "candidate_persistence" : null,
  }
}

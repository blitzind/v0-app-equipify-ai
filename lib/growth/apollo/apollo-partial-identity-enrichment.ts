/** Apollo partial-identity enrichment — LinkedIn slug + bulk_match name resolution. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_IDENTITY_STATUS_ENRICHED,
  APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT,
  APOLLO_IDENTITY_STATUS_UNRESOLVED,
  isApolloPartialIdentityMappedContact,
  isApolloPartialIdentityNameResolved,
  readApolloPartialIdentityStatus,
  resolveIdentityFromLinkedInSlug,
} from "@/lib/growth/apollo/apollo-partial-identity"
import { readApolloPersonIdFromCandidate } from "@/lib/growth/apollo/apollo-email-channel-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { enrichApolloPeopleWithBulkMatch } from "@/lib/growth/providers/apollo/apollo-enrich-people"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ApolloPartialIdentityEnrichmentResult = {
  candidates_selected: number
  candidates_updated: number
  enrichment_resolved: number
  skipped_reason: string | null
  error: string | null
}

function emptyResult(
  skipped_reason: string | null,
  overrides?: Partial<ApolloPartialIdentityEnrichmentResult>,
): ApolloPartialIdentityEnrichmentResult {
  return {
    candidates_selected: 0,
    candidates_updated: 0,
    enrichment_resolved: 0,
    skipped_reason,
    error: null,
    ...overrides,
  }
}

function candidateNeedsPartialIdentityEnrichment(candidate: GrowthContactCandidate): boolean {
  if (!isApolloPartialIdentityMappedContact(candidate)) return false
  const status = readApolloPartialIdentityStatus(candidate)
  if (status && status !== APOLLO_IDENTITY_STATUS_NEEDS_ENRICHMENT) return false
  return !isApolloPartialIdentityNameResolved(candidate.full_name)
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
    name: candidate.full_name,
    title: candidate.job_title,
    linkedin_url: candidate.linkedin_url,
    email: candidate.email,
    email_status: asString(metadata.apollo_email_status) || null,
  }
}

function resolveNameFromEnrichedContact(
  enrichedContact: ReturnType<typeof mapApolloPeopleToContactDiscoveryRaw>["contacts"][number],
): string | null {
  const full_name = asString(enrichedContact.full_name)
  if (full_name && isPlausiblePersonName(full_name)) return full_name
  return null
}

export async function enrichApolloPartialIdentityCandidates(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_name: string
    domain: string | null
    env: NodeJS.ProcessEnv
    max_people?: number
  },
): Promise<ApolloPartialIdentityEnrichmentResult> {
  const { data, error: loadError } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, full_name, first_name, last_name, job_title, email, phone, linkedin_url, metadata, provider_type",
    )
    .eq("company_candidate_id", input.company_candidate_id)
    .eq("provider_type", "future_apollo")

  if (loadError) {
    return emptyResult("candidate_load_failed", { error: loadError.message })
  }

  const candidates = (data ?? []) as GrowthContactCandidate[]
  const selected = candidates.filter((candidate) => candidateNeedsPartialIdentityEnrichment(candidate))
  if (selected.length === 0) {
    return emptyResult("no_partial_identity_candidates")
  }

  let candidates_updated = 0
  let enrichment_resolved = 0
  const needsBulkMatch: GrowthContactCandidate[] = []

  for (const candidate of selected) {
    const candidateId = asString(candidate.id)
    if (!candidateId) continue

    const linkedinName = candidate.linkedin_url
      ? resolveIdentityFromLinkedInSlug(candidate.linkedin_url)
      : null

    if (linkedinName) {
      const metadata = {
        ...(candidate.metadata && typeof candidate.metadata === "object"
          ? (candidate.metadata as Record<string, unknown>)
          : {}),
        identity_status: APOLLO_IDENTITY_STATUS_ENRICHED,
        apollo_partial_identity_resolution_source: "linkedin_slug",
        contactable: false,
        sequence_ready: false,
      }
      const { error: updateError } = await admin
        .schema("growth")
        .from("contact_candidates")
        .update({
          full_name: linkedinName,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)

      if (!updateError) {
        candidates_updated += 1
        enrichment_resolved += 1
      }
      continue
    }

    needsBulkMatch.push(candidate)
  }

  const bulkSlice = needsBulkMatch.slice(0, input.max_people ?? 10)
  if (bulkSlice.length > 0 && readApolloPersonIdFromCandidate(bulkSlice[0]!)) {
    try {
      const mock = isApolloMockEnabled(input.env)
      const people = bulkSlice
        .map(candidateToApolloPersonRecord)
        .filter((person) => asString(person.id))

      if (people.length > 0) {
        const enriched = await enrichApolloPeopleWithBulkMatch({
          people,
          mock,
          domain: input.domain,
          env: input.env,
          record_guardrails: true,
        })

        const mapped = mapApolloPeopleToContactDiscoveryRaw({
          people: enriched.people ?? [],
          company_name: input.company_name,
          domain: input.domain,
          mock,
        })

        const enrichedByPersonId = new Map<string, (typeof mapped.contacts)[number]>()
        for (const contact of mapped.contacts ?? []) {
          const personId =
            contact.metadata && typeof contact.metadata === "object"
              ? asString((contact.metadata as Record<string, unknown>).apollo_person_id)
              : asString(contact.external_provider_contact_id)
          if (personId) enrichedByPersonId.set(personId, contact)
        }

        for (const candidate of bulkSlice) {
          const candidateId = asString(candidate.id)
          const personId = readApolloPersonIdFromCandidate(candidate)
          if (!candidateId || !personId) continue

          const enrichedContact = enrichedByPersonId.get(personId)
          const resolvedName = enrichedContact
            ? resolveNameFromEnrichedContact(enrichedContact)
            : null

          const metadata = {
            ...(candidate.metadata && typeof candidate.metadata === "object"
              ? (candidate.metadata as Record<string, unknown>)
              : {}),
            identity_status: resolvedName
              ? APOLLO_IDENTITY_STATUS_ENRICHED
              : APOLLO_IDENTITY_STATUS_UNRESOLVED,
            apollo_partial_identity_resolution_source: resolvedName ? "apollo_bulk_match" : null,
            contactable: false,
            sequence_ready: false,
          }

          const { error: updateError } = await admin
            .schema("growth")
            .from("contact_candidates")
            .update({
              ...(resolvedName ? { full_name: resolvedName } : {}),
              metadata,
              updated_at: new Date().toISOString(),
            })
            .eq("id", candidateId)

          if (updateError) continue
          candidates_updated += 1
          if (resolvedName) enrichment_resolved += 1
        }
      }
    } catch (error) {
      return emptyResult("apollo_bulk_match_failed", {
        candidates_selected: selected.length,
        candidates_updated,
        enrichment_resolved,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    candidates_selected: selected.length,
    candidates_updated,
    enrichment_resolved,
    skipped_reason: null,
    error: null,
  }
}

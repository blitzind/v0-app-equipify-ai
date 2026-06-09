/** Apollo EN-1 enrichment certification runner — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getRecommendedApolloEnrichmentPath } from "@/lib/growth/apollo/apollo-enrichment-cert-audit"
import {
  assertApolloEnrichmentCertAllowed,
  resolveApolloEnrichmentCertMaxPeople,
} from "@/lib/growth/apollo/apollo-enrichment-cert-gates"
import {
  certifyApolloEnrichmentGoNoGo,
  APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER,
  type ApolloEnrichmentCertEvidence,
} from "@/lib/growth/apollo/apollo-enrichment-cert-evidence-types"
import { promoteEnrichedApolloCandidatesToCompanyContacts, loadPersistedApolloCandidatesForPromotion } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import { fetchStagingCanonicalCompanyId } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { loadStagingCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { verifyEmailWithZeroBounce } from "@/lib/growth/contact-verification/providers/zerobounce-client"
import { isApolloEmailEnrichmentEnabled, isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { enrichApolloPeopleWithBulkMatch } from "@/lib/growth/providers/apollo/apollo-enrich-people"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"

export const APOLLO_ENRICHMENT_CERT_RUNNER_QA_MARKER = "apollo-enrichment-cert-runner-en-1-v1" as const

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

function countChannels(candidates: GrowthContactCandidate[]): {
  email: number
  phone: number
  linkedin: number
} {
  let email = 0
  let phone = 0
  let linkedin = 0
  for (const candidate of candidates) {
    if (asString(candidate.email)) email += 1
    if (asString(candidate.phone)) phone += 1
    if (asString(candidate.linkedin_url)) linkedin += 1
  }
  return { email, phone, linkedin }
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

async function loadCompanyContext(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<{
  company_name: string
  domain: string | null
  canonical_company_id: string | null
}> {
  const staging = await loadStagingCompanyCandidateRow(admin, company_candidate_id)
  const row = staging?.row ?? null

  const domain = row
    ? canonicalNormalizedDomain(asString(row.domain), asString(row.website))
    : null

  const canonical_company_id = row
    ? await fetchStagingCanonicalCompanyId(admin, company_candidate_id)
    : null

  return {
    company_name: asString(row?.company_name) || company_candidate_id,
    domain,
    canonical_company_id,
  }
}

async function loadChannelLessApolloCandidates(
  admin: SupabaseClient,
  company_candidate_id: string,
  max_people: number,
): Promise<GrowthContactCandidate[]> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, created_at, updated_at, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, metadata",
    )
    .eq("company_candidate_id", company_candidate_id)
    .eq("provider_type", "future_apollo")
    .limit(Math.max(max_people * 3, max_people))

  const rows = (data ?? []) as GrowthContactCandidate[]
  return rows
    .filter((candidate) => !candidateHasObservedContactChannel(candidate))
    .slice(0, max_people)
}

async function updateEnrichedCandidates(
  admin: SupabaseClient,
  input: {
    candidates: GrowthContactCandidate[]
    enrichedByPersonId: Map<string, ReturnType<typeof mapApolloPeopleToContactDiscoveryRaw>["contacts"][number]>
  },
): Promise<number> {
  let updated = 0
  for (const candidate of input.candidates) {
    const personId = readApolloPersonId(candidate)
    if (!personId) continue
    const enriched = input.enrichedByPersonId.get(personId)
    if (!enriched) continue

    const nextEmail = asString(enriched.email) || candidate.email
    const nextPhone = asString(enriched.phone) || candidate.phone
    const nextLinkedin = asString(enriched.linkedin_url) || candidate.linkedin_url
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
        enriched.metadata && typeof enriched.metadata === "object"
          ? asString((enriched.metadata as Record<string, unknown>).apollo_email_status)
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

    if (!error) {
      candidate.email = nextEmail || null
      candidate.phone = nextPhone || null
      candidate.linkedin_url = nextLinkedin || null
      candidate.metadata = metadata
      updated += 1
    }
  }
  return updated
}

export async function runApolloEnrichmentCertEn3(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    env?: NodeJS.ProcessEnv
  },
): Promise<{ ok: boolean; evidence: ApolloEnrichmentCertEvidence | null; error: string | null }> {
  const company_candidate_id = input.company_candidate_id.trim()
  if (!company_candidate_id) {
    return { ok: false, evidence: null, error: "company_candidate_id is required for EN-3 promotion." }
  }

  const started = Date.now()
  const companyContext = await loadCompanyContext(admin, company_candidate_id)
  const enriched_candidates = await loadPersistedApolloCandidatesForPromotion(
    admin,
    company_candidate_id,
  )
  const recommended = getRecommendedApolloEnrichmentPath()

  const promotion = await promoteEnrichedApolloCandidatesToCompanyContacts(admin, {
    company_candidate_id,
    domain: companyContext.domain,
    canonical_company_id: companyContext.canonical_company_id,
    enriched_candidates,
  })

  const channelCounts = {
    email: enriched_candidates.filter((c) => asString(c.email)).length,
    linkedin: enriched_candidates.filter((c) => asString(c.linkedin_url)).length,
    phone: enriched_candidates.filter((c) => asString(c.phone)).length,
  }

  const evidence: ApolloEnrichmentCertEvidence = {
    qa_marker: APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER,
    cert_at: new Date().toISOString(),
    mock: isApolloMockEnabled(input.env ?? process.env),
    company: {
      company_candidate_id,
      company_name: companyContext.company_name,
      domain: companyContext.domain,
      canonical_company_id: promotion.canonical_company_id ?? companyContext.canonical_company_id,
    },
    gates: {
      enrich_emails: false,
      enrich_emails_ack: false,
      en_1_cert_enabled: false,
      en_1_cert_ack: false,
      max_people: enriched_candidates.length,
    },
    recommended_path: {
      path_id: recommended.path_id,
      name: recommended.name,
      credit_cost: recommended.credit_cost,
      env_gates: recommended.env_gates,
    },
    enrichment: {
      candidates_eligible: enriched_candidates.length,
      candidates_with_apollo_person_id: enriched_candidates.length,
      bulk_match_batches: 0,
      credits_consumed: 0,
      candidates_updated: 0,
    },
    channels: {
      emails_found: 0,
      phones_found: 0,
      linkedin_found: 0,
      verified_emails: 0,
      before: channelCounts,
      after: channelCounts,
    },
    promotion: {
      company_contacts_synced: promotion.company_contacts_synced,
      company_contacts_promoted: promotion.company_contacts_synced,
      enriched_candidates_with_email: promotion.enriched_candidates_with_email,
      enriched_candidates_with_linkedin: promotion.enriched_candidates_with_linkedin,
      promotion_attempted: promotion.promotion_attempted,
      promotion_blockers: promotion.promotion_blockers,
      company_contacts_created: promotion.company_contacts_created,
      company_contacts_updated: promotion.company_contacts_updated,
      contactable_after_promotion: promotion.contactable_after_promotion,
      sequence_ready_after_promotion: promotion.sequence_ready_after_promotion,
      canonical_company_resolution: promotion.canonical_company_resolution,
      canonical_person_backfill_rows_processed: promotion.canonical_person_backfill.rows_processed,
      canonical_person_backfill_persons_linked: promotion.canonical_person_backfill.persons_linked,
      rejection_reasons: promotion.rejection_reasons,
    },
    readiness: {
      sequence_ready: promotion.sequence_ready_after_promotion,
      contactable: promotion.contactable_after_promotion,
    },
    runtime: {
      duration_ms: Date.now() - started,
      api_calls: 0,
      errors: [],
    },
    certification: certifyApolloEnrichmentGoNoGo({
      enrichment: {
        candidates_eligible: enriched_candidates.length,
        candidates_with_apollo_person_id: enriched_candidates.length,
        bulk_match_batches: 0,
        credits_consumed: 0,
        candidates_updated: 0,
      },
      channels: {
        emails_found: 0,
        phones_found: 0,
        linkedin_found: 0,
        verified_emails: 0,
        before: channelCounts,
        after: channelCounts,
      },
      promotion: {
        company_contacts_synced: promotion.company_contacts_synced,
        company_contacts_promoted: promotion.company_contacts_synced,
        enriched_candidates_with_email: promotion.enriched_candidates_with_email,
        enriched_candidates_with_linkedin: promotion.enriched_candidates_with_linkedin,
        promotion_attempted: promotion.promotion_attempted,
        promotion_blockers: promotion.promotion_blockers,
        company_contacts_created: promotion.company_contacts_created,
        company_contacts_updated: promotion.company_contacts_updated,
        contactable_after_promotion: promotion.contactable_after_promotion,
        sequence_ready_after_promotion: promotion.sequence_ready_after_promotion,
        canonical_company_resolution: promotion.canonical_company_resolution,
        canonical_person_backfill_rows_processed: promotion.canonical_person_backfill.rows_processed,
        canonical_person_backfill_persons_linked: promotion.canonical_person_backfill.persons_linked,
        rejection_reasons: promotion.rejection_reasons,
      },
      runtime: {
        duration_ms: Date.now() - started,
        api_calls: 0,
        errors: [],
      },
      gates: {
        enrich_emails: false,
        enrich_emails_ack: false,
        en_1_cert_enabled: false,
        en_1_cert_ack: false,
        max_people: enriched_candidates.length,
      },
    }),
  }

  const ok =
    promotion.promotion_attempted &&
    promotion.enriched_candidates_with_email > 0 &&
    Boolean(promotion.canonical_company_id) &&
    promotion.company_contacts_synced > 0 &&
    promotion.contactable_after_promotion > 0

  return { ok, evidence, error: ok ? null : promotion.canonical_company_resolution.blocker_reason ?? promotion.promotion_blockers[0] ?? "EN-3 promotion incomplete." }
}

export async function runApolloEnrichmentCertEn1(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string
    max_people?: number
    env?: NodeJS.ProcessEnv
  },
): Promise<{ ok: boolean; evidence: ApolloEnrichmentCertEvidence | null; error: string | null }> {
  const env = input?.env ?? process.env
  const gates = assertApolloEnrichmentCertAllowed(env)
  if (!gates.ok) {
    return { ok: false, evidence: null, error: gates.error }
  }

  const company_candidate_id = (input?.company_candidate_id ?? gates.company_candidate_id ?? "").trim()
  const max_people = input?.max_people ?? resolveApolloEnrichmentCertMaxPeople(env)
  const mock = isApolloMockEnabled(env)
  const started = Date.now()
  const errors: string[] = []

  beginApolloRunGuardrails()

  try {
    const companyContext = await loadCompanyContext(admin, company_candidate_id)
    const candidates = await loadChannelLessApolloCandidates(admin, company_candidate_id, max_people)
    const persistedForPromotion = await loadPersistedApolloCandidatesForPromotion(
      admin,
      company_candidate_id,
    )
    const beforeChannels = countChannels(candidates)
    const withPersonId = candidates.filter((candidate) => Boolean(readApolloPersonId(candidate)))

    if (withPersonId.length === 0 && persistedForPromotion.length === 0) {
      errors.push(
        "No channel-less Apollo candidates with apollo_person_id — run search-only live pilot first.",
      )
    }

    const people = withPersonId.map(candidateToApolloPersonRecord)
    let bulk_match_batches = 0
    let credits_consumed = 0
    let candidates_updated = 0
    let verified_emails = 0

    if (people.length > 0 && isApolloEmailEnrichmentEnabled(env)) {
      const enriched = await enrichApolloPeopleWithBulkMatch({
        people,
        mock,
        domain: companyContext.domain,
        env,
        record_guardrails: true,
      })
      bulk_match_batches = enriched.batches
      credits_consumed = enriched.credits_estimate

      const mapped = mapApolloPeopleToContactDiscoveryRaw({
        people: enriched.people,
        company_name: companyContext.company_name,
        domain: companyContext.domain,
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

      candidates_updated = await updateEnrichedCandidates(admin, {
        candidates: withPersonId,
        enrichedByPersonId,
      })

      for (const candidate of withPersonId) {
        const email = asString(candidate.email)
        if (!email) continue
        const verification = await verifyEmailWithZeroBounce(email)
        if (verification?.email_status === "verified") verified_emails += 1
      }
    }

    const afterChannels = countChannels(withPersonId)

    const promotionCandidates =
      withPersonId.length > 0 ? withPersonId : persistedForPromotion

    const promotion = await promoteEnrichedApolloCandidatesToCompanyContacts(admin, {
      company_candidate_id,
      domain: companyContext.domain,
      canonical_company_id: companyContext.canonical_company_id,
      enriched_candidates: promotionCandidates,
    })

    const guardrails = getApolloRunGuardrailSnapshot()
    const recommended = getRecommendedApolloEnrichmentPath()

    const evidence: ApolloEnrichmentCertEvidence = {
      qa_marker: APOLLO_ENRICHMENT_CERT_EVIDENCE_QA_MARKER,
      cert_at: new Date().toISOString(),
      mock,
      company: {
        company_candidate_id,
        company_name: companyContext.company_name,
        domain: companyContext.domain,
        canonical_company_id: promotion.canonical_company_id ?? companyContext.canonical_company_id,
      },
      gates: {
        enrich_emails: isApolloEmailEnrichmentEnabled(env),
        enrich_emails_ack: env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
        en_1_cert_enabled: env.GROWTH_APOLLO_EN_1_CERT_ENABLED === "true" || env.GROWTH_APOLLO_EN_1_CERT_ENABLED === "1",
        en_1_cert_ack: env.GROWTH_APOLLO_EN_1_CERT_ACK === "1",
        max_people,
      },
      recommended_path: {
        path_id: recommended.path_id,
        name: recommended.name,
        credit_cost: recommended.credit_cost,
        env_gates: recommended.env_gates,
      },
      enrichment: {
        candidates_eligible: candidates.length,
        candidates_with_apollo_person_id: withPersonId.length,
        bulk_match_batches,
        credits_consumed: guardrails?.credits_estimate ?? credits_consumed,
        candidates_updated,
      },
      channels: {
        emails_found: afterChannels.email - beforeChannels.email,
        phones_found: afterChannels.phone - beforeChannels.phone,
        linkedin_found: afterChannels.linkedin - beforeChannels.linkedin,
        verified_emails,
        before: beforeChannels,
        after: afterChannels,
      },
      promotion: {
        company_contacts_synced: promotion.company_contacts_synced,
        company_contacts_promoted: promotion.company_contacts_synced,
        enriched_candidates_with_email: promotion.enriched_candidates_with_email,
        enriched_candidates_with_linkedin: promotion.enriched_candidates_with_linkedin,
        promotion_attempted: promotion.promotion_attempted,
        promotion_blockers: promotion.promotion_blockers,
        company_contacts_created: promotion.company_contacts_created,
        company_contacts_updated: promotion.company_contacts_updated,
        contactable_after_promotion: promotion.contactable_after_promotion,
        sequence_ready_after_promotion: promotion.sequence_ready_after_promotion,
        canonical_company_resolution: promotion.canonical_company_resolution,
        canonical_person_backfill_rows_processed:
          promotion.canonical_person_backfill.rows_processed,
        canonical_person_backfill_persons_linked:
          promotion.canonical_person_backfill.persons_linked,
        rejection_reasons: promotion.rejection_reasons,
      },
      readiness: {
        sequence_ready: promotion.sequence_ready_after_promotion,
        contactable: promotion.contactable_after_promotion,
      },
      runtime: {
        duration_ms: Date.now() - started,
        api_calls: guardrails?.api_calls ?? bulk_match_batches,
        errors,
      },
      certification: certifyApolloEnrichmentGoNoGo({
        enrichment: {
          candidates_eligible: candidates.length,
          candidates_with_apollo_person_id: withPersonId.length,
          bulk_match_batches,
          credits_consumed: guardrails?.credits_estimate ?? credits_consumed,
          candidates_updated,
        },
        channels: {
          emails_found: afterChannels.email - beforeChannels.email,
          phones_found: afterChannels.phone - beforeChannels.phone,
          linkedin_found: afterChannels.linkedin - beforeChannels.linkedin,
          verified_emails,
          before: beforeChannels,
          after: afterChannels,
        },
        promotion: {
          company_contacts_synced: promotion.company_contacts_synced,
          company_contacts_promoted: promotion.company_contacts_synced,
          enriched_candidates_with_email: promotion.enriched_candidates_with_email,
          enriched_candidates_with_linkedin: promotion.enriched_candidates_with_linkedin,
          promotion_attempted: promotion.promotion_attempted,
          promotion_blockers: promotion.promotion_blockers,
          company_contacts_created: promotion.company_contacts_created,
          company_contacts_updated: promotion.company_contacts_updated,
          contactable_after_promotion: promotion.contactable_after_promotion,
          sequence_ready_after_promotion: promotion.sequence_ready_after_promotion,
          canonical_person_backfill_rows_processed:
            promotion.canonical_person_backfill.rows_processed,
          canonical_person_backfill_persons_linked:
            promotion.canonical_person_backfill.persons_linked,
          rejection_reasons: promotion.rejection_reasons,
        },
        runtime: {
          duration_ms: Date.now() - started,
          api_calls: guardrails?.api_calls ?? bulk_match_batches,
          errors,
        },
        gates: {
          enrich_emails: isApolloEmailEnrichmentEnabled(env),
          enrich_emails_ack: env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
          en_1_cert_enabled: env.GROWTH_APOLLO_EN_1_CERT_ENABLED === "true" || env.GROWTH_APOLLO_EN_1_CERT_ENABLED === "1",
          en_1_cert_ack: env.GROWTH_APOLLO_EN_1_CERT_ACK === "1",
          max_people,
        },
      }),
    }

    return {
      ok: evidence.certification.go_no_go !== "no_go" && errors.length === 0,
      evidence,
      error: errors[0] ?? null,
    }
  } catch (error) {
    return {
      ok: false,
      evidence: null,
      error: error instanceof Error ? error.message : "Apollo enrichment certification failed.",
    }
  } finally {
    resetApolloRunGuardrails()
  }
}

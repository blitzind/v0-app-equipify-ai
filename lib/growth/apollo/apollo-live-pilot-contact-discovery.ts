/** Apollo live pilot contact discovery orchestration — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runContactDiscoveryProviders } from "@/lib/growth/contact-discovery/contact-discovery-registry"
import {
  buildContactDiscoveryProviderOutcomes,
  type GrowthContactDiscoveryProviderOutcome,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-outcomes"
import type {
  GrowthContactDiscoveryProviderResult,
  GrowthContactDiscoveryProviderType,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { filterNewContacts, findExistingContactDedupeHashes } from "@/lib/growth/contact-discovery/contact-dedupe"
import {
  dedupeNormalizedContacts,
  normalizeContactCandidate,
} from "@/lib/growth/contact-discovery/contact-normalizer"
import { runContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/contact-repository"
import type {
  GrowthContactCandidate,
  GrowthContactDiscoverySnapshot,
} from "@/lib/growth/contact-discovery/contact-discovery-types"
import {
  resolveApolloContactsFromDiscoverySnapshot,
  resolveApolloProviderOutcomeFromDiscoverySnapshot,
} from "@/lib/growth/apollo/apollo-live-pilot-discovery-result"

export type ApolloLivePilotContactDiscoveryResult = {
  snapshot: GrowthContactDiscoverySnapshot
  apollo_outcome: GrowthContactDiscoveryProviderOutcome | null
  apollo_contacts: GrowthContactCandidate[]
  apollo_provider_result: GrowthContactDiscoveryProviderResult | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function persistApolloProviderContacts(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    created_by?: string | null
    providerResults: Awaited<ReturnType<typeof runContactDiscoveryProviders>>
  },
): Promise<GrowthContactCandidate[]> {
  const normalized: Array<
    ReturnType<typeof normalizeContactCandidate> & {
      provider_name: string
      provider_type: string
    }
  > = []

  for (const providerResult of input.providerResults) {
    if (providerResult.status !== "success") continue
    for (const raw of providerResult.contacts) {
      const row = normalizeContactCandidate(
        raw,
        providerResult.provider_name,
        providerResult.provider_type,
        input.company_candidate_id,
      )
      if (row) {
        normalized.push({
          ...row,
          provider_name: providerResult.provider_name,
          provider_type: providerResult.provider_type,
        })
      }
    }
  }

  const deduped = dedupeNormalizedContacts(
    normalized.map(({ provider_name: _pn, provider_type: _pt, ...row }) => row),
  )
  const existingHashes = await findExistingContactDedupeHashes(
    admin,
    input.company_candidate_id,
    deduped.map((row) => row.dedupe_hash),
  )
  const toInsert = filterNewContacts(deduped, existingHashes)
  if (toInsert.length === 0) return []

  const { data: runRow } = await admin
    .schema("growth")
    .from("contact_discovery_runs")
    .insert({
      company_candidate_id: input.company_candidate_id,
      created_by: input.created_by ?? null,
      provider_names: input.providerResults.map((result) => result.provider_name),
      status: "completed",
      candidate_count: 0,
      error_message: null,
      metadata: { qa_marker: "apollo-live-pilot-contact-discovery-v1" },
    })
    .select("id")
    .single()

  const runId = asString((runRow as Record<string, unknown> | null)?.id)
  const inserts = toInsert.map((row) => {
    const provider = normalized.find((candidate) => candidate.dedupe_hash === row.dedupe_hash)
    return {
      run_id: runId || null,
      company_candidate_id: input.company_candidate_id,
      provider_name: provider?.provider_name ?? "apollo",
      provider_type: provider?.provider_type ?? "future_apollo",
      full_name: row.full_name,
      first_name: row.first_name,
      last_name: row.last_name,
      job_title: row.job_title,
      department: row.department,
      seniority: row.seniority,
      linkedin_url: row.linkedin_url,
      email: row.email,
      phone: row.phone,
      verification_state: row.verification_state,
      confidence: row.confidence,
      source_attribution: row.source_attribution,
      evidence: row.evidence,
      dedupe_hash: row.dedupe_hash,
      metadata: row.metadata,
    }
  })

  const { data: inserted } = await admin
    .schema("growth")
    .from("contact_candidates")
    .insert(inserts)
    .select(
      "id, created_at, updated_at, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, metadata",
    )

  return (inserted ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: asString(record.id),
      created_at: asString(record.created_at),
      updated_at: asString(record.updated_at),
      company_candidate_id: asString(record.company_candidate_id),
      provider_name: asString(record.provider_name),
      provider_type: asString(record.provider_type),
      full_name: asString(record.full_name),
      first_name: asString(record.first_name) || null,
      last_name: asString(record.last_name) || null,
      job_title: asString(record.job_title) || null,
      department: asString(record.department) || null,
      seniority: asString(record.seniority) || null,
      linkedin_url: asString(record.linkedin_url) || null,
      email: asString(record.email) || null,
      phone: asString(record.phone) || null,
      verification_state: asString(record.verification_state) as GrowthContactCandidate["verification_state"],
      confidence: typeof record.confidence === "number" ? record.confidence : 0,
      source_attribution: Array.isArray(record.source_attribution)
        ? (record.source_attribution as GrowthContactCandidate["source_attribution"])
        : [],
      evidence: Array.isArray(record.evidence)
        ? (record.evidence as GrowthContactCandidate["evidence"])
        : [],
      dedupe_hash: asString(record.dedupe_hash),
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
    }
  })
}

export async function runApolloLivePilotContactDiscovery(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_name: string
    domain: string | null
    website_url: string | null
    created_by?: string | null
    limit?: number
  },
): Promise<ApolloLivePilotContactDiscoveryResult> {
  const snapshot = await runContactDiscoveryForCompany(admin, {
    company_candidate_id: input.company_candidate_id,
    created_by: input.created_by ?? null,
    limit: input.limit ?? 10,
    provider_types: ["future_apollo"],
  })

  let apollo_outcome = resolveApolloProviderOutcomeFromDiscoverySnapshot(snapshot)
  const apollo_contacts = resolveApolloContactsFromDiscoverySnapshot(snapshot)

  if (apollo_outcome && apollo_contacts.length > 0) {
    return { snapshot, apollo_outcome, apollo_contacts, apollo_provider_result: null }
  }

  const providerResults = await runContactDiscoveryProviders(
    admin,
    {
      company_candidate_id: input.company_candidate_id,
      company_name: input.company_name,
      domain: input.domain,
      website_url: input.website_url,
      growth_lead_id: null,
      industry: null,
      limit: input.limit ?? 10,
    },
    { provider_types: ["future_apollo"] },
  )

  const apolloProviderResult = providerResults.find(
    (result) => result.provider_name === "apollo" || result.provider_type === "future_apollo",
  )

  const persisted = await persistApolloProviderContacts(admin, {
    company_candidate_id: input.company_candidate_id,
    created_by: input.created_by,
    providerResults,
  })

  const provider_outcomes = buildContactDiscoveryProviderOutcomes({
    provider_results: providerResults,
    persisted_by_provider: { apollo: persisted.length },
  })

  apollo_outcome =
    provider_outcomes.find(
      (outcome) => outcome.provider === "apollo" || outcome.provider === "future_apollo",
    ) ??
    (apolloProviderResult
      ? {
          provider: apolloProviderResult.provider_name,
          contacts_returned: apolloProviderResult.contacts.length,
          contacts_persisted: persisted.length,
          status: apolloProviderResult.status,
          message:
            apolloProviderResult.status === "skipped" || apolloProviderResult.status === "failed"
              ? apolloProviderResult.message
              : persisted.length === 0
                ? apolloProviderResult.message
                : null,
          provider_error:
            apolloProviderResult.status === "failed"
              ? apolloProviderResult.error ?? apolloProviderResult.message
              : null,
        }
      : null)

  const mergedContacts = [
    ...persisted,
    ...apollo_contacts.filter((contact) => !persisted.some((stored) => stored.id === contact.id)),
  ]

  const provider_messages = providerResults.map(
    (result) => `${result.provider_name}: ${result.status} — ${result.message}`,
  )

  return {
    snapshot: {
      ...snapshot,
      provider_messages: provider_messages.length > 0 ? provider_messages : snapshot.provider_messages,
      provider_outcomes:
        provider_outcomes.length > 0 ? provider_outcomes : snapshot.provider_outcomes,
      contacts: mergedContacts.length > 0 ? mergedContacts : snapshot.contacts,
    },
    apollo_outcome,
    apollo_contacts: mergedContacts,
    apollo_provider_result: apolloProviderResult ?? null,
  }
}

/** Phase 7.PS-IR — PDL acquisition for benchmark cohort companies. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
  type BenchmarkPdlValidationRejectedRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isFalsePositiveEmailLocalPartIdentity } from "@/lib/growth/human-identity-evidence/email-local-part-identity-guards"
import { upsertProviderCompanyContacts } from "@/lib/growth/providers/pdl/pdl-contact-persistence"
import { searchPdlPeopleByCompany } from "@/lib/growth/providers/pdl/pdl-client"
import { mapPdlPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
import { recordPdlProviderPersistedContacts } from "@/lib/growth/providers/pdl/pdl-provider-diagnostics"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function evaluatePdlPersonAcceptance(contact: GrowthContactDiscoveryProviderRawContact): {
  accepted: boolean
  reason: string | null
} {
  const full_name = asString(contact.full_name)
  const email = asString(contact.email) || null

  if (!full_name) return { accepted: false, reason: "missing_full_name" }
  if (isFalsePositiveEmailLocalPartIdentity(full_name, email)) {
    return { accepted: false, reason: "false_positive_identity_name" }
  }
  if (!isPlausiblePersonName(full_name)) {
    return { accepted: false, reason: "name_not_plausible" }
  }

  const identity = classifyContactIdentity({
    full_name,
    title: asString(contact.job_title) || null,
    email,
    phone: asString(contact.phone) || null,
    linkedin_url: asString(contact.linkedin_url) || null,
    source_type: "public_record",
  })

  if (!identity.eligible_for_canonical_person) {
    return { accepted: false, reason: "not_eligible_for_canonical_person" }
  }
  if (identity.classification === "company_channel" || identity.classification === "generic_placeholder") {
    return { accepted: false, reason: "company_channel_or_generic" }
  }

  return { accepted: true, reason: null }
}

function tagBenchmarkContact(
  contact: GrowthContactDiscoveryProviderRawContact,
): GrowthContactDiscoveryProviderRawContact {
  return {
    ...contact,
    metadata: {
      ...(contact.metadata ?? {}),
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER,
      benchmark_pdl_validation: true,
    },
    source_attribution: [
      ...(contact.source_attribution ?? []),
      {
        source: "people_data_labs",
        provider_type: "future_people_data_labs",
        provider_name: "people_data_labs",
        signal: "benchmark_pdl_validation",
        evidence: "Phase 7.PS-IR benchmark PDL validation",
        confidence: contact.confidence ?? 0.7,
      },
    ],
  }
}

export async function acquireBenchmarkPdlContacts(
  admin: SupabaseClient,
  input: {
    companies: Array<{
      canonical_company_id: string
      company_name: string
      company_candidate_id: string
      domain: string | null
      industry: string | null
    }>
    limit_per_company?: number
    require_production?: boolean
  },
): Promise<{
  company_results: Array<{
    canonical_company_id: string
    company_name: string
    company_candidate_id: string
    status: "success" | "skipped" | "failed" | "no_results"
    persons_discovered: number
    persons_accepted: number
    persons_persisted: number
    persons_rejected: number
    sandbox: boolean
    messages: string[]
  }>
  rejected: BenchmarkPdlValidationRejectedRecord[]
  messages: string[]
}> {
  const messages: string[] = []
  const rejected: BenchmarkPdlValidationRejectedRecord[] = []
  const company_results: Array<{
    canonical_company_id: string
    company_name: string
    company_candidate_id: string
    status: "success" | "skipped" | "failed" | "no_results"
    persons_discovered: number
    persons_accepted: number
    persons_persisted: number
    persons_rejected: number
    sandbox: boolean
    messages: string[]
  }> = []

  const limit = input.limit_per_company ?? 25
  const sandbox = input.require_production === false

  for (const company of input.companies) {
    const rowMessages: string[] = []
    const search = await searchPdlPeopleByCompany(
      {
        company_name: company.company_name,
        domain: company.domain,
        industry: company.industry,
        limit,
        prefer_reachable: true,
      },
      { sandbox },
    )

    if (search.status === "skipped") {
      company_results.push({
        ...company,
        status: "skipped",
        persons_discovered: 0,
        persons_accepted: 0,
        persons_persisted: 0,
        persons_rejected: 0,
        sandbox: search.sandbox,
        messages: [search.message ?? "pdl_skipped"],
      })
      continue
    }

    if (search.status === "failed") {
      company_results.push({
        ...company,
        status: "failed",
        persons_discovered: 0,
        persons_accepted: 0,
        persons_persisted: 0,
        persons_rejected: 0,
        sandbox: search.sandbox,
        messages: [search.message ?? search.error ?? "pdl_failed"],
      })
      continue
    }

    const mapped = mapPdlPeopleToContactDiscoveryRaw({
      people: search.people,
      company_name: company.company_name,
      domain: company.domain,
      sandbox: search.sandbox,
    })

    const accepted: GrowthContactDiscoveryProviderRawContact[] = []
    for (const contact of mapped) {
      const gate = evaluatePdlPersonAcceptance(contact)
      if (gate.accepted) {
        accepted.push(tagBenchmarkContact(contact))
      } else {
        rejected.push({
          company_name: company.company_name,
          full_name: contact.full_name,
          email: contact.email ?? null,
          reason: gate.reason ?? "rejected",
        })
      }
    }

    let persisted = 0
    if (accepted.length > 0) {
      persisted = await upsertProviderCompanyContacts(admin, {
        company_id: company.company_candidate_id,
        provider_type: "future_people_data_labs",
        provider_name: "people_data_labs",
        contacts: accepted,
      })
      recordPdlProviderPersistedContacts({ contacts_persisted: persisted })
    }

    const status = mapped.length === 0 ? "no_results" : "success"
    rowMessages.push(
      `pdl_${status}: discovered=${mapped.length} accepted=${accepted.length} persisted=${persisted}`,
    )

    company_results.push({
      ...company,
      status,
      persons_discovered: mapped.length,
      persons_accepted: accepted.length,
      persons_persisted: persisted,
      persons_rejected: mapped.length - accepted.length,
      sandbox: search.sandbox,
      messages: rowMessages,
    })
  }

  const total_discovered = company_results.reduce((sum, r) => sum + r.persons_discovered, 0)
  const total_persisted = company_results.reduce((sum, r) => sum + r.persons_persisted, 0)
  messages.push(
    `pdl_acquisition: companies=${input.companies.length} discovered=${total_discovered} persisted=${total_persisted} rejected=${rejected.length}`,
  )

  return { company_results, rejected, messages }
}

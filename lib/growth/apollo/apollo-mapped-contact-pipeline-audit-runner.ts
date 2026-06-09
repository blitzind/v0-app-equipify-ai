/** Apollo mapped contact pipeline audit runner — server-only, evidence only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import {
  APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS,
  buildApolloMappedContactPipelineAuditReport,
  buildApolloMappedContactPipelineAuditRow,
  candidateHasObservedContactChannelForAudit,
  type ApolloMappedContactPipelineAuditReport,
} from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit"
import { candidateHasObservedContactChannel } from "@/lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { isApolloEmailEnrichmentEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { searchApolloPeopleByCompany } from "@/lib/growth/providers/apollo/apollo-client"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import {
  beginApolloRunGuardrails,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"

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

async function resolveMedicalEquipmentSolutionsCompany(admin: SupabaseClient): Promise<{
  company_candidate_id: string
  company_name: string
  domain: string
} | null> {
  const target = APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS
  const { data: rows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, domain, website")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(500)

  const match = (rows ?? []).find((raw) => {
    const row = raw as Record<string, unknown>
    const name = asString(row.company_name).toLowerCase()
    return name.includes("medical equipment solutions")
  })

  if (!match) {
    return {
      company_candidate_id: "",
      company_name: target.company_name,
      domain: target.domain,
    }
  }

  const row = match as Record<string, unknown>
  return {
    company_candidate_id: asString(row.company_id),
    company_name: asString(row.company_name) || target.company_name,
    domain:
      canonicalNormalizedDomain(asString(row.domain), asString(row.website)) || target.domain,
  }
}

async function loadPersistedContactIndexes(
  admin: SupabaseClient,
  input: { company_candidate_id: string; canonical_company_id: string | null },
): Promise<{
  candidates_by_apollo_id: Map<string, GrowthContactCandidate>
  company_contacts_by_candidate_id: Map<string, Record<string, unknown>>
  company_contacts_by_apollo_id: Map<string, Record<string, unknown>>
}> {
  const candidates_by_apollo_id = new Map<string, GrowthContactCandidate>()
  const company_contacts_by_candidate_id = new Map<string, Record<string, unknown>>()
  const company_contacts_by_apollo_id = new Map<string, Record<string, unknown>>()

  if (input.company_candidate_id) {
    const { data: candidates } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("*")
      .eq("company_candidate_id", input.company_candidate_id)
      .eq("provider_type", "future_apollo")
      .limit(200)

    for (const raw of candidates ?? []) {
      const candidate = raw as GrowthContactCandidate
      const apolloId = readApolloPersonId(candidate)
      if (apolloId) candidates_by_apollo_id.set(apolloId, candidate)
    }
  }

  if (input.canonical_company_id) {
    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", input.canonical_company_id)
      .limit(200)

    for (const raw of contacts ?? []) {
      const row = raw as Record<string, unknown>
      const candidateId = asString(row.contact_candidate_id)
      if (candidateId) company_contacts_by_candidate_id.set(candidateId, row)

      const metadata =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {}
      const apolloId = asString(metadata.apollo_person_id)
      if (apolloId) company_contacts_by_apollo_id.set(apolloId, row)
    }
  }

  return {
    candidates_by_apollo_id,
    company_contacts_by_candidate_id,
    company_contacts_by_apollo_id,
  }
}

export async function runApolloMappedContactPipelineAudit(input: {
  admin: SupabaseClient
  env?: NodeJS.ProcessEnv
  mock?: boolean
}): Promise<ApolloMappedContactPipelineAuditReport> {
  const env = input.env ?? process.env
  const mock = input.mock ?? env.GROWTH_APOLLO_USE_MOCK === "true"
  const company = await resolveMedicalEquipmentSolutionsCompany(input.admin)
  if (!company) {
    throw new Error("Medical Equipment Solutions company not found")
  }

  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(input.admin, {
    company_candidate_id: company.company_candidate_id,
    domain: company.domain,
  })

  beginApolloRunGuardrails()
  try {
    const search = await searchApolloPeopleByCompany(
      {
        company_name: company.company_name,
        domain: company.domain,
        website_url: `https://www.${company.domain}`,
        limit: 25,
      },
      { mock, tier: 2 },
    )

    const mapped = mapApolloPeopleToContactDiscoveryRaw({
      people: search.people,
      company_name: company.company_name,
      domain: company.domain,
      mock: search.mock,
    })

    const indexes = await loadPersistedContactIndexes(input.admin, {
      company_candidate_id: company.company_candidate_id,
      canonical_company_id: resolution.canonical_company_id,
    })

    const enrichment_enabled = isApolloEmailEnrichmentEnabled(env)
    const peopleById = new Map(
      search.people.map((person) => [asString(person.id), person] as const).filter(([id]) => Boolean(id)),
    )

    const auditRows = mapped.contacts.map((contact) => {
      const metadata =
        contact.metadata && typeof contact.metadata === "object"
          ? (contact.metadata as Record<string, unknown>)
          : {}
      const apolloPersonId =
        asString(metadata.apollo_person_id) || asString(contact.external_provider_contact_id)
      const person =
        (apolloPersonId ? peopleById.get(apolloPersonId) : undefined) ??
        ({
          id: apolloPersonId,
          name: contact.full_name,
          title: contact.job_title,
          linkedin_url: contact.linkedin_url,
          email_status: asString(metadata.apollo_email_status) || null,
          organization: { name: company.company_name, primary_domain: company.domain },
        } satisfies import("@/lib/growth/providers/apollo/apollo-types").ApolloPersonRecord)

      const persistedCandidate = apolloPersonId
        ? indexes.candidates_by_apollo_id.get(apolloPersonId)
        : undefined
      const companyContact =
        (persistedCandidate
          ? indexes.company_contacts_by_candidate_id.get(persistedCandidate.id)
          : undefined) ??
        (apolloPersonId ? indexes.company_contacts_by_apollo_id.get(apolloPersonId) : undefined)

      const effectiveContact = persistedCandidate
        ? {
            ...contact,
            full_name: persistedCandidate.full_name || contact.full_name,
            job_title: persistedCandidate.job_title || contact.job_title,
            email: persistedCandidate.email || contact.email,
            phone: persistedCandidate.phone || contact.phone,
            linkedin_url: persistedCandidate.linkedin_url || contact.linkedin_url,
            metadata: {
              ...(contact.metadata && typeof contact.metadata === "object"
                ? (contact.metadata as Record<string, unknown>)
                : {}),
              ...(persistedCandidate.metadata && typeof persistedCandidate.metadata === "object"
                ? (persistedCandidate.metadata as Record<string, unknown>)
                : {}),
            },
          }
        : contact

      return buildApolloMappedContactPipelineAuditRow({
        person,
        contact: effectiveContact,
        target_company_name: company.company_name,
        target_domain: company.domain,
        enrichment_enabled,
        mapped_contact_id: persistedCandidate?.id ?? apolloPersonId,
        contact_candidate_id: persistedCandidate?.id ?? null,
        company_contact_id: asString(companyContact?.id) || null,
        canonical_person_id: asString(companyContact?.canonical_person_id) || null,
        persisted_has_channel: persistedCandidate
          ? candidateHasObservedContactChannelForAudit(persistedCandidate)
          : candidateHasObservedContactChannel(effectiveContact as never),
      })
    })

    return buildApolloMappedContactPipelineAuditReport({
      company_name: company.company_name,
      domain: company.domain,
      company_candidate_id: company.company_candidate_id || null,
      canonical_company_id: resolution.canonical_company_id,
      tier_used: 2,
      apollo_people_returned: search.people.length,
      apollo_people_mapped: auditRows.length,
      contacts: auditRows,
    })
  } finally {
    resetApolloRunGuardrails()
  }
}

/** Apollo-Scale-5A contactable eligibility audit runner — evidence only, server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES,
  buildApolloContactableEligibilityAuditContact,
  buildApolloContactableEligibilityAuditReport,
  isScale5AVerifiedContactName,
  normalizeContactName,
  type ApolloContactableEligibilityAuditReport,
} from "@/lib/growth/apollo/apollo-contactable-eligibility-audit"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import { resolveMedicalEquipmentSolutionsCompany } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit-runner"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function loadPrimaryPersonEmail(
  admin: SupabaseClient,
  person_id: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from("person_emails")
    .select("*")
    .eq("person_id", person_id)
    .order("is_primary", { ascending: false })
    .limit(1)

  return (data?.[0] as Record<string, unknown> | undefined) ?? null
}

async function loadCanonicalPerson(
  admin: SupabaseClient,
  person_id: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin.schema("growth").from("persons").select("*").eq("id", person_id).maybeSingle()
  return (data as Record<string, unknown> | undefined) ?? null
}

export async function runApolloContactableEligibilityAudit(input: {
  admin: SupabaseClient
}): Promise<ApolloContactableEligibilityAuditReport> {
  const company = await resolveMedicalEquipmentSolutionsCompany(input.admin)
  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(input.admin, {
    company_candidate_id: company.company_candidate_id,
    domain: company.domain,
  })

  const candidatesByName = new Map<string, GrowthContactCandidate>()
  const companyContactsByCandidateId = new Map<string, Record<string, unknown>>()
  const companyContactsByName = new Map<string, Record<string, unknown>>()

  if (company.company_candidate_id) {
    const { data: candidateRows } = await input.admin
      .schema("growth")
      .from("contact_candidates")
      .select("*")
      .eq("company_candidate_id", company.company_candidate_id)
      .eq("provider_type", "future_apollo")
      .limit(200)

    for (const raw of candidateRows ?? []) {
      const candidate = raw as GrowthContactCandidate
      candidatesByName.set(normalizeContactName(candidate.full_name), candidate)
    }
  }

  if (resolution.canonical_company_id) {
    const { data: companyContactRows } = await input.admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", resolution.canonical_company_id)
      .limit(200)

    for (const raw of companyContactRows ?? []) {
      const row = raw as Record<string, unknown>
      const candidateId = asString(row.contact_candidate_id)
      if (candidateId) companyContactsByCandidateId.set(candidateId, row)
      const name = normalizeContactName(asString(row.full_name))
      if (name) companyContactsByName.set(name, row)
    }
  }

  const contacts = []
  for (const full_name of APOLLO_SCALE_5A_VERIFIED_CONTACT_NAMES) {
    const normalized = normalizeContactName(full_name)
    const candidate = candidatesByName.get(normalized)
    const companyContact =
      (candidate ? companyContactsByCandidateId.get(candidate.id) : undefined) ??
      companyContactsByName.get(normalized) ??
      null

    const canonicalPersonId =
      asString(companyContact?.canonical_person_id) ||
      asString(candidate?.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>).canonical_person_id
        : null) ||
      null

    const canonicalPerson = canonicalPersonId
      ? await loadCanonicalPerson(input.admin, canonicalPersonId)
      : null
    const canonicalPersonPrimaryEmail = canonicalPersonId
      ? await loadPrimaryPersonEmail(input.admin, canonicalPersonId)
      : null

    contacts.push(
      buildApolloContactableEligibilityAuditContact({
        full_name,
        company_contact: companyContact,
        contact_candidate: candidate ?? null,
        canonical_person: canonicalPerson,
        canonical_person_primary_email: canonicalPersonPrimaryEmail,
        company_contact_id: asString(companyContact?.id) || null,
        contact_candidate_id: candidate?.id ?? null,
      }),
    )
  }

  const allApolloCandidates = [...candidatesByName.values()]
  for (const candidate of allApolloCandidates) {
    if (isScale5AVerifiedContactName(candidate.full_name)) continue
    const companyContact = companyContactsByCandidateId.get(candidate.id) ?? null
    if (!companyContact && !candidate) continue
    contacts.push(
      buildApolloContactableEligibilityAuditContact({
        full_name: candidate.full_name,
        company_contact: companyContact,
        contact_candidate: candidate,
        canonical_person: null,
        canonical_person_primary_email: null,
        company_contact_id: asString(companyContact?.id) || null,
        contact_candidate_id: candidate.id,
      }),
    )
  }

  return buildApolloContactableEligibilityAuditReport({
    company_name: company.company_name,
    domain: company.domain,
    company_candidate_id: company.company_candidate_id || null,
    canonical_company_id: resolution.canonical_company_id,
    contacts,
  })
}

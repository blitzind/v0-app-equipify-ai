/** Phase 7.PS-HY — Reconcile corroboration signals to existing evidence-backed persons. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedPersonName } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import { evidenceFromPage } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import {
  appendCompanyRoleEvidenceRepository,
  enrichPersonCompanyRoleFromTitleEvidence,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-repository"
import { personNameMatchesDiscoveryContact } from "@/lib/growth/email-discovery/email-discovery-name-match"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import {
  corroborationToTitleEvidence,
  isEvidenceBackedTitleMatch,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-extract"
import {
  GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
  type EvidenceBackedPersonTarget,
  type ProfessionalIdentityCorroborationSignal,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadEvidenceBackedPersonTargets(
  admin: SupabaseClient,
  cohort: PersonCommitteeDensityCohortCompany[],
): Promise<EvidenceBackedPersonTarget[]> {
  const companyIds = cohort.map((c) => c.canonical_company_id)
  if (companyIds.length === 0) return []

  const cohortByCompany = new Map(cohort.map((c) => [c.canonical_company_id, c]))

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, title, linkedin_url, contact_status",
    )
    .in("company_id", companyIds)
    .not("canonical_person_id", "is", null)
    .neq("contact_status", "archived")
    .limit(120)

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, website, primary_domain")
    .in("id", companyIds)

  const websiteByCompany = new Map<string, string | null>()
  for (const row of companies ?? []) {
    const website = asString(row.website) || asString(row.primary_domain)
    websiteByCompany.set(
      asString(row.id),
      website ? (website.startsWith("http") ? website : `https://${website}`) : null,
    )
  }

  const targets: EvidenceBackedPersonTarget[] = []
  const seenPersonCompany = new Set<string>()

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const person_id = asString(record.canonical_person_id)
    const company_id = asString(record.company_id)
    const full_name = asString(record.full_name)
    const identity = classifyContactIdentity({
      full_name,
      title: asString(record.title),
      linkedin_url: asString(record.linkedin_url),
    })
    if (!person_id || !identity.eligible_for_canonical_person) continue

    const key = `${person_id}:${company_id}`
    if (seenPersonCompany.has(key)) continue
    seenPersonCompany.add(key)

    const cohortRow = cohortByCompany.get(company_id)
    if (!cohortRow) continue

    targets.push({
      person_id,
      company_id,
      company_name: cohortRow.company_name,
      company_candidate_id: cohortRow.company_candidate_id,
      full_name,
      normalized_name: canonicalNormalizedPersonName(full_name),
      title: asString(record.title) || null,
      company_contact_id: asString(record.id),
      website_url: websiteByCompany.get(company_id) ?? null,
    })
  }

  return targets
}

function signalMatchesExistingPerson(
  signal: ProfessionalIdentityCorroborationSignal,
  target: EvidenceBackedPersonTarget,
): boolean {
  if (!personNameMatchesDiscoveryContact({
    person_normalized_name: target.normalized_name,
    contact_full_name: signal.matched_name,
  })) {
    return false
  }

  const companyHay = signal.matched_company.toLowerCase()
  const companyNeedle = target.company_name.toLowerCase()
  if (!companyHay.includes(companyNeedle) && !companyNeedle.includes(companyHay)) {
    const tokens = companyNeedle.split(/\s+/).filter((t) => t.length > 3)
    if (!tokens.every((t) => companyHay.includes(t) || signal.evidence_excerpt.toLowerCase().includes(t))) {
      return false
    }
  }

  if (signal.matched_title) {
    return isEvidenceBackedTitleMatch({
      title: signal.matched_title,
      excerpt: signal.evidence_excerpt,
      full_name: target.full_name,
    })
  }

  return true
}

async function persistCorroborationEvidence(
  admin: SupabaseClient,
  input: {
    person_id: string
    signals: ProfessionalIdentityCorroborationSignal[]
  },
): Promise<number> {
  const { data: person } = await admin
    .schema("growth")
    .from("persons")
    .select("metadata")
    .eq("id", input.person_id)
    .maybeSingle()

  const metadata =
    person?.metadata && typeof person.metadata === "object"
      ? ({ ...(person.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const existing = Array.isArray(metadata.professional_identity_corroboration)
    ? (metadata.professional_identity_corroboration as ProfessionalIdentityCorroborationSignal[])
    : []

  const seen = new Set(
    existing.map((row) => `${row.source_type}:${row.source_url}:${row.matched_title ?? ""}`),
  )
  let added = 0
  for (const signal of input.signals) {
    const key = `${signal.source_type}:${signal.source_url}:${signal.matched_title ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    existing.push(signal)
    added += 1
  }
  if (added === 0) return 0

  await admin
    .schema("growth")
    .from("persons")
    .update({
      metadata: {
        ...metadata,
        professional_identity_corroboration: existing,
        professional_identity_corroboration_qa_marker:
          GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
        professional_identity_corroboration_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.person_id)

  return added
}

async function promoteLinkedInFromPublicEvidence(
  admin: SupabaseClient,
  input: {
    target: EvidenceBackedPersonTarget
    signal: ProfessionalIdentityCorroborationSignal
  },
): Promise<boolean> {
  const linkedin_url = asString(input.signal.linkedin_url)
  if (!linkedin_url) return false

  const { data: contact } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, linkedin_url, source_evidence, metadata")
    .eq("id", input.target.company_contact_id)
    .maybeSingle()

  if (!contact) return false
  if (asString(contact.linkedin_url)) return false

  const source_evidence = Array.isArray(contact.source_evidence)
    ? [...(contact.source_evidence as Array<Record<string, unknown>>)]
    : []

  source_evidence.push(
    evidenceFromPage({
      claim: `corroboration_linkedin: ${input.target.full_name}`,
      excerpt: input.signal.evidence_excerpt,
      source: input.signal.source_type,
      page_url: input.signal.source_url,
    }),
  )

  await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      linkedin_url,
      source_evidence,
      metadata: {
        ...(contact.metadata && typeof contact.metadata === "object"
          ? (contact.metadata as Record<string, unknown>)
          : {}),
        linkedin_from_public_evidence: true,
        professional_identity_corroboration_qa_marker:
          GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.target.company_contact_id)

  return true
}

export async function reconcileProfessionalIdentityCorroboration(
  admin: SupabaseClient,
  input: {
    target: EvidenceBackedPersonTarget
    signals: ProfessionalIdentityCorroborationSignal[]
  },
): Promise<{
  corroborated: boolean
  titles_strengthened: number
  linkedin_urls_discovered: number
  accepted_signals: ProfessionalIdentityCorroborationSignal[]
}> {
  const accepted = input.signals.filter((signal) => signalMatchesExistingPerson(signal, input.target))
  if (accepted.length === 0) {
    return {
      corroborated: false,
      titles_strengthened: 0,
      linkedin_urls_discovered: 0,
      accepted_signals: [],
    }
  }

  await persistCorroborationEvidence(admin, {
    person_id: input.target.person_id,
    signals: accepted,
  })

  let titles_strengthened = 0
  let linkedin_urls_discovered = 0
  const titleRecords = []

  for (const signal of accepted) {
    const linkedin = await promoteLinkedInFromPublicEvidence(admin, {
      target: input.target,
      signal,
    })
    if (linkedin) linkedin_urls_discovered += 1

    const titleEvidence = corroborationToTitleEvidence(signal, input.target)
    if (!titleEvidence) continue

    const enrich = await enrichPersonCompanyRoleFromTitleEvidence(admin, {
      person_id: input.target.person_id,
      company_id: input.target.company_id,
      company_contact_id: input.target.company_contact_id,
      evidence: titleEvidence,
    })
    if (enrich.enriched) titles_strengthened += 1
    titleRecords.push(titleEvidence)
  }

  if (titleRecords.length > 0) {
    await appendCompanyRoleEvidenceRepository(admin, {
      company_id: input.target.company_id,
      records: titleRecords,
    })
  }

  return {
    corroborated: true,
    titles_strengthened,
    linkedin_urls_discovered,
    accepted_signals: accepted,
  }
}

/** Phase 7.PS-IO — Strict corroboration reconciliation for benchmark professional identity. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyCommitteeRoleFromJobTitle } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-role-classification"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { companyContactDedupeHash } from "@/lib/growth/contact-discovery/website-contact-discovery"
import {
  evidenceFromPage,
  isPlausiblePersonName,
} from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
  type BenchmarkProfessionalIdentityCommitteeClassification,
  type BenchmarkProfessionalIdentityEvidenceRecord,
  type BenchmarkProfessionalIdentityRejectedRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-professional-identity-expansion-types"
import { matchExternalRecordToCohortCompany } from "@/lib/growth/external-evidence/external-evidence-reconciliation"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isFalsePositiveEmailLocalPartIdentity } from "@/lib/growth/human-identity-evidence/email-local-part-identity-guards"
import {
  collectTitleEvidenceForContact,
  selectBestTitleEvidence,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-extract"
import { enrichPersonCompanyRoleFromTitleEvidence } from "@/lib/growth/human-identity-evidence/title-role-evidence-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function companyAppearsInExcerpt(excerpt: string, company_name: string): boolean {
  const hay = normalizeCompanyName(excerpt)
  const needle = normalizeCompanyName(company_name)
  if (!needle) return false
  if (hay.includes(needle)) return true
  const tokens = needle.split(" ").filter((t) => t.length > 3)
  return tokens.length >= 2 && tokens.every((t) => hay.includes(t))
}

function personAppearsInExcerpt(excerpt: string, person_name: string): boolean {
  const hay = excerpt.toLowerCase()
  const name = person_name.trim()
  if (!name) return false
  if (hay.includes(name.toLowerCase())) return true
  const parts = name.split(/\s+/).filter((p) => p.length >= 2)
  return parts.length >= 2 && parts.every((p) => hay.includes(p.toLowerCase()))
}

export function evaluateBenchmarkProfessionalIdentityCorroboration(
  record: BenchmarkProfessionalIdentityEvidenceRecord,
  cohortCompany: { canonical_company_id: string; company_name: string },
): { accepted: boolean; reason: string | null } {
  const person_name = asString(record.person_name)
  const title = asString(record.title) || null
  const excerpt = asString(record.evidence_excerpt)
  const source_url = asString(record.source_url)

  if (!person_name) return { accepted: false, reason: "missing_person_name" }
  if (!source_url) return { accepted: false, reason: "missing_source_url" }
  if (!excerpt) return { accepted: false, reason: "missing_evidence_excerpt" }
  if (isFalsePositiveEmailLocalPartIdentity(person_name, null)) {
    return { accepted: false, reason: "false_positive_identity_name" }
  }
  if (!personAppearsInExcerpt(excerpt, person_name)) {
    return { accepted: false, reason: "person_name_not_in_excerpt" }
  }
  if (!companyAppearsInExcerpt(excerpt, cohortCompany.company_name)) {
    return { accepted: false, reason: "company_association_not_in_excerpt" }
  }

  const plausible =
    isPlausiblePersonName(person_name) ||
    (/^[A-Z][a-z]{2,}$/.test(person_name) && personAppearsInExcerpt(excerpt, person_name))
  if (!plausible) return { accepted: false, reason: "name_not_plausible" }

  const identity = classifyContactIdentity({ full_name: person_name, title, source_type: "public_record" })
  if (!identity.eligible_for_canonical_person) {
    return { accepted: false, reason: "not_eligible_for_canonical_person" }
  }

  return { accepted: true, reason: null }
}

function toSourceEvidence(record: BenchmarkProfessionalIdentityEvidenceRecord) {
  return [
    evidenceFromPage({
      claim: `benchmark_professional_identity:${record.person_name}${record.title ? ` — ${record.title}` : ""}`,
      excerpt: record.evidence_excerpt,
      source: record.source_type,
      page_url: record.source_url,
    }),
  ]
}

function classifyCommitteeFromRecord(
  record: BenchmarkProfessionalIdentityEvidenceRecord,
): BenchmarkProfessionalIdentityCommitteeClassification | null {
  const title = asString(record.title)
  if (!title) return null
  const match = classifyCommitteeRoleFromJobTitle({ job_title: title })
  if (!match) return null
  return {
    job_title: title,
    committee_role: match.committee_role,
    pattern_id: match.pattern_id,
    matched_span: match.matched_span,
    confidence_tier: "direct_evidence",
    source_url: record.source_url,
    source_type: record.source_type,
    evidence_excerpt: record.evidence_excerpt,
  }
}

async function upsertBenchmarkProfessionalIdentityContact(
  admin: SupabaseClient,
  input: {
    company_id: string
    record: BenchmarkProfessionalIdentityEvidenceRecord
    committee: BenchmarkProfessionalIdentityCommitteeClassification | null
  },
): Promise<{ contact_id: string | null; title_created: boolean }> {
  const full_name = asString(input.record.person_name)
  const title = asString(input.record.title) || null
  const dedupe_hash = companyContactDedupeHash({
    company_id: input.company_id,
    full_name,
    title,
    email: null,
  })

  const metadata: Record<string, unknown> = {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER,
    external_source_type: input.record.source_type,
    external_source_url: input.record.source_url,
    identity_classification: "named_person",
    eligible_for_canonical_person: true,
    professional_identity_source_attribution: {
      source_type: input.record.source_type,
      source_url: input.record.source_url,
      observed_at: input.record.observed_at,
    },
  }
  if (input.committee) {
    metadata.committee_title_classification = input.committee
  }

  const row = {
    company_id: input.company_id,
    full_name,
    title,
    source_type: "public_record",
    source_evidence: toSourceEvidence(input.record),
    contact_status: "candidate",
    dedupe_hash,
    confidence_score: 78,
    decision_maker_score: input.committee ? 72 : title ? 55 : 30,
    metadata,
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, title")
    .eq("company_id", input.company_id)
    .eq("dedupe_hash", dedupe_hash)
    .maybeSingle()

  if (existing?.id) {
    const hadTitle = Boolean(asString(existing.title))
    if (!hadTitle && title) {
      await admin
        .schema("growth")
        .from("company_contacts")
        .update({ title, metadata, updated_at: new Date().toISOString() })
        .eq("id", asString(existing.id))
      return { contact_id: asString(existing.id), title_created: true }
    }
    return { contact_id: asString(existing.id), title_created: false }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .insert(row)
    .select("id")
    .single()

  if (error || !data) return { contact_id: null, title_created: false }
  return { contact_id: asString(data.id), title_created: Boolean(title) }
}

export async function reconcileBenchmarkProfessionalIdentityEvidence(
  admin: SupabaseClient,
  input: {
    records: BenchmarkProfessionalIdentityEvidenceRecord[]
    cohort: Array<{
      canonical_company_id: string
      company_name: string
      company_candidate_id: string
    }>
  },
): Promise<{
  evidence_records_accepted: number
  evidence_records_rejected: number
  persons_created: number
  titles_created: number
  committee_classifications: BenchmarkProfessionalIdentityCommitteeClassification[]
  companies_enriched: number
  enriched_company_ids: string[]
  rejected: BenchmarkProfessionalIdentityRejectedRecord[]
  messages: string[]
}> {
  const rejected: BenchmarkProfessionalIdentityRejectedRecord[] = []
  const committee_classifications: BenchmarkProfessionalIdentityCommitteeClassification[] = []
  const enrichedCompanies = new Set<string>()
  const companiesWithPersons = new Set<string>()
  let evidence_records_accepted = 0
  let evidence_records_rejected = 0
  let persons_created = 0
  let titles_created = 0
  const messages: string[] = []

  for (const record of input.records) {
    const match = matchExternalRecordToCohortCompany(record, input.cohort)
    if (!match) {
      evidence_records_rejected += 1
      rejected.push({
        person_name: record.person_name,
        company_name: record.company_name,
        source_url: record.source_url,
        reason: "no_cohort_company_match",
      })
      continue
    }

    const evaluation = evaluateBenchmarkProfessionalIdentityCorroboration(record, match)
    if (!evaluation.accepted) {
      evidence_records_rejected += 1
      rejected.push({
        person_name: record.person_name,
        company_name: match.company_name,
        source_url: record.source_url,
        reason: evaluation.reason ?? "rejected",
      })
      continue
    }

    evidence_records_accepted += 1
    const committee = classifyCommitteeFromRecord(record)
    if (committee) committee_classifications.push(committee)

    const upsert = await upsertBenchmarkProfessionalIdentityContact(admin, {
      company_id: match.canonical_company_id,
      record,
      committee,
    })
    if (!upsert.contact_id) continue

    enrichedCompanies.add(match.canonical_company_id)
    companiesWithPersons.add(match.canonical_company_id)
    if (upsert.title_created) titles_created += 1
  }

  for (const company_id of companiesWithPersons) {
    const cohortRow = input.cohort.find((c) => c.canonical_company_id === company_id)
    if (!cohortRow) continue
    const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
      company_candidate_id: cohortRow.company_candidate_id,
      canonical_company_id: company_id,
      mode: "apply",
    })
    persons_created += backfill.persons_linked

    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, canonical_person_id, full_name, title, source_evidence, metadata, updated_at")
      .eq("company_id", company_id)
      .not("title", "is", null)
      .neq("contact_status", "archived")
      .limit(40)

    for (const row of contacts ?? []) {
      const record = row as Record<string, unknown>
      const metadata =
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {}
      if (metadata.qa_marker !== GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PROFESSIONAL_IDENTITY_EXPANSION_QA_MARKER) {
        continue
      }
      const person_id = asString(record.canonical_person_id)
      const title = asString(record.title)
      if (!person_id || !title) continue

      const evidence = collectTitleEvidenceForContact({
        full_name: asString(record.full_name),
        title,
        source_evidence: Array.isArray(record.source_evidence)
          ? (record.source_evidence as Array<{
              claim?: string
              evidence?: string
              source?: string
              page_url?: string | null
            }>)
          : [],
        metadata,
        company_contact_id: asString(record.id),
        person_id,
        company_id,
        observed_at: asString(record.updated_at),
      })
      const best = selectBestTitleEvidence(evidence)
      if (!best) continue
      await enrichPersonCompanyRoleFromTitleEvidence(admin, {
        person_id,
        company_id,
        company_contact_id: asString(record.id),
        evidence: best,
      })
    }
  }

  messages.push(
    `accepted=${evidence_records_accepted} rejected=${evidence_records_rejected} persons=${persons_created} titles=${titles_created}`,
  )

  return {
    evidence_records_accepted,
    evidence_records_rejected,
    persons_created,
    titles_created,
    committee_classifications,
    companies_enriched: enrichedCompanies.size,
    enriched_company_ids: [...enrichedCompanies],
    rejected,
    messages,
  }
}

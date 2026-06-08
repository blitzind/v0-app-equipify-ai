/** Phase 7.PS-IP — Reconcile officer/principal evidence to benchmark persons. Server-only. */

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
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER,
  type BenchmarkOfficerPrincipalEvidenceRecord,
  type BenchmarkOfficerPrincipalRejectedRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-types"
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

export function evaluateOfficerPrincipalCorroboration(
  record: BenchmarkOfficerPrincipalEvidenceRecord,
): { accepted: boolean; reason: string | null } {
  const person_name = asString(record.person_name)
  const title = asString(record.title) || null
  const excerpt = asString(record.evidence_excerpt)
  const source_url = asString(record.source_url)

  if (!person_name) return { accepted: false, reason: "missing_person_name" }
  if (!source_url) return { accepted: false, reason: "missing_source_url" }
  if (!excerpt) return { accepted: false, reason: "missing_evidence_excerpt" }
  if (!record.discovered_at) return { accepted: false, reason: "missing_discovered_at" }
  if (isFalsePositiveEmailLocalPartIdentity(person_name, null)) {
    return { accepted: false, reason: "false_positive_identity_name" }
  }
  if (!personAppearsInExcerpt(excerpt, person_name)) {
    return { accepted: false, reason: "person_name_not_in_excerpt" }
  }
  if (!companyAppearsInExcerpt(excerpt, record.company_name)) {
    return { accepted: false, reason: "company_association_not_in_excerpt" }
  }
  if (!isPlausiblePersonName(person_name)) {
    return { accepted: false, reason: "name_not_plausible" }
  }

  const identity = classifyContactIdentity({
    full_name: person_name,
    title,
    source_type: "public_record",
  })
  if (!identity.eligible_for_canonical_person) {
    return { accepted: false, reason: "not_eligible_for_canonical_person" }
  }

  return { accepted: true, reason: null }
}

function toSourceEvidence(record: BenchmarkOfficerPrincipalEvidenceRecord) {
  return [
    evidenceFromPage({
      claim: `officer_principal_${record.record_kind}:${record.person_name}${record.title ? ` — ${record.title}` : ""}`,
      excerpt: record.evidence_excerpt,
      source: record.source_type,
      page_url: record.source_url,
    }),
  ]
}

async function upsertOfficerPrincipalContact(
  admin: SupabaseClient,
  record: BenchmarkOfficerPrincipalEvidenceRecord,
): Promise<{ contact_id: string | null; title_created: boolean }> {
  const full_name = asString(record.person_name)
  const title = asString(record.title) || null
  const committeeMatch = title ? classifyCommitteeRoleFromJobTitle({ job_title: title }) : null

  const dedupe_hash = companyContactDedupeHash({
    company_id: record.company_id,
    full_name,
    title,
    email: null,
  })

  const metadata: Record<string, unknown> = {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER,
    officer_principal_record_kind: record.record_kind,
    source_type: record.source_type,
    source_url: record.source_url,
    discovered_at: record.discovered_at,
    identity_classification: "named_person",
    eligible_for_canonical_person: true,
    officer_principal_provenance: {
      source_type: record.source_type,
      source_url: record.source_url,
      evidence_excerpt: record.evidence_excerpt,
      discovered_at: record.discovered_at,
    },
  }
  if (committeeMatch) {
    metadata.committee_title_classification = {
      job_title: title,
      committee_role: committeeMatch.committee_role,
      pattern_id: committeeMatch.pattern_id,
      matched_span: committeeMatch.matched_span,
      confidence_tier: "direct_evidence",
      source_url: record.source_url,
      source_type: record.source_type,
    }
  }

  const row = {
    company_id: record.company_id,
    full_name,
    title,
    source_type: "public_record",
    source_evidence: toSourceEvidence(record),
    contact_status: "candidate",
    dedupe_hash,
    confidence_score: committeeMatch ? 82 : 76,
    decision_maker_score: committeeMatch ? 78 : title ? 60 : 35,
    metadata,
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, title")
    .eq("company_id", record.company_id)
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

export async function reconcileBenchmarkOfficerPrincipalEvidence(
  admin: SupabaseClient,
  input: {
    records: BenchmarkOfficerPrincipalEvidenceRecord[]
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
  companies_enriched: number
  enriched_company_ids: string[]
  rejected: BenchmarkOfficerPrincipalRejectedRecord[]
  messages: string[]
}> {
  const rejected: BenchmarkOfficerPrincipalRejectedRecord[] = []
  const enrichedCompanies = new Set<string>()
  const companiesWithPersons = new Set<string>()
  let evidence_records_accepted = 0
  let evidence_records_rejected = 0
  let persons_created = 0
  let titles_created = 0
  const messages: string[] = []
  const cohortIds = new Set(input.cohort.map((c) => c.canonical_company_id))

  for (const record of input.records) {
    if (!cohortIds.has(record.company_id)) {
      evidence_records_rejected += 1
      rejected.push({
        company_id: record.company_id,
        company_name: record.company_name,
        person_name: record.person_name,
        source_url: record.source_url,
        reason: "outside_benchmark_cohort",
      })
      continue
    }

    const evaluation = evaluateOfficerPrincipalCorroboration(record)
    if (!evaluation.accepted) {
      evidence_records_rejected += 1
      rejected.push({
        company_id: record.company_id,
        company_name: record.company_name,
        person_name: record.person_name,
        source_url: record.source_url,
        reason: evaluation.reason ?? "rejected",
      })
      continue
    }

    evidence_records_accepted += 1
    const upsert = await upsertOfficerPrincipalContact(admin, record)
    if (!upsert.contact_id) continue

    enrichedCompanies.add(record.company_id)
    companiesWithPersons.add(record.company_id)
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
      const contact = row as Record<string, unknown>
      const metadata =
        contact.metadata && typeof contact.metadata === "object"
          ? (contact.metadata as Record<string, unknown>)
          : {}
      if (metadata.qa_marker !== GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER) {
        continue
      }
      const person_id = asString(contact.canonical_person_id)
      const title = asString(contact.title)
      if (!person_id || !title) continue

      const evidence = collectTitleEvidenceForContact({
        full_name: asString(contact.full_name),
        title,
        source_evidence: Array.isArray(contact.source_evidence)
          ? (contact.source_evidence as Array<{
              claim?: string
              evidence?: string
              source?: string
              page_url?: string | null
            }>)
          : [],
        metadata,
        company_contact_id: asString(contact.id),
        person_id,
        company_id,
        observed_at: asString(contact.updated_at),
      })
      const best = selectBestTitleEvidence(evidence)
      if (!best) continue
      await enrichPersonCompanyRoleFromTitleEvidence(admin, {
        person_id,
        company_id,
        company_contact_id: asString(contact.id),
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
    companies_enriched: enrichedCompanies.size,
    enriched_company_ids: [...enrichedCompanies],
    rejected,
    messages,
  }
}

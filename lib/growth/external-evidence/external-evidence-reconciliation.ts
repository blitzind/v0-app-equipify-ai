/** Phase 7.PS-HX — Reconcile external evidence to canonical companies/persons. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { companyContactDedupeHash } from "@/lib/growth/contact-discovery/website-contact-discovery"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { toContactSourceEvidence } from "@/lib/growth/external-evidence/external-evidence-extract"
import {
  GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
  type ExternalEvidenceRecord,
} from "@/lib/growth/external-evidence/external-evidence-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
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

export function matchExternalRecordToCohortCompany(
  record: ExternalEvidenceRecord,
  cohort: Array<{ canonical_company_id: string; company_name: string }>,
): { canonical_company_id: string; company_name: string } | null {
  const needle = normalizeCompanyName(record.company_name)
  if (!needle || needle === "unknown") {
    for (const target of cohort) {
      const hay = normalizeCompanyName(target.company_name)
      if (record.evidence_excerpt.toLowerCase().includes(hay)) return target
    }
    return null
  }

  for (const target of cohort) {
    const hay = normalizeCompanyName(target.company_name)
    if (!hay) continue
    if (hay.includes(needle) || needle.includes(hay)) return target
    const tokens = hay.split(" ").filter((t) => t.length > 3)
    if (tokens.length >= 2 && tokens.every((t) => needle.includes(t))) return target
  }
  return null
}

async function upsertExternalEvidenceContact(
  admin: SupabaseClient,
  input: {
    company_id: string
    record: ExternalEvidenceRecord
  },
): Promise<string | null> {
  const full_name = asString(input.record.person_name) || "Unknown"
  const title = asString(input.record.title) || null
  const identity = classifyContactIdentity({
    full_name,
    title,
    source_type: "public_record",
  })
  if (!input.record.person_name && !title) return null

  const dedupe_hash = companyContactDedupeHash({
    company_id: input.company_id,
    full_name,
    title,
    email: null,
  })

  const row = {
    company_id: input.company_id,
    full_name,
    title,
    source_type: "public_record",
    source_evidence: toContactSourceEvidence(input.record),
    contact_status: "candidate",
    dedupe_hash,
    confidence_score: 72,
    decision_maker_score: title ? 55 : 20,
    metadata: {
      qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
      external_source_type: input.record.source_type,
      external_source_url: input.record.source_url,
      identity_classification: identity.classification,
      eligible_for_canonical_person: identity.eligible_for_canonical_person,
    },
  }

  const { data: existing } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id")
    .eq("company_id", input.company_id)
    .eq("dedupe_hash", dedupe_hash)
    .maybeSingle()

  if (existing?.id) return asString(existing.id)

  const { data, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .insert(row)
    .select("id")
    .single()

  if (error || !data) return null
  return asString(data.id)
}

export async function mineLatentTitleEvidenceFromContacts(
  admin: SupabaseClient,
  input: { company_ids: string[] },
): Promise<{
  contacts_scanned: number
  titles_recovered: number
  persons_enriched: number
}> {
  let contacts_scanned = 0
  let titles_recovered = 0
  let persons_enriched = 0

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, title, source_evidence, metadata, updated_at",
    )
    .in("company_id", input.company_ids)
    .neq("contact_status", "archived")
    .limit(240)

  for (const row of contacts ?? []) {
    contacts_scanned += 1
    const record = row as Record<string, unknown>
    const full_name = asString(record.full_name)
    const existingTitle = asString(record.title)
    if (existingTitle) continue

    const identity = classifyContactIdentity({ full_name, title: null })
    if (!identity.eligible_for_canonical_person && !asString(record.canonical_person_id)) continue

    const evidence = collectTitleEvidenceForContact({
      full_name,
      title: null,
      source_evidence: Array.isArray(record.source_evidence)
        ? (record.source_evidence as Array<{
            claim?: string
            evidence?: string
            source?: string
            page_url?: string | null
          }>)
        : [],
      metadata:
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {},
      company_contact_id: asString(record.id),
      person_id: asString(record.canonical_person_id) || null,
      company_id: asString(record.company_id),
      observed_at: asString(record.updated_at),
    })

    const best = selectBestTitleEvidence(evidence)
    if (!best) continue

    titles_recovered += 1
    await admin
      .schema("growth")
      .from("company_contacts")
      .update({
        title: best.title,
        metadata: {
          ...(record.metadata && typeof record.metadata === "object"
            ? (record.metadata as Record<string, unknown>)
            : {}),
          latent_title_recovered: true,
          external_evidence_qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", asString(record.id))

    let person_id = asString(record.canonical_person_id)
    if (!person_id && identity.eligible_for_canonical_person) {
      const { data: refreshed } = await admin
        .schema("growth")
        .from("company_contacts")
        .select("canonical_person_id")
        .eq("id", asString(record.id))
        .maybeSingle()
      person_id = asString(refreshed?.canonical_person_id)
    }
    if (!person_id) continue

    const enrich = await enrichPersonCompanyRoleFromTitleEvidence(admin, {
      person_id,
      company_id: asString(record.company_id),
      company_contact_id: asString(record.id),
      evidence: best,
    })
    if (enrich.enriched) persons_enriched += 1
  }

  return { contacts_scanned, titles_recovered, persons_enriched }
}

async function enrichExternalEvidenceTitlesForCompany(
  admin: SupabaseClient,
  company_id: string,
): Promise<{ titles_enriched: number; persons_enriched: number }> {
  let titles_enriched = 0
  let persons_enriched = 0

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, canonical_person_id, full_name, title, source_evidence, metadata, updated_at")
    .eq("company_id", company_id)
    .not("title", "is", null)
    .neq("contact_status", "archived")
    .limit(80)

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}
    if (metadata.qa_marker !== GROWTH_EXTERNAL_EVIDENCE_QA_MARKER) continue

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

    titles_enriched += 1
    const enrich = await enrichPersonCompanyRoleFromTitleEvidence(admin, {
      person_id,
      company_id,
      company_contact_id: asString(record.id),
      evidence: best,
    })
    if (enrich.enriched) persons_enriched += 1
  }

  return { titles_enriched, persons_enriched }
}

export async function reconcileExternalEvidenceRecords(
  admin: SupabaseClient,
  input: {
    records: ExternalEvidenceRecord[]
    cohort: Array<{
      canonical_company_id: string
      company_name: string
      company_candidate_id: string
    }>
  },
): Promise<{
  companies_enriched: number
  names_discovered: number
  titles_discovered: number
  persons_materialized: number
  persons_enriched: number
  matched_records: number
}> {
  const enrichedCompanies = new Set<string>()
  const companiesWithNamedEvidence = new Set<string>()
  let names_discovered = 0
  let titles_discovered = 0
  let persons_materialized = 0
  let persons_enriched = 0
  let matched_records = 0

  for (const record of input.records) {
    const match = matchExternalRecordToCohortCompany(record, input.cohort)
    if (!match) continue
    matched_records += 1

    if (record.person_name) names_discovered += 1
    if (record.title) titles_discovered += 1

    const contactId = await upsertExternalEvidenceContact(admin, {
      company_id: match.canonical_company_id,
      record,
    })
    if (!contactId) continue

    enrichedCompanies.add(match.canonical_company_id)
    if (record.person_name) companiesWithNamedEvidence.add(match.canonical_company_id)
  }

  for (const company_id of enrichedCompanies) {
    const cohortRow = input.cohort.find((c) => c.canonical_company_id === company_id)
    if (!cohortRow) continue

    if (companiesWithNamedEvidence.has(company_id)) {
      const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
        company_candidate_id: cohortRow.company_candidate_id,
        canonical_company_id: company_id,
        mode: "apply",
      })
      persons_materialized += backfill.persons_linked
    }

    const titleEnrich = await enrichExternalEvidenceTitlesForCompany(admin, company_id)
    persons_enriched += titleEnrich.persons_enriched
  }

  return {
    companies_enriched: enrichedCompanies.size,
    names_discovered,
    titles_discovered,
    persons_materialized,
    persons_enriched,
    matched_records,
  }
}

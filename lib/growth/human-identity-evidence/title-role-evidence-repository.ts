/** Phase 7.PS-HW — Role evidence repository persistence. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertCanonicalPersonCompanyRole } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import {
  GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
  type TitleRoleEvidenceRecord,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function appendCompanyRoleEvidenceRepository(
  admin: SupabaseClient,
  input: { company_id: string; records: TitleRoleEvidenceRecord[] },
): Promise<number> {
  if (!input.company_id || input.records.length === 0) return 0

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("metadata")
    .eq("id", input.company_id)
    .maybeSingle()

  const metadata =
    company?.metadata && typeof company.metadata === "object"
      ? ({ ...(company.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const existing = Array.isArray(metadata.role_evidence_repository)
    ? (metadata.role_evidence_repository as TitleRoleEvidenceRecord[])
    : []

  const seen = new Set(
    existing.map((row) => `${row.person_id ?? ""}:${row.title.toLowerCase()}:${row.source_url ?? ""}`),
  )
  let added = 0
  for (const record of input.records) {
    const key = `${record.person_id ?? ""}:${record.title.toLowerCase()}:${record.source_url ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    existing.push(record)
    added += 1
  }

  if (added === 0) return 0

  await admin
    .schema("growth")
    .from("companies")
    .update({
      metadata: {
        ...metadata,
        role_evidence_repository: existing,
        title_role_evidence_qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
        title_role_evidence_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.company_id)

  return added
}

export async function enrichPersonCompanyRoleFromTitleEvidence(
  admin: SupabaseClient,
  input: {
    person_id: string
    company_id: string
    company_contact_id: string
    evidence: TitleRoleEvidenceRecord
  },
): Promise<{ enriched: boolean; created: boolean }> {
  const person_id = asString(input.person_id)
  const company_id = asString(input.company_id)
  const title = asString(input.evidence.title)
  if (!person_id || !company_id || !title) return { enriched: false, created: false }

  const { data: existing } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id, title, metadata")
    .eq("person_id", person_id)
    .eq("company_id", company_id)
    .limit(20)

  const rows = existing ?? []
  const hasSameTitle = rows.some((row) => asString(row.title).toLowerCase() === title.toLowerCase())
  const emptyTitleRow = rows.find((row) => !asString(row.title))

  const roleMetadata = {
    title_evidence: [input.evidence],
    title_role_evidence_qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
    title_evidence_source: input.evidence.source,
    title_evidence_url: input.evidence.source_url,
    title_evidence_observed_at: input.evidence.observed_at,
    provenance_company_contact_id: input.company_contact_id,
  }

  if (hasSameTitle) {
    const match = rows.find((row) => asString(row.title).toLowerCase() === title.toLowerCase())
    const priorMeta =
      match?.metadata && typeof match.metadata === "object"
        ? (match.metadata as Record<string, unknown>)
        : {}
    const priorEvidence = Array.isArray(priorMeta.title_evidence)
      ? (priorMeta.title_evidence as TitleRoleEvidenceRecord[])
      : []
    await admin
      .schema("growth")
      .from("person_company_roles")
      .update({
        metadata: {
          ...priorMeta,
          ...roleMetadata,
          title_evidence: [...priorEvidence, input.evidence],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", asString(match?.id))
    return { enriched: true, created: false }
  }

  if (emptyTitleRow) {
    const priorMeta =
      emptyTitleRow.metadata && typeof emptyTitleRow.metadata === "object"
        ? (emptyTitleRow.metadata as Record<string, unknown>)
        : {}
    await admin
      .schema("growth")
      .from("person_company_roles")
      .update({
        title,
        metadata: { ...priorMeta, ...roleMetadata },
        discovery_source: input.evidence.source,
        provider_name: input.evidence.source,
        observed_at: input.evidence.observed_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asString(emptyTitleRow.id))
    return { enriched: true, created: false }
  }

  await upsertCanonicalPersonCompanyRole(admin, {
    person_id,
    company_id,
    title,
    department: null,
    seniority: null,
    role_type: "unknown",
    is_primary: rows.length === 0,
    confidence: 0.82,
    source_table: "company_contacts",
    source_id: input.company_contact_id,
    provider_name: input.evidence.source,
    discovery_source: input.evidence.source,
    observed_at: input.evidence.observed_at,
    metadata: roleMetadata,
  })

  const { data: contactRow } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("metadata")
    .eq("id", input.company_contact_id)
    .maybeSingle()
  const contactMeta =
    contactRow?.metadata && typeof contactRow.metadata === "object"
      ? (contactRow.metadata as Record<string, unknown>)
      : {}

  await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      title,
      metadata: {
        ...contactMeta,
        title_role_evidence_qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
        title_enriched_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.company_contact_id)

  return { enriched: true, created: true }
}

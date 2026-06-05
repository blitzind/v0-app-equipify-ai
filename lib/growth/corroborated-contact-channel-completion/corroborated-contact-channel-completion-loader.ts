/** Phase 7.PS-HZ — Load PS-HY corroborated persons for channel completion. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import type { CorroboratedPersonTarget } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-types"
import {
  GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
  type ProfessionalIdentityCorroborationSignal,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readCorroborationSignals(
  metadata: Record<string, unknown> | null | undefined,
): ProfessionalIdentityCorroborationSignal[] {
  if (!metadata || !Array.isArray(metadata.professional_identity_corroboration)) return []
  return (metadata.professional_identity_corroboration as ProfessionalIdentityCorroborationSignal[]).filter(
    (row) => row?.qa_marker === GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
  )
}

export async function loadCorroboratedPersonTargets(
  admin: SupabaseClient,
  cohort: PersonCommitteeDensityCohortCompany[],
): Promise<CorroboratedPersonTarget[]> {
  const companyIds = cohort.map((c) => c.canonical_company_id)
  if (companyIds.length === 0) return []

  const cohortByCompany = new Map(cohort.map((c) => [c.canonical_company_id, c]))

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, company_id, canonical_person_id, full_name")
    .in("company_id", companyIds)
    .not("canonical_person_id", "is", null)
    .neq("contact_status", "archived")
    .limit(160)

  const personIds = [
    ...new Set(
      (contacts ?? [])
        .map((row) => asString((row as Record<string, unknown>).canonical_person_id))
        .filter(Boolean),
    ),
  ]
  if (personIds.length === 0) return []

  const { data: persons } = await admin
    .schema("growth")
    .from("persons")
    .select("id, full_name, metadata")
    .in("id", personIds)

  const corroborationByPerson = new Map<string, ProfessionalIdentityCorroborationSignal[]>()
  for (const row of persons ?? []) {
    const record = row as Record<string, unknown>
    const person_id = asString(record.id)
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}
    const signals = readCorroborationSignals(metadata)
    if (signals.length > 0) corroborationByPerson.set(person_id, signals)
  }

  const targets: CorroboratedPersonTarget[] = []
  const seen = new Set<string>()

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const person_id = asString(record.canonical_person_id)
    const company_id = asString(record.company_id)
    if (!person_id || !company_id) continue

    const signals = corroborationByPerson.get(person_id)
    if (!signals || signals.length === 0) continue

    const key = `${person_id}:${company_id}`
    if (seen.has(key)) continue
    seen.add(key)

    const cohortRow = cohortByCompany.get(company_id)
    if (!cohortRow) continue

    targets.push({
      person_id,
      company_id,
      company_name: cohortRow.company_name,
      company_contact_id: asString(record.id),
      full_name: asString(record.full_name) || asString(persons?.find((p) => asString((p as Record<string, unknown>).id) === person_id)?.full_name),
      corroboration_signals: signals,
      corroboration_signal_count: signals.length,
    })
  }

  return targets
}

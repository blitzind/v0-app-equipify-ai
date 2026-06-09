/** LE-1 sequence-ready contact validation from Apollo live pilot evidence — client-safe. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const LE_1_SEQUENCE_READY_CONTACT_QA_MARKER = "le-1-sequence-ready-contact-v1" as const

export type Le1SequenceReadyContactCheck = {
  id: string
  satisfied: boolean
  detail: string
}

export type Le1SequenceReadyContactValidation = {
  qa_marker: typeof LE_1_SEQUENCE_READY_CONTACT_QA_MARKER
  company_candidate_id: string
  company_name: string
  sequence_ready_count: number
  selected_contact: {
    company_candidate_id: string
    canonical_person_ids: string[]
    candidate_ids: string[]
    company_contact_ids: string[]
  } | null
  checks: Le1SequenceReadyContactCheck[]
  path_valid: boolean
  failures: string[]
  summary: string
}

export function validateLe1SequenceReadyContactPath(
  evidence: ApolloLivePilotEvidence,
): Le1SequenceReadyContactValidation {
  const f = evidence.readiness_funnel
  const rp = evidence.research_pipeline
  const cm = evidence.canonical_matching
  const cq = evidence.contact_quality
  const ids = evidence.contact_ids

  const checks: Le1SequenceReadyContactCheck[] = [
    {
      id: "imported",
      satisfied: f.imported >= 1,
      detail: `${f.imported} contact(s) imported`,
    },
    {
      id: "canonical.company",
      satisfied: cm.company.matched + cm.company.created > 0,
      detail: `Company matched=${cm.company.matched} created=${cm.company.created}`,
    },
    {
      id: "canonical.person",
      satisfied: cm.person.matched + cm.person.created + cm.person.deduped >= 1,
      detail: `Person matched=${cm.person.matched} created=${cm.person.created} deduped=${cm.person.deduped}`,
    },
    {
      id: "research.complete",
      satisfied: f.research_complete >= 1 && rp.company_intelligence_present && rp.automated_flow_confirmed,
      detail: rp.automated_flow_confirmed
        ? "Research pipeline automated flow confirmed"
        : "Research automation not confirmed",
    },
    {
      id: "scoring.available",
      satisfied: f.score_available >= 1 && rp.fit_score_present,
      detail: rp.fit_score_present ? `${f.score_available} scored` : "Fit score not present",
    },
    {
      id: "contactability",
      satisfied: f.contactable >= 1 && (cq.with_email > 0 || cq.with_phone > 0),
      detail: `${f.contactable} contactable; email=${cq.with_email} phone=${cq.with_phone}`,
    },
    {
      id: "compliance.eligible",
      satisfied: f.contactable >= f.sequence_ready,
      detail: "Contactable cohort includes sequence-ready contacts",
    },
    {
      id: "sequence_ready",
      satisfied: f.sequence_ready >= 1,
      detail: `${f.sequence_ready} sequence-ready contact(s)`,
    },
  ]

  const failures = checks.filter((c) => !c.satisfied).map((c) => `${c.id}: ${c.detail}`)
  const path_valid = f.sequence_ready >= 1 && checks.every((c) => c.satisfied)

  const selected_contact =
    f.sequence_ready >= 1
      ? {
          company_candidate_id: evidence.company.company_candidate_id,
          canonical_person_ids: ids?.canonical_person_ids ?? [],
          candidate_ids: ids?.candidate_ids ?? [],
          company_contact_ids: ids?.company_contact_ids ?? [],
        }
      : null

  const summary = path_valid
    ? `One sequence-ready contact path validated for ${evidence.company.company_name}.`
    : f.imported > 0
      ? `Imported ${f.imported} but sequence-ready path incomplete — ${failures.length} check(s) failed.`
      : "No imported contacts — cannot validate lead path."

  return {
    qa_marker: LE_1_SEQUENCE_READY_CONTACT_QA_MARKER,
    company_candidate_id: evidence.company.company_candidate_id,
    company_name: evidence.company.company_name,
    sequence_ready_count: f.sequence_ready,
    selected_contact,
    checks,
    path_valid,
    failures,
    summary,
  }
}

/** Apollo AI-5 end-to-end pipeline validation — client-safe, evidence only. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_PIPELINE_E2E_VALIDATION_QA_MARKER = "apollo-pipeline-e2e-validation-ai-5-v1" as const

export type ApolloPipelineE2EStage =
  | "imported"
  | "canonical"
  | "research"
  | "scored"
  | "contactable"
  | "sequence_ready"

export type ApolloPipelineE2EStageMetric = {
  stage: ApolloPipelineE2EStage
  count: number
  dropped_from_prior: number
  conversion_from_imported_pct: number
  fallout_reasons: string[]
}

export type ApolloPipelineE2EValidation = {
  qa_marker: typeof APOLLO_PIPELINE_E2E_VALIDATION_QA_MARKER
  company: ApolloLivePilotEvidence["company"]
  stages: ApolloPipelineE2EStageMetric[]
  counts: Record<ApolloPipelineE2EStage, number>
  funnel_integrity_ok: boolean
  integrity_errors: string[]
  summary: string
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 1000) / 10
}

function canonicalLinkedCount(evidence: ApolloLivePilotEvidence): number {
  const { person } = evidence.canonical_matching
  const linked = person.matched + person.created + person.deduped
  return Math.min(evidence.readiness_funnel.imported, linked)
}

function validateMonotonic(counts: Record<ApolloPipelineE2EStage, number>): string[] {
  const order: ApolloPipelineE2EStage[] = [
    "imported",
    "canonical",
    "research",
    "scored",
    "contactable",
    "sequence_ready",
  ]
  const errors: string[] = []
  for (let i = 1; i < order.length; i++) {
    const prior = counts[order[i - 1]!]
    const current = counts[order[i]!]
    if (current > prior) {
      errors.push(`${order[i]} (${current}) exceeds ${order[i - 1]} (${prior})`)
    }
  }
  return errors
}

export function validateApolloPipelineE2E(evidence: ApolloLivePilotEvidence): ApolloPipelineE2EValidation {
  const f = evidence.readiness_funnel
  const rp = evidence.research_pipeline
  const canonical = canonicalLinkedCount(evidence)

  const counts: Record<ApolloPipelineE2EStage, number> = {
    imported: f.imported,
    canonical,
    research: f.research_complete,
    scored: f.score_available,
    contactable: f.contactable,
    sequence_ready: f.sequence_ready,
  }

  const integrity_errors = validateMonotonic(counts)
  if (canonical === 0 && f.imported > 0) {
    integrity_errors.push("Zero canonical person linkage despite imported contacts")
  }
  if (f.imported > 0 && !rp.automated_flow_confirmed) {
    integrity_errors.push("Research automation not confirmed for imported cohort")
  }

  const stages: ApolloPipelineE2EStageMetric[] = [
    {
      stage: "imported",
      count: counts.imported,
      dropped_from_prior: 0,
      conversion_from_imported_pct: counts.imported > 0 ? 100 : 0,
      fallout_reasons: [],
    },
    {
      stage: "canonical",
      count: counts.canonical,
      dropped_from_prior: counts.imported - counts.canonical,
      conversion_from_imported_pct: pct(counts.canonical, counts.imported),
      fallout_reasons:
        counts.imported - counts.canonical > 0
          ? [
              `${evidence.canonical_matching.person.rejected} person(s) rejected by canonical matcher`,
              evidence.canonical_matching.company.rejected > 0
                ? "Company canonical linkage rejected"
                : "",
            ].filter(Boolean)
          : ["All imported contacts linked to canonical persons"],
    },
    {
      stage: "research",
      count: counts.research,
      dropped_from_prior: counts.canonical - counts.research,
      conversion_from_imported_pct: pct(counts.research, counts.imported),
      fallout_reasons:
        counts.canonical - counts.research > 0
          ? [
              !rp.company_intelligence_present ? "Company intelligence missing" : "",
              !rp.buying_committee_present ? "Buying committee not populated" : "",
              "Lead engine research incomplete",
            ].filter(Boolean)
          : ["Research pipeline complete for canonical cohort"],
    },
    {
      stage: "scored",
      count: counts.scored,
      dropped_from_prior: counts.research - counts.scored,
      conversion_from_imported_pct: pct(counts.scored, counts.imported),
      fallout_reasons:
        counts.research - counts.scored > 0
          ? [
              !rp.fit_score_present ? "Fit score not available" : "",
              "Score below pipeline threshold or lead not promoted",
            ].filter(Boolean)
          : ["Fit scores available"],
    },
    {
      stage: "contactable",
      count: counts.contactable,
      dropped_from_prior: counts.scored - counts.contactable,
      conversion_from_imported_pct: pct(counts.contactable, counts.imported),
      fallout_reasons:
        counts.scored - counts.contactable > 0
          ? [
              evidence.contact_quality.with_email === 0 && evidence.contact_quality.with_phone === 0
                ? "No email or phone on mapped contacts"
                : "Channel eligibility or compliance block",
            ]
          : ["Contacts have eligible outreach channel"],
    },
    {
      stage: "sequence_ready",
      count: counts.sequence_ready,
      dropped_from_prior: counts.contactable - counts.sequence_ready,
      conversion_from_imported_pct: pct(counts.sequence_ready, counts.imported),
      fallout_reasons:
        counts.contactable - counts.sequence_ready > 0
          ? [
              !rp.next_best_action_present ? "Next best action not generated" : "",
              "Sequence readiness gate not met (coverage, suppression, manual review)",
            ].filter(Boolean)
          : ["Contactable cohort meets sequence readiness"],
    },
  ]

  const funnel_integrity_ok = integrity_errors.length === 0 && counts.imported >= 0

  const summary =
    counts.sequence_ready > 0
      ? `${counts.sequence_ready}/${counts.imported} contacts reached sequence-ready (${pct(counts.sequence_ready, counts.imported)}% of imported).`
      : counts.imported > 0
        ? `Pipeline validated with zero sequence-ready — primary fallout at ${stages.find((s) => s.dropped_from_prior > 0)?.stage ?? "canonical"}.`
        : "No contacts imported — pipeline empty."

  return {
    qa_marker: APOLLO_PIPELINE_E2E_VALIDATION_QA_MARKER,
    company: evidence.company,
    stages,
    counts,
    funnel_integrity_ok,
    integrity_errors,
    summary,
  }
}

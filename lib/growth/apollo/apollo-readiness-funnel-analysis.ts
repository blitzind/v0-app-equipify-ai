/** Apollo AI-3 readiness funnel fallout analysis — client-safe. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"

export const APOLLO_READINESS_FUNNEL_ANALYSIS_QA_MARKER = "apollo-readiness-funnel-analysis-ai-3-v1" as const

export type ApolloReadinessFunnelStage =
  | "imported"
  | "research_complete"
  | "score_available"
  | "contactable"
  | "sequence_ready"

export type ApolloReadinessFunnelFallout = {
  stage: ApolloReadinessFunnelStage
  count: number
  dropped_from_prior: number
  likely_reasons: string[]
}

export type ApolloReadinessFunnelAnalysis = {
  qa_marker: typeof APOLLO_READINESS_FUNNEL_ANALYSIS_QA_MARKER
  counts: ApolloLivePilotEvidence["readiness_funnel"]
  stages: ApolloReadinessFunnelFallout[]
  conversion_rates: {
    imported_to_sequence_ready: number
    contactable_to_sequence_ready: number
  }
  summary: string
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 1000) / 10
}

export function analyzeApolloReadinessFunnel(
  evidence: ApolloLivePilotEvidence,
): ApolloReadinessFunnelAnalysis {
  const f = evidence.readiness_funnel
  const rp = evidence.research_pipeline
  const cq = evidence.contact_quality

  const stages: ApolloReadinessFunnelFallout[] = [
    {
      stage: "imported",
      count: f.imported,
      dropped_from_prior: 0,
      likely_reasons: [],
    },
    {
      stage: "research_complete",
      count: f.research_complete,
      dropped_from_prior: f.imported - f.research_complete,
      likely_reasons:
        f.imported - f.research_complete > 0
          ? [
              !rp.company_intelligence_present ? "Company intelligence not yet populated" : "",
              evidence.canonical_matching.person.created + evidence.canonical_matching.person.matched === 0
                ? "Canonical person linkage incomplete"
                : "",
              "Lead engine research may still be running",
            ].filter(Boolean)
          : ["All imported contacts reached research-complete criteria"],
    },
    {
      stage: "score_available",
      count: f.score_available,
      dropped_from_prior: f.research_complete - f.score_available,
      likely_reasons:
        f.research_complete - f.score_available > 0
          ? [
              !rp.fit_score_present ? "Fit scoring job not completed" : "",
              "Lead not promoted or score below pipeline threshold",
            ].filter(Boolean)
          : ["Fit scores available for research-complete cohort"],
    },
    {
      stage: "contactable",
      count: f.contactable,
      dropped_from_prior: f.score_available - f.contactable,
      likely_reasons:
        f.score_available - f.contactable > 0
          ? [
              cq.with_email === 0 && cq.with_phone === 0
                ? "No eligible email or phone channel"
                : "Channel eligibility or compliance block on contact",
            ]
          : ["Contacts have eligible outreach channel"],
    },
    {
      stage: "sequence_ready",
      count: f.sequence_ready,
      dropped_from_prior: f.contactable - f.sequence_ready,
      likely_reasons:
        f.contactable - f.sequence_ready > 0
          ? [
              "Sequence readiness gate not met (coverage, suppression, or manual review)",
              !rp.next_best_action_present ? "Next best action not generated" : "",
              "Insufficient committee completeness or stale contact data",
            ].filter(Boolean)
          : ["Contactable cohort meets sequence readiness"],
    },
  ]

  const conversion = {
    imported_to_sequence_ready: pct(f.sequence_ready, f.imported),
    contactable_to_sequence_ready: pct(f.sequence_ready, f.contactable),
  }

  const summary =
    f.sequence_ready > 0
      ? `${f.sequence_ready}/${f.imported} imported contacts sequence-ready (${conversion.imported_to_sequence_ready}%).`
      : f.imported > 0
        ? `No sequence-ready contacts — primary fallout at ${stages.find((s) => s.dropped_from_prior > 0)?.stage ?? "imported"}.`
        : "No contacts imported — Apollo search or sync produced zero rows."

  return {
    qa_marker: APOLLO_READINESS_FUNNEL_ANALYSIS_QA_MARKER,
    counts: f,
    stages,
    conversion_rates: conversion,
    summary,
  }
}

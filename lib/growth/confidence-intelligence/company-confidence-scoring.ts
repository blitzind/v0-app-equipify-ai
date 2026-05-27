/** Deterministic company confidence scoring. Client-safe. */

import type { GrowthCompanyConfidenceScore } from "@/lib/growth/confidence-intelligence/confidence-intelligence-types"

export type CompanyConfidenceInput = {
  company_id: string
  discovery_confidence?: number | null
  contact_confidence?: number | null
  signal_confidence?: number | null
  coverage_confidence?: number | null
  freshness_confidence?: number | null
  evidence?: Array<{ dimension: string; score: number; excerpt: string }>
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeCompanyConfidenceScore(input: CompanyConfidenceInput): GrowthCompanyConfidenceScore {
  const discovery = clampScore(input.discovery_confidence ?? 0)
  const contact = clampScore(input.contact_confidence ?? 0)
  const signal = clampScore(input.signal_confidence ?? 0)
  const coverage = clampScore(input.coverage_confidence ?? 0)
  const freshness = clampScore(input.freshness_confidence ?? 0)

  const overall = clampScore(
    discovery * 0.2 + contact * 0.25 + signal * 0.2 + coverage * 0.2 + freshness * 0.15,
  )

  const evidence = input.evidence?.length
    ? input.evidence.filter((entry) => entry.excerpt.trim().length > 0)
    : [
        discovery > 0 ? { dimension: "discovery", score: discovery, excerpt: "Discovery source confidence recorded" } : null,
        contact > 0 ? { dimension: "contact", score: contact, excerpt: "Contact evidence confidence recorded" } : null,
        signal > 0 ? { dimension: "signal", score: signal, excerpt: "Growth signal confidence recorded" } : null,
        coverage > 0 ? { dimension: "coverage", score: coverage, excerpt: "Coverage/committee confidence recorded" } : null,
        freshness > 0 ? { dimension: "freshness", score: freshness, excerpt: "Freshness from last verified timestamps" } : null,
      ].filter(Boolean) as GrowthCompanyConfidenceScore["evidence"]

  return {
    company_id: input.company_id,
    discovery_confidence: discovery,
    contact_confidence: contact,
    signal_confidence: signal,
    coverage_confidence: coverage,
    freshness_confidence: freshness,
    overall_confidence: overall,
    evidence,
    last_computed_at: new Date().toISOString(),
  }
}

export function freshnessConfidenceFromAgeDays(ageDays: number | null | undefined): number {
  if (ageDays == null || !Number.isFinite(ageDays)) return 0
  if (ageDays <= 7) return 96
  if (ageDays <= 30) return 85
  if (ageDays <= 90) return 70
  if (ageDays <= 180) return 50
  return 30
}

/** Apollo AI-5 quality benchmark report — client-safe. */

import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  scoreApolloContactQuality,
  type ApolloContactQualityScore,
} from "@/lib/growth/apollo/apollo-contact-quality-score"

export const APOLLO_QUALITY_BENCHMARK_QA_MARKER = "apollo-quality-benchmark-ai-5-v1" as const

export type ApolloQualityBenchmarkReport = {
  qa_marker: typeof APOLLO_QUALITY_BENCHMARK_QA_MARKER
  cohort_size: number
  metrics: {
    decision_maker_pct: number
    executive_pct: number
    manager_pct: number
    contactability_pct: number
    sequence_ready_pct: number
    email_pct: number
    verified_email_pct: number
    phone_pct: number
  }
  quality: ApolloContactQualityScore
  benchmark_grade: "strong" | "acceptable" | "weak" | "insufficient_data"
  findings: string[]
  summary: string
}

function safeRate(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.round((n / d) * 1000) / 10
}

export function buildApolloQualityBenchmarkReport(
  evidence: ApolloLivePilotEvidence,
): ApolloQualityBenchmarkReport {
  const quality = scoreApolloContactQuality(evidence)
  const mapped = Math.max(evidence.discovery.contacts_mapped, 0)
  const managers = quality.breakdown.managers

  const metrics = {
    decision_maker_pct: quality.rates.decision_maker_rate,
    executive_pct: quality.rates.executive_rate,
    manager_pct: safeRate(managers, mapped),
    contactability_pct: quality.rates.contactability_rate,
    sequence_ready_pct: safeRate(evidence.readiness_funnel.sequence_ready, mapped),
    email_pct: quality.rates.email_rate,
    verified_email_pct: quality.rates.verified_email_rate,
    phone_pct: quality.rates.phone_rate,
  }

  const findings = [...quality.findings]
  if (metrics.sequence_ready_pct < 20 && mapped > 0) {
    findings.push(`Sequence-ready rate ${metrics.sequence_ready_pct}% below 20% target for controlled rollout.`)
  }
  if (metrics.decision_maker_pct < 50 && mapped > 0) {
    findings.push(`Decision-maker rate ${metrics.decision_maker_pct}% below 50% ICP target.`)
  }

  let benchmark_grade: ApolloQualityBenchmarkReport["benchmark_grade"] = "insufficient_data"
  if (mapped > 0) {
    if (quality.composite_score >= 65 && metrics.sequence_ready_pct >= 20) {
      benchmark_grade = "strong"
    } else if (quality.composite_score >= 45) {
      benchmark_grade = "acceptable"
    } else {
      benchmark_grade = "weak"
    }
  }

  const summary =
    mapped === 0
      ? "No mapped contacts — quality benchmark unavailable."
      : `Apollo quality benchmark: ${metrics.decision_maker_pct}% decision makers, ${metrics.executive_pct}% executives, ${metrics.manager_pct}% managers, ${metrics.contactability_pct}% contactable, ${metrics.sequence_ready_pct}% sequence-ready (composite ${quality.composite_score}/100).`

  return {
    qa_marker: APOLLO_QUALITY_BENCHMARK_QA_MARKER,
    cohort_size: mapped,
    metrics,
    quality,
    benchmark_grade,
    findings,
    summary,
  }
}

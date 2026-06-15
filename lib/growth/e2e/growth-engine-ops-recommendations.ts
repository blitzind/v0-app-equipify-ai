/** Phase GE-OPS-1 — Operational recommendations generator (client-safe). */

import type {
  ApolloReadinessReport,
  DatasetCertificationResult,
  OpsFinding,
} from "@/lib/growth/e2e/growth-engine-ops-types"

export function generateOperationalRecommendations(input: {
  apollo: ApolloReadinessReport
  dataset: DatasetCertificationResult[]
  findings: OpsFinding[]
  production_fetch_slow?: boolean
}): string[] {
  const recs = [...input.apollo.recommendations]

  for (const tier of input.dataset.filter((d) => !d.pass)) {
    recs.push(
      `Dataset tier ${tier.tier}: workspace ${tier.workspace_aggregation_ms}ms exceeded threshold — consider pagination and lazy section loading.`,
    )
  }

  for (const finding of input.findings.filter((f) => f.severity === "critical")) {
    recs.push(`[${finding.category}] ${finding.description} — ${finding.remediation}`)
  }

  if (input.production_fetch_slow) {
    recs.push("Production Command Center fetch >20s — cache workspace snapshots with realtime invalidation.")
  }

  if (!input.apollo.ready_for_live_search && !input.apollo.mock_mode) {
    recs.push("Apollo not ready for live search — complete env configuration before Equipify sales dogfooding.")
  }

  if (input.apollo.mock_mode) {
    recs.push("Apollo mock mode active — certification validates workflow only; enable live key for real import dogfooding.")
  }

  recs.push("Human-supervised campaigns only: all outreach requires explicit operator approval.")
  recs.push("Monitor credit usage via apollo-run-guardrails snapshots before each import batch.")

  return [...new Set(recs)]
}

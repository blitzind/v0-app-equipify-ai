/** Deliverability dashboard aggregation. Client-safe. */

import {
  GROWTH_DNS_DELIVERABILITY_QA_MARKER,
  type GrowthDeliverabilityDashboard,
  type GrowthDeliverabilityDomainRow,
} from "@/lib/growth/deliverability/deliverability-types"

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

export function aggregateTopRecommendations(
  rows: GrowthDeliverabilityDomainRow[],
  limit = 5,
): Array<{ recommendation: string; count: number }> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const recommendation of row.recommendations) {
      counts.set(recommendation, (counts.get(recommendation) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([recommendation, count]) => ({ recommendation, count }))
    .sort((a, b) => b.count - a.count || a.recommendation.localeCompare(b.recommendation))
    .slice(0, limit)
}

export function buildDeliverabilityDashboard(rows: GrowthDeliverabilityDomainRow[]): GrowthDeliverabilityDashboard {
  const healthy_count = rows.filter((row) => row.health_tier === "healthy").length
  const warning_count = rows.filter((row) => row.health_tier === "warning" || row.health_tier === "degraded").length
  const critical_count = rows.filter((row) => row.health_tier === "critical").length

  const average_score =
    rows.length > 0
      ? Math.round(rows.reduce((sum, row) => sum + row.deliverability_score, 0) / rows.length)
      : 0

  const spf_coverage_percent = percent(rows.filter((row) => row.spf_present && row.spf_valid).length, rows.length)
  const dkim_coverage_percent = percent(rows.filter((row) => row.dkim_present && row.dkim_valid).length, rows.length)
  const dmarc_coverage_percent = percent(
    rows.filter((row) => row.dmarc_present && row.dmarc_valid).length,
    rows.length,
  )
  const mx_coverage_percent = percent(rows.filter((row) => row.mx_present && row.mx_valid).length, rows.length)

  return {
    qa_marker: GROWTH_DNS_DELIVERABILITY_QA_MARKER,
    healthy_count,
    warning_count,
    critical_count,
    average_score,
    spf_coverage_percent,
    dkim_coverage_percent,
    dmarc_coverage_percent,
    mx_coverage_percent,
    top_recommendations: aggregateTopRecommendations(rows),
  }
}

export function collectTopIssues(rows: GrowthDeliverabilityDomainRow[], limit = 5): string[] {
  const issues: string[] = []
  for (const row of rows) {
    if (!row.spf_present || !row.spf_valid) issues.push(`${row.domain}: SPF missing`)
    if (!row.dkim_present || !row.dkim_valid) issues.push(`${row.domain}: DKIM missing`)
    if (!row.dmarc_present || !row.dmarc_valid) issues.push(`${row.domain}: DMARC missing`)
    if (!row.mx_present || !row.mx_valid) issues.push(`${row.domain}: MX invalid`)
  }
  return issues.slice(0, limit)
}

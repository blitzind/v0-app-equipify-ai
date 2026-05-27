"use client"

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function formatBuyingStage(stage: string): string {
  return stage.replace(/_/g, " ")
}

export function CompanyQualificationMetrics({ row }: { row: GrowthProspectSearchCompanyResult }) {
  const leadScore = row.lead_engine_score ?? row.lead_score
  const leadScoreLabel =
    row.lead_engine_score != null && row.lead_engine_score_label
      ? `${leadScore} · ${row.lead_engine_score_label}`
      : leadScore

  const metrics: Array<{ label: string; value: string | number }> = []

  if (leadScore != null) {
    metrics.push({ label: "Lead Score", value: leadScoreLabel ?? leadScore })
  }
  if (row.intent_score != null) {
    metrics.push({ label: "Intent", value: row.intent_score })
  }
  if (row.buying_stage) {
    metrics.push({ label: "Buying Stage", value: formatBuyingStage(row.buying_stage) })
  }
  if (row.company_match_confidence != null) {
    metrics.push({
      label: "Company Match",
      value: `${Math.round(row.company_match_confidence * 100)}%`,
    })
  }

  if (metrics.length === 0) return null

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))` }}
    >
      {metrics.map((metric) => (
        <MetricPill key={metric.label} label={metric.label} value={metric.value} />
      ))}
    </div>
  )
}

export function CompanyQualificationExplanation({ row }: { row: GrowthProspectSearchCompanyResult }) {
  const explanation =
    row.lead_engine_score_explanation ??
    (row.buying_stage_reason ? row.buying_stage_reason : null)

  if (!explanation) return null

  return (
    <p className="text-xs text-muted-foreground line-clamp-2" title={explanation}>
      {explanation}
    </p>
  )
}

"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthPersonalizationLeadSummary } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"

type Props = {
  summary: GrowthPersonalizationLeadSummary
  compact?: boolean
}

export function GrowthPersonalizationStageCard({ summary, compact = false }: Props) {
  const rows = [
    summary.buyingStageLabel ? { label: "Buying Stage", value: summary.buyingStageLabel } : null,
    summary.nextNarrativeLabel ? { label: "Recommended Narrative", value: summary.nextNarrativeLabel } : null,
    summary.recommendedProofLabel ? { label: "Recommended Proof", value: summary.recommendedProofLabel } : null,
    summary.recommendedCta ? { label: "Recommended CTA", value: summary.recommendedCta } : null,
    summary.qualityScore != null ? { label: "Quality Score", value: String(summary.qualityScore) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">Generate a draft to see stage-aware guidance.</p>
  }

  return (
    <div className="space-y-2" data-qa="growth-personalization-stage-card">
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-border/60 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <p className={`mt-0.5 font-medium ${compact ? "text-xs" : "text-sm"}`}>{row.value}</p>
          </div>
        ))}
      </div>
      {summary.sequenceLabel ? (
        <GrowthBadge label={`Sequence · ${summary.sequenceLabel}`} tone="neutral" />
      ) : null}
    </div>
  )
}

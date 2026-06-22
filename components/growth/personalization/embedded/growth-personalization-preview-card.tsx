"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthPersonalizationDraftBodyPreview } from "@/components/growth/personalization/growth-personalization-draft-body-preview"
import type { GrowthPersonalizationLeadSummary } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import { personalizationStatusLabel } from "@/lib/growth/personalization/personalization-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

type Props = {
  summary: GrowthPersonalizationLeadSummary
  title?: string
  compact?: boolean
}

export function GrowthPersonalizationPreviewCard({ summary, title, compact = false }: Props) {
  if (!summary.hasDraft) {
    return (
      <p className="text-xs text-muted-foreground">
        No personalized draft yet. Generate to preview Stack B subject and body here.
      </p>
    )
  }

  return (
    <div className="space-y-2" data-qa="growth-personalization-preview-card">
      {title ? <p className="text-xs font-medium text-foreground">{title}</p> : null}
      <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
        <p className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{summary.subject ?? "—"}</p>
        {summary.body || summary.bodyPreview ? (
          <GrowthPersonalizationDraftBodyPreview
            body={summary.body ?? summary.bodyPreview ?? ""}
            className="mt-2"
            compact={compact}
            paragraphClassName={compact ? "text-muted-foreground" : undefined}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {summary.status ? (
          <GrowthBadge label={personalizationStatusLabel(summary.status)} tone={STATUS_TONE[summary.status] ?? "neutral"} />
        ) : null}
        {summary.qualityScore != null ? (
          <GrowthBadge label={`Quality ${summary.qualityScore}`} tone="healthy" />
        ) : null}
        {summary.buyingStageLabel ? (
          <GrowthBadge label={summary.buyingStageLabel} tone="neutral" />
        ) : null}
      </div>
    </div>
  )
}

"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { SharePageTemplateVersionDiffSummary } from "@/lib/growth/share-pages/share-page-template-version-diff"

export function GrowthSharePageTemplateVersionDiff({
  summary,
  compact = false,
}: {
  summary: SharePageTemplateVersionDiffSummary
  compact?: boolean
}) {
  if (compact) {
    return (
      <ul className="space-y-1 text-xs text-muted-foreground">
        {summary.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap gap-2">
        <GrowthBadge tone="neutral" label={`${summary.blockCountAfter} sections`} />
        {summary.themeChanged ? <GrowthBadge tone="attention" label="Theme changed" /> : null}
        {summary.metadataChanged ? <GrowthBadge tone="attention" label="Metadata changed" /> : null}
        {summary.mergeFieldsAdded.length > 0 ? (
          <GrowthBadge tone="healthy" label={`${summary.mergeFieldsAdded.length} merge fields added`} />
        ) : null}
        {summary.mergeFieldsRemoved.length > 0 ? (
          <GrowthBadge tone="attention" label={`${summary.mergeFieldsRemoved.length} merge fields removed`} />
        ) : null}
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {summary.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

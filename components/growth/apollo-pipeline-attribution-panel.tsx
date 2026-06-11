"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  formatApolloAttributionChain,
  type ApolloPipelineAttributionDisplay,
} from "@/lib/growth/apollo/apollo-pipeline-attribution-display"

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function ApolloPipelineAttributionPanel({
  attribution,
  className,
}: {
  attribution: ApolloPipelineAttributionDisplay
  className?: string
}) {
  return (
    <div className={className ?? "rounded-md border bg-muted/20 p-3 text-xs"}>
      <p className="mb-1 font-medium text-foreground">Attribution</p>
      <p className="text-muted-foreground">{formatApolloAttributionChain(attribution.attribution_chain)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {attribution.approved_at ? (
          <GrowthBadge tone="neutral">Approved {formatWhen(attribution.approved_at)}</GrowthBadge>
        ) : null}
        {attribution.approver_email ? (
          <GrowthBadge tone="neutral">By {attribution.approver_email}</GrowthBadge>
        ) : null}
        {attribution.rejection_note ? (
          <GrowthBadge tone="attention">Note: {attribution.rejection_note}</GrowthBadge>
        ) : null}
      </div>
    </div>
  )
}

export function ApolloDraftReadinessBadges({
  labels,
}: {
  labels: Array<"Draft Placeholder" | "Personalization Pending" | "Not Send Ready" | "Draft Approved">
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.includes("Draft Placeholder") ? (
        <GrowthBadge tone="attention">Draft Placeholder</GrowthBadge>
      ) : null}
      {labels.includes("Personalization Pending") ? (
        <GrowthBadge tone="medium">Personalization Pending</GrowthBadge>
      ) : null}
      {labels.includes("Not Send Ready") ? (
        <GrowthBadge tone="critical">Not Send Ready</GrowthBadge>
      ) : null}
      {labels.includes("Draft Approved") ? (
        <GrowthBadge tone="healthy">Draft Approved</GrowthBadge>
      ) : null}
    </div>
  )
}

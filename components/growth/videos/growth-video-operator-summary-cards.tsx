"use client"

import type { GrowthVideoOperatorWorkspaceSummaryCards } from "@/lib/growth/videos/growth-video-operator-workspace-types"

const CARD_LABELS: Record<keyof GrowthVideoOperatorWorkspaceSummaryCards, string> = {
  recommendationScore: "Recommendation score",
  personalizationScore: "Personalization score",
  videoType: "Video type",
  priority: "Priority",
  pageStatus: "Page status",
  attachmentStatus: "Attachment status",
  voiceStatus: "Voice status",
  avatarStatus: "Avatar status",
}

export function GrowthVideoOperatorSummaryCards({
  summary,
}: {
  summary: GrowthVideoOperatorWorkspaceSummaryCards
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(CARD_LABELS) as Array<keyof GrowthVideoOperatorWorkspaceSummaryCards>).map((key) => (
        <div key={key} className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">{CARD_LABELS[key]}</div>
          <div className="mt-1 text-sm font-semibold capitalize">
            {typeof summary[key] === "number" ? summary[key] : String(summary[key]).replace(/_/g, " ")}
          </div>
        </div>
      ))}
    </div>
  )
}

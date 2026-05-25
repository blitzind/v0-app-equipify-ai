"use client"

import type { MeetingOutcomeIntelligenceScorePublicView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"

function momentumTone(trend: string): "healthy" | "attention" | "medium" | "neutral" {
  if (trend === "building") return "healthy"
  if (trend === "at_risk") return "attention"
  if (trend === "slipping") return "medium"
  return "neutral"
}

export function GrowthMeetingOutcomeIntelligenceInline({
  score,
}: {
  score: MeetingOutcomeIntelligenceScorePublicView | null
}) {
  if (!score) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
        Outcome intelligence will appear after meeting completion or outcome recording — operator recompute available
        from Meeting Outcome Intelligence card.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting outcome intelligence</p>
      <div className="flex flex-wrap gap-2">
        <GrowthBadge label={`Confidence ${score.nextStepConfidence}/100`} tone="medium" />
        <GrowthBadge label={`${score.buyingSignalCount} buying signals`} tone="healthy" />
        <GrowthBadge label={`${score.objectionCount} objections`} tone={score.objectionCount >= 2 ? "attention" : "neutral"} />
        <GrowthBadge label={score.momentumTrendLabel} tone={momentumTone(score.momentumTrend)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Outcome score</p>
          <p className="text-sm font-medium">{score.meetingOutcomeScore}/100</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Quality score</p>
          <p className="text-sm font-medium">{score.meetingQualityScore}/100</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Recommended next step</p>
        <p className="text-sm">{score.recommendedNextStep}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {score.followUpRecommendationLabel} — recommendation only, no autonomous action.
      </p>
    </div>
  )
}

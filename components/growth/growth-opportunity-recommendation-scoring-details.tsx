"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthOpportunityRecommendation } from "@/lib/growth/opportunity-intelligence/opportunity-types"

function confidenceTone(label: string): "healthy" | "attention" | "neutral" {
  if (label === "high") return "healthy"
  if (label === "medium") return "attention"
  return "neutral"
}

export function GrowthOpportunityRecommendationScoringDetails({
  recommendation,
}: {
  recommendation: GrowthOpportunityRecommendation
}) {
  const metadata = recommendation.metadata ?? {}
  const opportunityScore = metadata.opportunityScore
  const confidence = metadata.confidence
  const confidenceLabel =
    typeof metadata.confidenceLabel === "string" ? metadata.confidenceLabel : null
  const recommendedStage =
    typeof metadata.recommendedStage === "string" ? metadata.recommendedStage : null
  const recommendedValueMin = metadata.recommendedValueMin
  const recommendedValueMax = metadata.recommendedValueMax
  const supportingEvidence = Array.isArray(metadata.supportingEvidence)
    ? (metadata.supportingEvidence as string[]).filter(Boolean)
    : []

  if (typeof opportunityScore !== "number" && supportingEvidence.length === 0) return null

  return (
    <div className="mt-2 space-y-2 border-t border-border/70 pt-2">
      {typeof opportunityScore === "number" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Score <span className="font-medium text-foreground">{opportunityScore}</span>
          </span>
          {typeof confidence === "number" ? (
            <span className="text-muted-foreground">
              Confidence <span className="font-medium text-foreground">{confidence}</span>
            </span>
          ) : null}
          {confidenceLabel ? (
            <GrowthBadge label={`${confidenceLabel} confidence`} tone={confidenceTone(confidenceLabel)} />
          ) : null}
          {recommendedStage ? (
            <span className="text-muted-foreground">
              Stage <span className="font-medium text-foreground">{recommendedStage}</span>
            </span>
          ) : null}
          {typeof recommendedValueMin === "number" && typeof recommendedValueMax === "number" ? (
            <span className="text-muted-foreground">
              Value{" "}
              <span className="font-medium text-foreground">
                ${recommendedValueMin.toLocaleString()}–${recommendedValueMax.toLocaleString()}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {supportingEvidence.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supporting evidence</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {supportingEvidence.slice(0, 6).map((snippet, index) => (
              <li key={`${recommendation.id}-evidence-${index}`}>{snippet}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

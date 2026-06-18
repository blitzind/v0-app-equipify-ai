"use client"

import { useMemo } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { GrowthInboxContextEmptyHint } from "@/components/growth/inbox/growth-inbox-context-empty-hint"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { orchestrateGrowthInboxRecommendations } from "@/lib/growth/inbox/inbox-recommendation-orchestrator"
import { shouldDeferGrowthInboxTier3Hydration } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import { GROWTH_ON_DEMAND_DEFERRED_COPY } from "@/lib/growth/inbox/growth-inbox-fetch-audit"

const SOURCE_LABELS = {
  workflow_action: "Workflow Action",
  revenue_execution: "Revenue Execution",
  execution_plan: "Execution Plan",
  playbook: "Playbook",
  booking_recommendation: "Booking",
  opportunity_recommendation: "Opportunity",
  revenue_readiness: "Revenue Readiness",
  reply_copilot: "Reply Copilot",
  next_best_action: "Next Best Action",
} as const

export function GrowthInboxRecommendedActionCard() {
  const {
    loading,
    workflowActions,
    opportunityRecommendations,
    bookingRecommendations,
    copilot,
    lead,
    revenueReadiness,
    forecastEvidence,
    executionPlan,
    playbook,
    commandCenterLead,
  } = useGrowthInboxLeadContext()
  const deferTier3 = shouldDeferGrowthInboxTier3Hydration()
  const tier3Loaded =
    Boolean(forecastEvidence) ||
    opportunityRecommendations.length > 0 ||
    bookingRecommendations.length > 0 ||
    Boolean(commandCenterLead)

  const { top: recommendation, ranked } = useMemo(
    () =>
      orchestrateGrowthInboxRecommendations({
        workflowActions,
        opportunityRecommendations,
        bookingRecommendations,
        copilot,
        lead,
        revenueReadiness,
        forecastEvidence,
        executionPlan,
        playbook,
        commandCenterLead,
      }),
    [
      workflowActions,
      opportunityRecommendations,
      bookingRecommendations,
      copilot,
      lead,
      revenueReadiness,
      forecastEvidence,
      executionPlan,
      playbook,
      commandCenterLead,
    ],
  )

  if (loading && !recommendation) {
    return (
      <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading recommendation…
      </div>
    )
  }

  if (!recommendation) {
    return (
      <GrowthInboxContextEmptyHint label="No prioritized action — monitoring workflow and revenue signals" />
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-700 dark:text-indigo-300" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge label={SOURCE_LABELS[recommendation.source]} tone="attention" />
              <GrowthBadge label={recommendation.confidence} tone="medium" />
            </div>
            <p className="text-sm font-semibold leading-snug text-foreground">{recommendation.recommendation}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why:</span> {recommendation.whyThisExists}
            </p>
            <p className="text-xs leading-relaxed text-foreground">
              <span className="font-medium">Next step:</span> {recommendation.recommendedNextStep}
            </p>
            {recommendation.evidence.length > 0 ? (
              <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {recommendation.evidence.slice(0, 3).map((entry) => (
                  <li key={entry} className="break-words">
                    • {entry}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[10px] leading-relaxed text-muted-foreground">Human approval required — no automation.</p>
          </div>
        </div>
      </div>
      {ranked.length > 1 ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {ranked.length - 1} alternate recommendation(s) in workflow sections below.
        </p>
      ) : null}
      {deferTier3 && !tier3Loaded ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">{GROWTH_ON_DEMAND_DEFERRED_COPY}</p>
      ) : null}
    </div>
  )
}

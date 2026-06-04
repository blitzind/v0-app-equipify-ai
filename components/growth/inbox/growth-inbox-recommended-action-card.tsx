"use client"

import { useMemo } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { orchestrateGrowthInboxRecommendations } from "@/lib/growth/inbox/inbox-recommendation-orchestrator"

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
      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Orchestrating recommended action…
        </div>
      </div>
    )
  }

  if (!recommendation) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground">
        No prioritized recommendation yet. Monitoring workflow, revenue execution, playbook, and intelligence sources.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-700 dark:text-indigo-300" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
                Recommended Action
              </p>
              <GrowthBadge label={SOURCE_LABELS[recommendation.source]} tone="attention" />
              <GrowthBadge label={recommendation.confidence} tone="medium" />
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{recommendation.recommendation}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium">Why:</span> {recommendation.whyThisExists}
            </p>
            <p className="mt-1 text-xs text-foreground">
              <span className="font-medium">Next step:</span> {recommendation.recommendedNextStep}
            </p>
            {recommendation.evidence.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {recommendation.evidence.slice(0, 3).map((entry) => (
                  <li key={entry} className="truncate">
                    • {entry}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[10px] text-muted-foreground">Human approval required — no automation.</p>
          </div>
        </div>
      </div>
      {ranked.length > 1 ? (
        <p className="text-[10px] text-muted-foreground">
          {ranked.length - 1} alternate recommendation(s) available in workflow sections below.
        </p>
      ) : null}
    </div>
  )
}

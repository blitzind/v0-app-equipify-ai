"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Loader2, Phone, Reply, CalendarClock, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { orchestrateGrowthInboxRecommendations } from "@/lib/growth/inbox/inbox-recommendation-orchestrator"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { growthWorkspaceInboxWorkflowHref, growthWorkspaceLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES = {
  HIGH: "border-red-200/80 bg-red-50/30",
  MEDIUM: "border-amber-200/80 bg-amber-50/30",
  LOW: "border-border/80 bg-background",
} as const

function resolveSeverity(rankScore: number): keyof typeof SEVERITY_STYLES {
  if (rankScore >= 12) return "HIGH"
  if (rankScore >= 8) return "MEDIUM"
  return "LOW"
}

export function GrowthInboxOperatorCopilot() {
  const callsHref = useGrowthFeaturePath("calls")
  const {
    loading,
    leadId,
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

  const { top: recommendation } = useMemo(
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
      <div className="flex h-full items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading operator copilot…
      </div>
    )
  }

  if (!recommendation) {
    return (
      <div className="flex h-full items-center p-4 text-sm text-muted-foreground">
        Select a thread to see operator guidance.
      </div>
    )
  }

  const severity = resolveSeverity(recommendation.rankScore)
  const workflowHref = growthWorkspaceInboxWorkflowHref(leadId)
  const leadHref = leadId ? growthWorkspaceLeadHref(leadId) : null

  return (
    <section aria-labelledby="inbox-operator-copilot-heading" className="flex h-full flex-col p-3" data-section="operator-copilot">
      <h2 id="inbox-operator-copilot-heading" className="mb-3 text-sm font-semibold text-foreground">
        Operator Copilot
      </h2>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-xl border p-4",
          SEVERITY_STYLES[severity],
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{severity}</p>
        <p className="mt-2 text-base font-semibold text-foreground">{recommendation.recommendation}</p>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Why:</span>
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>{recommendation.whyThisExists}</li>
            {recommendation.evidence.slice(0, 2).map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          <p className="pt-1 text-foreground">
            <span className="font-medium">Suggested next step:</span> {recommendation.recommendedNextStep}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="default" asChild>
            <Link href={workflowHref}>
              <Reply className="mr-1.5 size-3.5" aria-hidden />
              Draft Reply
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={leadId ? `${callsHref}?leadId=${encodeURIComponent(leadId)}` : callsHref}>
              <Phone className="mr-1.5 size-3.5" aria-hidden />
              Call Prospect
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF}>
              <CalendarClock className="mr-1.5 size-3.5" aria-hidden />
              Book Meeting
            </Link>
          </Button>
          {leadHref ? (
            <Button size="sm" variant="ghost" asChild>
              <Link href={leadHref}>
                <UserRound className="mr-1.5 size-3.5" aria-hidden />
                Open Lead
              </Link>
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Human approval required — no automation.</p>
      </div>
    </section>
  )
}

"use client"

import Link from "next/link"
import { BrainCircuit } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MeetingOutcomeDashboardSummary } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"

function momentumTone(trend: string): "healthy" | "attention" | "medium" | "neutral" {
  if (trend === "building") return "healthy"
  if (trend === "at_risk") return "attention"
  if (trend === "slipping") return "medium"
  return "neutral"
}

function OutcomeList({
  title,
  items,
  empty,
}: {
  title: string
  items: MeetingOutcomeDashboardSummary["stalledOpportunities"]
  empty: string
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 4).map((item) => (
            <li key={item.id} className="rounded-lg border border-border/80 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.companyName}</p>
                  <p className="text-xs text-muted-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.recommendedNextStep}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GrowthBadge label={item.followUpRecommendationLabel} tone="attention" />
                  <GrowthBadge label={item.momentumTrend} tone={momentumTone(item.momentumTrend)} />
                  <Button asChild size="sm" variant="outline">
                    <Link href={item.ctaHref}>Open</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GrowthCommandMeetingOutcomesSection({
  dashboard,
}: {
  dashboard: MeetingOutcomeDashboardSummary
}) {
  return (
    <GrowthEngineCard
      title="Meeting Outcomes"
      subtitle="Deterministic follow-up recommendations — operator controlled only"
      icon={<BrainCircuit className="size-4" />}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <GrowthBadge label={GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER} tone="healthy" />
        <GrowthBadge label="Recommendations only · no auto-send" tone="neutral" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Scored meetings" value={String(dashboard.scoredMeetings)} />
        <StatTile label="Avg outcome score" value={`${dashboard.averageOutcomeScore}/100`} />
        <StatTile label="Avg quality score" value={`${dashboard.averageQualityScore}/100`} />
        <StatTile label="At risk" value={String(dashboard.atRiskMeetings.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OutcomeList
          title="Stalled opportunities"
          items={dashboard.stalledOpportunities}
          empty="No stall-risk meetings flagged."
        />
        <OutcomeList
          title="No-show recovery queue"
          items={dashboard.noShowRecoveryQueue}
          empty="No no-show recovery items."
        />
      </div>

      <div className="mt-6">
        <OutcomeList
          title="Follow-up recommendations"
          items={dashboard.followUpRecommendations}
          empty="No follow-up recommendations queued."
        />
      </div>
    </GrowthEngineCard>
  )
}

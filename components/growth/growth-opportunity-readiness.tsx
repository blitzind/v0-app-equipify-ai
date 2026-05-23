"use client"

import { ArrowDownRight, ArrowRight, ArrowUpRight, Target } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadOpportunityActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthOpportunityReadinessProps = {
  lead: GrowthLead
}

function trendIcon(trend: GrowthLead["opportunityReadinessTrend"]) {
  switch (trend) {
    case "improving":
      return <ArrowUpRight className="size-4 text-emerald-600" />
    case "declining":
      return <ArrowDownRight className="size-4 text-amber-600" />
    default:
      return <ArrowRight className="size-4 text-muted-foreground" />
  }
}

function trendTone(trend: GrowthLead["opportunityReadinessTrend"]): "healthy" | "warning" | "neutral" {
  if (trend === "improving") return "healthy"
  if (trend === "declining") return "warning"
  return "neutral"
}

export function GrowthOpportunityReadiness({ lead }: GrowthOpportunityReadinessProps) {
  const collapsedSummary = [
    lead.opportunityReadinessScore != null ? `${lead.opportunityReadinessScore}` : null,
    lead.opportunityReadinessTier?.replace(/_/g, " ") ?? null,
    lead.opportunityReadinessTrend ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <GrowthCollapsibleEngineCard
      title="Opportunity Readiness"
      icon={<Target className="size-4" />}
      headerAside={collapsedSummary || "No readiness data"}
      headerTrailing={growthLeadOpportunityActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {lead.opportunityReadinessScore ?? "—"}
          </span>
          {lead.opportunityReadinessTier ? (
            <GrowthBadge label={lead.opportunityReadinessTier.replace(/_/g, " ")} tone="healthy" />
          ) : null}
          {lead.opportunityReadinessTrend ? (
            <span className="inline-flex items-center gap-1">
              {trendIcon(lead.opportunityReadinessTrend)}
              <GrowthBadge label={lead.opportunityReadinessTrend} tone={trendTone(lead.opportunityReadinessTrend)} />
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">
            Confidence: <span className="font-medium text-foreground">{lead.opportunityReadinessConfidence}</span>
          </span>
          {lead.opportunityBuyingSignalStrength !== "none" ? (
            <span className="text-muted-foreground">
              Buying signal:{" "}
              <span className="font-medium text-foreground">{lead.opportunityBuyingSignalStrength}</span>
            </span>
          ) : null}
          <span className="text-muted-foreground">
            Age: <span className="font-medium text-foreground">{lead.opportunityAgeBucket}</span>
          </span>
        </div>

        {lead.opportunityReadinessSummary ? (
          <p className="text-sm text-foreground">{lead.opportunityReadinessSummary}</p>
        ) : null}

        {lead.opportunityBlockers.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Blockers</p>
            <ul className="space-y-1.5">
              {lead.opportunityBlockers.map((blocker) => (
                <li key={blocker.key} className="text-sm text-amber-800">{blocker.label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.opportunityAccelerators.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Accelerators</p>
            <ul className="space-y-1.5">
              {lead.opportunityAccelerators.map((accelerator) => (
                <li key={accelerator.key} className="text-sm text-emerald-800">{accelerator.label}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.opportunityReadinessTopSignals.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top signals</p>
            <ul className="space-y-1.5">
              {lead.opportunityReadinessTopSignals.map((signal, index) => (
                <li key={`${signal.kind}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span>{signal.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {signal.points > 0 ? "+" : ""}
                    {signal.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}

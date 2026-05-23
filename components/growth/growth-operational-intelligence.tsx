"use client"

import { AlertCircle, Gauge, Target, Timer, TrendingUp, Zap } from "lucide-react"
import {
  GrowthBadge,
  GrowthEngineCard,
  StatTile,
  formatRelativeTime,
  momentumTierTone,
  researchFreshnessLabel,
  workflowHealthTone,
} from "@/components/growth/growth-ui-utils"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthOperationalIntelligenceProps = {
  lead: GrowthLead
}

export function GrowthOperationalIntelligence({ lead }: GrowthOperationalIntelligenceProps) {
  const researchFreshness = researchFreshnessLabel(lead.lastResearchedAt)

  return (
    <GrowthEngineCard title="Operational Intelligence" icon={<Gauge className="size-4" />}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={<TrendingUp className="size-3.5" />}
          label="Momentum"
          value={
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">{lead.momentumScore ?? "—"}</span>
              {lead.momentumTier ? (
                <GrowthBadge label={lead.momentumTier} tone={momentumTierTone(lead.momentumTier)} />
              ) : null}
            </div>
          }
          hint={lead.momentumWhySummary ?? undefined}
        />

        <StatTile
          icon={<Zap className="size-3.5" />}
          label="Engagement"
          value={
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">{lead.engagementScore ?? "—"}</span>
              {lead.engagementTier ? <GrowthBadge label={lead.engagementTier} tone="healthy" /> : null}
            </div>
          }
          hint={lead.engagementSummary ?? undefined}
        />

        <StatTile
          icon={<AlertCircle className="size-3.5" />}
          label="Workflow Health"
          value={
            lead.workflowHealth ? (
              <GrowthBadge
                label={lead.workflowHealth.replace(/_/g, " ")}
                tone={workflowHealthTone(lead.workflowHealth)}
              />
            ) : (
              "—"
            )
          }
          hint={lead.workflowHealthReason ?? undefined}
        />

        <StatTile
          icon={<Timer className="size-3.5" />}
          label="Aging Bucket"
          value={
            lead.agingBucket ? (
              <span className="capitalize">
                {lead.agingBucket}
                {lead.agingDays != null ? ` · ${lead.agingDays}d` : ""}
              </span>
            ) : (
              "—"
            )
          }
        />

        <StatTile
          icon={<Target className="size-3.5" />}
          label="First Touch"
          value={
            lead.firstHumanTouchAt ? formatRelativeTime(lead.firstHumanTouchAt) : lead.lastHumanTouchAt ? "Pending metric" : "Not yet"
          }
          hint={
            lead.timeToFirstTouchHours != null
              ? `Time to first touch: ${lead.timeToFirstTouchHours}h`
              : lead.firstHumanTouchAt
                ? undefined
                : "No human touch recorded"
          }
        />

        <StatTile
          icon={<Gauge className="size-3.5" />}
          label="Research Freshness"
          value={<GrowthBadge label={researchFreshness.label} tone={researchFreshness.tone} />}
          hint={
            lead.lastResearchedAt
              ? `Last researched ${formatRelativeTime(lead.lastResearchedAt)}`
              : "No research on file"
          }
        />
      </div>
    </GrowthEngineCard>
  )
}

"use client"

import { Crown } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadExecutiveActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthExecutiveOperatingIntelligenceProps = {
  lead: GrowthLead
}

function tierTone(tier: GrowthLead["executivePriorityTier"]): "healthy" | "warning" | "neutral" {
  if (tier === "executive_now" || tier === "priority") return "warning"
  if (tier === "important") return "healthy"
  return "neutral"
}

export function GrowthExecutiveOperatingIntelligence({ lead }: GrowthExecutiveOperatingIntelligenceProps) {
  const collapsedSummary = [
    lead.executivePriorityScore != null ? `${lead.executivePriorityScore}` : null,
    lead.executivePriorityTier?.replace(/_/g, " ") ?? null,
    lead.intelligenceConflicts.length > 0 ? `${lead.intelligenceConflicts.length} conflicts` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const attentionReasons = lead.executivePriorityTopSignals
    .filter((signal) => signal.points > 0)
    .slice(0, 4)

  return (
    <GrowthCollapsibleEngineCard
      id="growth-executive"
      title="Executive Intelligence"
      icon={<Crown className="size-4" />}
      headerAside={collapsedSummary || "No executive data"}
      headerTrailing={growthLeadExecutiveActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.executive}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {lead.executivePriorityScore ?? "—"}
          </span>
          {lead.executivePriorityTier ? (
            <GrowthBadge label={lead.executivePriorityTier.replace(/_/g, " ")} tone={tierTone(lead.executivePriorityTier)} />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">
            Volatility:{" "}
            <span className="font-medium text-foreground">{lead.executivePriorityVolatility}</span>
          </span>
          <span className="text-muted-foreground">
            Conflict severity:{" "}
            <span className="font-medium text-foreground">{lead.intelligenceConflictSeverityScore}</span>
          </span>
          {lead.executiveOwner ? (
            <span className="text-muted-foreground">
              Owner: <span className="font-medium text-foreground">{lead.executiveOwner}</span>
            </span>
          ) : null}
          {lead.executiveInterventionOpenedAt ? (
            <span className="text-muted-foreground">
              Intervention:{" "}
              <span className="font-medium text-foreground">{lead.executiveInterventionAgeBucket}</span>
            </span>
          ) : null}
        </div>

        {lead.executivePrioritySummary ? (
          <p className="text-sm text-foreground">{lead.executivePrioritySummary}</p>
        ) : null}

        {lead.executiveRecommendation ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-800">Recommendation</p>
            <p className="mt-1 text-sm text-violet-950">{lead.executiveRecommendation}</p>
          </div>
        ) : null}

        {attentionReasons.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attention reasons
            </p>
            <ul className="space-y-1.5">
              {attentionReasons.map((signal, index) => (
                <li key={`${signal.kind}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span>{signal.label}</span>
                  <span className="tabular-nums text-muted-foreground">+{signal.points}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.intelligenceConflicts.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conflicts</p>
            <ul className="space-y-1.5">
              {lead.intelligenceConflicts.map((conflict) => (
                <li key={conflict.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className={conflict.severity === "critical" ? "text-rose-800" : "text-amber-800"}>
                    {conflict.label}
                  </span>
                  <GrowthBadge label={conflict.severity} tone={conflict.severity === "critical" ? "warning" : "neutral"} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.executivePriorityTopSignals.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top signals</p>
            <ul className="space-y-1.5">
              {lead.executivePriorityTopSignals.map((signal, index) => (
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

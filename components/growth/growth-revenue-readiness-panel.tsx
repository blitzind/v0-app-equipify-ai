"use client"

import { DollarSign } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  readRevenueReadinessFromLeadMetadata,
  revenueReadinessTierLabel,
  type GrowthRevenueReadinessSnapshot,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthRevenueReadinessPanelProps = {
  lead: GrowthLead
}

function readinessTone(tier: GrowthRevenueReadinessSnapshot["tier"]): "healthy" | "attention" | "warning" | "neutral" {
  if (tier === "revenue_ready" || tier === "sales_ready") return "healthy"
  if (tier === "qualified") return "attention"
  if (tier === "warming") return "neutral"
  return "warning"
}

export function GrowthRevenueReadinessPanel({ lead }: GrowthRevenueReadinessPanelProps) {
  const snapshot = readRevenueReadinessFromLeadMetadata(lead.metadata)
  const collapsedSummary = snapshot
    ? `${snapshot.score} · ${revenueReadinessTierLabel(snapshot.tier)}`
    : "Not computed"

  return (
    <GrowthCollapsibleEngineCard
      title="Revenue Readiness"
      icon={<DollarSign className="size-4" />}
      headerAside={collapsedSummary}
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.revenueReadiness}
    >
      {!snapshot ? (
        <p className="text-sm text-muted-foreground">
          Revenue readiness will appear after the next workflow signal recompute.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">{snapshot.score}</span>
            <GrowthBadge label={revenueReadinessTierLabel(snapshot.tier)} tone={readinessTone(snapshot.tier)} />
          </div>
          <p className="text-sm text-muted-foreground">{snapshot.summary}</p>

          {snapshot.topPositiveSignals.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top signals</p>
              <ul className="mt-2 space-y-1 text-sm">
                {snapshot.topPositiveSignals.map((signal) => (
                  <li key={signal.kind} className="flex justify-between gap-2">
                    <span>{signal.label}</span>
                    <span className="tabular-nums text-muted-foreground">+{signal.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {snapshot.topRisks.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top risks</p>
              <ul className="mt-2 space-y-1 text-sm">
                {snapshot.topRisks.map((risk) => (
                  <li key={risk.kind} className="text-amber-800 dark:text-amber-200">
                    {risk.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Human approval required for pipeline advancement, opportunity creation, and task creation.
          </p>
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}

export function GrowthRevenueReadinessBadge({ lead }: { lead: GrowthLead }) {
  const snapshot = readRevenueReadinessFromLeadMetadata(lead.metadata)
  if (!snapshot) return null
  return (
    <GrowthBadge
      label={`Revenue ${snapshot.score} · ${revenueReadinessTierLabel(snapshot.tier)}`}
      tone={readinessTone(snapshot.tier)}
    />
  )
}

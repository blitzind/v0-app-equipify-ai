"use client"

import { useCallback, useEffect, useState } from "react"
import { Lightbulb, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  recommendationTypeLabel,
  signalTypeLabel,
  type GrowthOpportunityIntelligenceDashboard,
  type GrowthOpportunityRecommendation,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadOpportunityIntelligencePanelProps = {
  lead: GrowthLead
}

type DashboardPayload = {
  ok?: boolean
  intelligence?: GrowthOpportunityIntelligenceDashboard | null
  message?: string
}

export function GrowthLeadOpportunityIntelligencePanel({ lead }: GrowthLeadOpportunityIntelligencePanelProps) {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<GrowthOpportunityIntelligenceDashboard | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/platform/growth/opportunities/dashboard?leadId=${encodeURIComponent(lead.id)}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as DashboardPayload
      if (response.ok && payload.intelligence) setDashboard(payload.intelligence)
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function resolveRecommendation(
    recommendation: GrowthOpportunityRecommendation,
    action: "accept" | "dismiss",
  ) {
    setActionLoading(`${action}:${recommendation.id}`)
    try {
      await fetch(`/api/platform/growth/opportunities/recommendations/${recommendation.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApprovalConfirmed: true }),
      })
      await load()
    } finally {
      setActionLoading(null)
    }
  }

  const signalCount = dashboard?.opportunitySignals.length ?? 0
  const actionCount = dashboard?.recommendedActions.length ?? 0
  const collapsedSummary = loading ? "Loading…" : `${signalCount} signals · ${actionCount} actions`

  return (
    <GrowthCollapsibleEngineCard
      title="Opportunity Intelligence"
      icon={<Lightbulb className="size-4" />}
      headerAside={collapsedSummary}
      persistKey={GROWTH_DRAWER_CARD_KEYS.opportunityIntelligence}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading opportunity intelligence…
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buying Signals</p>
            {(dashboard?.buyingSignals ?? []).length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No buying signals for this account.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {(dashboard?.buyingSignals ?? []).slice(0, 5).map((signal) => (
                  <div key={signal.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <GrowthBadge label={signalTypeLabel(signal.signalType)} tone="attention" />
                    <p className="mt-1 text-xs text-muted-foreground">{signal.evidenceSnippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended Actions</p>
            {(dashboard?.recommendedActions ?? []).length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No pending recommendations.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {(dashboard?.recommendedActions ?? []).slice(0, 5).map((recommendation) => (
                  <div key={recommendation.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthBadge label={recommendationTypeLabel(recommendation.recommendationType)} tone="attention" />
                      <span className="font-medium">{recommendation.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{recommendation.description}</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void resolveRecommendation(recommendation, "accept")}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void resolveRecommendation(recommendation, "dismiss")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Committee Expansion</p>
            {(dashboard?.committeeExpansion ?? []).length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No committee signals.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {(dashboard?.committeeExpansion ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-medium">{entry.contactLabel}</p>
                    <p className="text-xs text-muted-foreground">{entry.roleHint ?? "Stakeholder"} · {entry.evidenceSnippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}

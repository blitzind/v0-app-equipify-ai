"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_REVENUE_COMMAND_CENTER_VIEWS,
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthRevenueCommandCenterDashboard,
  type GrowthRevenueCommandCenterView,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

const VIEW_LABELS: Record<GrowthRevenueCommandCenterView, string> = {
  revenue_ready: "Revenue-ready leads",
  high_confidence_opportunities: "High-confidence opportunities",
  stalled_opportunities: "Stalled opportunities",
  objection_heavy: "Objection-heavy leads",
  re_engagement: "Re-engagement candidates",
  competitive_risk: "Competitive-risk opportunities",
}

export function GrowthRevenueExecutionCommandCenter() {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<GrowthRevenueCommandCenterDashboard | null>(null)
  const [activeView, setActiveView] = useState<GrowthRevenueCommandCenterView>("revenue_ready")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/platform/growth/revenue-execution/command-center", { cache: "no-store" })
      const payload = (await response.json()) as { dashboard?: GrowthRevenueCommandCenterDashboard }
      if (response.ok && payload.dashboard?.qaMarker === GROWTH_REVENUE_EXECUTION_QA_MARKER) {
        setDashboard(payload.dashboard)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading revenue command center…
      </div>
    )
  }

  if (!dashboard) {
    return <p className="text-sm text-muted-foreground">Revenue command center unavailable.</p>
  }

  const sectionLeads = dashboard.sections[activeView] ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Actionable leads" value={String(dashboard.totalActionable)} />
        <StatTile label="Views" value={String(GROWTH_REVENUE_COMMAND_CENTER_VIEWS.length)} />
        <StatTile
          label="Generated"
          value={new Date(dashboard.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {GROWTH_REVENUE_COMMAND_CENTER_VIEWS.map((view) => {
          const count = dashboard.sections[view]?.length ?? 0
          return (
            <Button
              key={view}
              size="sm"
              variant={activeView === view ? "default" : "outline"}
              onClick={() => setActiveView(view)}
            >
              {VIEW_LABELS[view]} ({count})
            </Button>
          )
        })}
      </div>

      <GrowthEngineCard title={VIEW_LABELS[activeView]} icon={<Target className="size-4" />}>
        {sectionLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads in this segment right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sectionLeads.map((lead) => (
              <li key={`${lead.view}-${lead.leadId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/admin/growth/leads/${lead.leadId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {lead.companyName}
                  </Link>
                  <p className="text-sm text-muted-foreground">{lead.primaryReason}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <GrowthBadge label={`Readiness ${lead.revenueReadinessScore}`} tone="healthy" />
                    {lead.opportunityScore != null ? (
                      <GrowthBadge label={`Opp ${lead.opportunityScore}`} tone="attention" />
                    ) : null}
                    {lead.nextBestAction ? (
                      <GrowthBadge label={lead.nextBestAction.replace(/_/g, " ")} tone="neutral" />
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  {lead.pendingRecommendationId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/admin/growth/revenue-execution/review?recommendationId=${lead.pendingRecommendationId}`}
                      >
                        Review
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/growth/leads/${lead.leadId}`}>Open lead</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <p className="text-xs text-muted-foreground">
        Prioritized for rep action — all pipeline advancement requires operator approval.
      </p>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_REVENUE_WORKFLOW_QA_MARKER,
  revenueReadinessTierLabel,
  type GrowthRevenueWorkflowWorkspaceDashboard,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthRevenueWorkflowWorkspaceDashboard
}

export function GrowthRevenueWorkflowWorkspacePanel({ leadId, compact }: { leadId?: string; compact?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<GrowthRevenueWorkflowWorkspaceDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("leadId", leadId)
      params.set("limit", leadId ? "1" : "25")
      const response = await fetch(`/api/platform/growth/revenue-workflow/workspace?${params.toString()}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as DashboardPayload
      if (response.ok && payload.dashboard) setDashboard(payload.dashboard)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading revenue intelligence…
      </div>
    )
  }

  if (!dashboard || dashboard.qaMarker !== GROWTH_REVENUE_WORKFLOW_QA_MARKER) {
    return <p className="text-sm text-muted-foreground">Revenue workflow workspace unavailable.</p>
  }

  const lead = dashboard.leads[0]

  if (compact && leadId && lead) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={`Readiness ${lead.revenueReadinessScore}`} tone="healthy" />
          {lead.opportunityRecommendationScore != null ? (
            <GrowthBadge label={`Opp rec ${lead.opportunityRecommendationScore}`} tone="attention" />
          ) : null}
        </div>
        {lead.recommendedNextAction ? (
          <p className="text-muted-foreground">{lead.recommendedNextAction}</p>
        ) : null}
      </div>
    )
  }

  return (
    <GrowthEngineCard title="Revenue Intelligence Workspace" icon={<TrendingUp className="size-4" />}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Avg readiness" value={String(dashboard.averageRevenueReadiness)} />
        <StatTile label="Pending opp recs" value={String(dashboard.pendingOpportunityRecommendations)} />
        <StatTile label="Pending workflow" value={String(dashboard.pendingWorkflowActions)} />
      </div>

      <div className="space-y-3">
        {dashboard.leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revenue workflow leads in queue.</p>
        ) : (
          dashboard.leads.map((entry) => (
            <div key={entry.leadId} className="rounded-lg border border-border px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{entry.companyName}</span>
                <div className="flex flex-wrap gap-2">
                  <GrowthBadge label={`${entry.revenueReadinessScore} · ${revenueReadinessTierLabel(entry.revenueReadinessTier)}`} tone="healthy" />
                  {entry.callPriorityScore != null ? (
                    <GrowthBadge label={`Call ${entry.callPriorityScore}`} tone="attention" />
                  ) : null}
                </div>
              </div>

              {entry.topBuyingSignals.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Buying: {entry.topBuyingSignals.slice(0, 2).join(" · ")}
                </p>
              ) : null}
              {entry.openObjections.length > 0 ? (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Objections: {entry.openObjections.slice(0, 2).join(" · ")}
                </p>
              ) : null}
              {entry.commitments.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Commitments: {entry.commitments.slice(0, 2).join(" · ")}
                </p>
              ) : null}
              {entry.riskFactors.length > 0 ? (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Risks: {entry.riskFactors.slice(0, 2).join(" · ")}
                </p>
              ) : null}
              {entry.nextBestAction ? (
                <p className="mt-2 text-xs">
                  Next best action: <span className="font-medium">{entry.nextBestAction.replace(/_/g, " ")}</span>
                </p>
              ) : null}

              {!leadId ? (
                <div className="mt-2">
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <Link href={`/admin/growth/leads?leadId=${encodeURIComponent(entry.leadId)}`}>Open lead</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Recommendations require operator confirmation. No autonomous pipeline advancement.{" "}
        <Link href="/admin/growth/revenue-execution" className="font-medium text-primary hover:underline">
          Open Revenue Command Center →
        </Link>
      </p>
    </GrowthEngineCard>
  )
}

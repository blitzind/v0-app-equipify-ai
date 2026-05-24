"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, TrendingUp } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export function GrowthPipelineCommandSummary() {
  const [dashboard, setDashboard] = useState<GrowthOpportunityPipelineDashboard | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setSetupMessage(null)
    try {
      const res = await fetch("/api/platform/growth/opportunities/pipeline?view=all_pipeline&limit=1", {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        dashboard?: GrowthOpportunityPipelineDashboard | null
      }
      if (res.ok && data.ok) {
        if (data.meta?.schemaReady === false) {
          setSetupMessage(data.meta.setupMessage ?? null)
          setDashboard(null)
        } else {
          setDashboard(data.dashboard ?? null)
        }
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
      <GrowthEngineCard title="Pipeline & Forecast">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading pipeline summary…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Pipeline & Forecast">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="size-4" />
          Revenue operating layer — no autonomous stage movement.
        </div>
        <Link href="/admin/growth/opportunities/pipeline" className="text-sm text-indigo-600 hover:underline">
          Open pipeline
        </Link>
      </div>
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {setupMessage}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Pipeline risk" value={dashboard?.atRiskCount ?? 0} />
        <StatTile label="Forecast commit" value={formatCurrency(dashboard?.forecastTotals.commit.weightedAmount ?? 0)} />
        <StatTile label="Deals needing action" value={dashboard?.dealsNeedingAction ?? 0} />
        <StatTile label="Won revenue" value={formatCurrency(dashboard?.wonRevenue ?? 0)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <GrowthBadge label={`Pipeline ${formatCurrency(dashboard?.forecastTotals.pipeline.weightedAmount ?? 0)}`} tone="medium" />
        <GrowthBadge label={`Best case ${formatCurrency(dashboard?.forecastTotals.best_case.weightedAmount ?? 0)}`} tone="neutral" />
        <GrowthBadge label={`Stale ${dashboard?.staleOpportunityCount ?? 0}`} tone="attention" />
      </div>
    </GrowthEngineCard>
  )
}

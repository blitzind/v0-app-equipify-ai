"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import { GROWTH_COMMAND_OPEN_OPPORTUNITIES_QA_MARKER } from "@/lib/growth/command/command-center-open-opportunities"
import type { GrowthOpportunityPipelineDashboard } from "@/lib/growth/opportunity-pipeline/pipeline-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export function GrowthCommandOpenOpportunitiesSection() {
  const pipelinePath = useGrowthFeaturePath("opportunities/pipeline")
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

  const openCount = useMemo(() => {
    if (!dashboard) return 0
    return dashboard.pipelineByStage.reduce((sum, stage) => sum + stage.count, 0)
  }, [dashboard])

  if (loading) {
    return (
      <GrowthEngineCard title="Open opportunities" icon={<TrendingUp className="size-4" />}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading opportunities…
        </div>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard
      title="Open opportunities"
      icon={<TrendingUp className="size-4" />}
      data-qa-marker={GROWTH_COMMAND_OPEN_OPPORTUNITIES_QA_MARKER}
    >
      {setupMessage ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {setupMessage}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={pipelinePath}>Open pipeline</Link>
        </Button>
      </div>

      <div
        className="grid items-stretch gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        <StatTile label="Open opportunities" value={openCount} className="min-h-[120px] justify-center" />
        <StatTile
          label="Pipeline value"
          value={formatCurrency(dashboard?.openPipeline ?? 0)}
          className="min-h-[120px] justify-center"
        />
        <StatTile
          label="Follow-ups due"
          value={dashboard?.dealsNeedingAction ?? 0}
          className="min-h-[120px] justify-center"
        />
      </div>
    </GrowthEngineCard>
  )
}

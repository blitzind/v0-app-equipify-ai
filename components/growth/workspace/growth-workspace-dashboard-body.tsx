"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS } from "@/lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import {
  GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
  type GrowthWorkspaceDashboardMetricLink,
  type GrowthWorkspaceDashboardSection,
} from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"

function formatMetricValue(metric: GrowthWorkspaceDashboardMetricLink): string {
  if (metric.label === "Forecast value" || metric.label === "Weighted pipeline") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(metric.value)
  }
  if (metric.label === "Engagement score") {
    return metric.value > 0 ? `${metric.value}` : "—"
  }
  return String(metric.value)
}

function DashboardSectionSkeleton({ title }: { title: string }) {
  return (
    <GrowthEngineCard title={title}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    </GrowthEngineCard>
  )
}

function MetricGrid({ section }: { section: GrowthWorkspaceDashboardSection }) {
  if (section.id === "quick-actions") return null

  return (
    <GrowthEngineCard title={section.title} data-section={section.id}>
      {section.emptyMessage ? (
        <p className="mb-3 text-sm text-muted-foreground">{section.emptyMessage}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {section.metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="block h-full">
            <StatTile
              label={metric.label}
              value={formatMetricValue(metric)}
              hint={metric.value <= 0 ? metric.emptyHint : undefined}
              className={cn(
                "h-full transition-colors hover:border-primary/30 hover:bg-muted/30",
                metric.value <= 0 && "opacity-90",
              )}
            />
          </Link>
        ))}
      </div>
    </GrowthEngineCard>
  )
}

function QuickActionsSection() {
  return (
    <GrowthEngineCard title="Quick Actions" data-section="quick-actions">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.id}
              href={action.href}
              className="flex min-h-16 items-center gap-3 rounded-xl border border-border/80 px-4 py-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Icon size={16} />
              </span>
              <span className="font-medium">{action.label}</span>
            </Link>
          )
        })}
      </div>
    </GrowthEngineCard>
  )
}

export function GrowthWorkspaceDashboardBody() {
  const { dashboard, loading, error, reload } = useGrowthWorkspaceDashboard()

  if (loading && !dashboard) {
    return (
      <div
        className="space-y-6"
        data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_QA_MARKER}
        data-workspace-dashboard-loading="true"
      >
        <DashboardSectionSkeleton title="My Queue" />
        <DashboardSectionSkeleton title="Activity" />
        <DashboardSectionSkeleton title="Pipeline Snapshot" />
        <DashboardSectionSkeleton title="Campaign Snapshot" />
        <DashboardSectionSkeleton title="Intelligence" />
        <DashboardSectionSkeleton title="Quick Actions" />
      </div>
    )
  }

  if (!dashboard) return null

  const metricSections = dashboard.sections.filter((section) => section.id !== "quick-actions")

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_QA_MARKER}>
      {dashboard.recommendedAction ? (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <p className="font-medium text-foreground">
            {dashboard.operatorName ? `Welcome back, ${dashboard.operatorName}` : "Operator home"}
          </p>
          <p className="mt-1 text-muted-foreground">{dashboard.recommendedAction}</p>
        </section>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <p>Some dashboard sources were unavailable. Showing graceful fallbacks.</p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {metricSections.map((section) => (
        <MetricGrid key={section.id} section={section} />
      ))}

      <QuickActionsSection />
    </div>
  )
}

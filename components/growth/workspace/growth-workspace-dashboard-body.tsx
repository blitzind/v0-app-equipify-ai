"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, Clock3, RefreshCw } from "lucide-react"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS,
  GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTION_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import {
  GrowthOperatorBriefingOperationalSummary,
  GrowthOperatorBriefingPriorities,
} from "@/components/growth/growth-operator-briefing-compact"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import { GrowthAutonomyStatusBanner } from "@/components/growth/autonomy/growth-autonomy-status-banner"
import { GrowthOperatorSetupHealthPanel } from "@/components/growth/operational/growth-operator-setup-health-panel"
import {
  GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
  type GrowthWorkspaceDashboardActionCard,
  type GrowthWorkspaceDashboardMetricLink,
  type GrowthWorkspaceDashboardSection,
  type GrowthWorkspaceDashboardWelcome,
} from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  readGrowthWorkspaceContinueItems,
  readGrowthWorkspaceQuickActionUsage,
  readGrowthWorkspaceRecentViews,
  recordGrowthWorkspaceQuickActionUsage,
  type GrowthWorkspaceContinueItem,
  type GrowthWorkspaceRecentView,
} from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"
import { useGrowthWorkspaceQuickActionShortcuts } from "@/components/growth/workspace/use-growth-workspace-quick-action-shortcuts"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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

function WelcomeSection({
  welcome,
  briefing,
}: {
  welcome: GrowthWorkspaceDashboardWelcome
  briefing: AidenDailyBriefing | null
}) {
  const headline = welcome.operatorName
    ? welcome.greeting.includes(welcome.operatorName)
      ? welcome.greeting
      : `${welcome.greeting}, ${welcome.operatorName}`
    : welcome.greeting

  return (
    <section
      className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-background px-4 py-4 sm:px-5 sm:py-5 dark:border-indigo-900/40 dark:from-indigo-950/20"
      data-section="welcome"
    >
      <p className="text-lg font-semibold tracking-tight text-foreground">{headline}</p>

      <div className="mt-4 space-y-4">
        <GrowthOperatorBriefingOperationalSummary briefing={briefing} />

        {welcome.recommendedAction ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Recommended next action: </span>
            {welcome.recommendedAction}
          </p>
        ) : null}
        {welcome.todaysFocus ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Today&apos;s focus: </span>
            {welcome.todaysFocus}
          </p>
        ) : null}

        <GrowthOperatorBriefingPriorities briefing={briefing} />
      </div>
    </section>
  )
}

function OperatorActionCardsSection({ cards }: { cards: GrowthWorkspaceDashboardActionCard[] }) {
  if (cards.length === 0) return null

  return (
    <GrowthEngineCard title="What should I do next?" data-section="operator-action-cards">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className="group flex min-h-24 flex-col justify-between rounded-xl border border-border/80 p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div>
              <p className="font-medium text-foreground">{card.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </GrowthEngineCard>
  )
}

function RecentActivitySection({ items }: { items: GrowthWorkspaceRecentView[] }) {
  if (items.length === 0) return null

  return (
    <GrowthEngineCard title="Recent Activity" data-section="recent-activity">
      <ul className="divide-y divide-border/70">
        {items.slice(0, 4).map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-primary"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.title}</p>
                {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
              </div>
              <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </GrowthEngineCard>
  )
}

function ContinueWorkingSection({ items }: { items: GrowthWorkspaceContinueItem[] }) {
  if (items.length === 0) return null

  return (
    <GrowthEngineCard title="Continue Working" data-section="continue-working">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex min-h-24 flex-col justify-between rounded-xl border border-border/80 p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div>
              <p className="font-medium text-foreground">{item.title}</p>
              {item.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p> : null}
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Continue
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </GrowthEngineCard>
  )
}

function QuickActionsSection() {
  const usage = useMemo(() => readGrowthWorkspaceQuickActionUsage(), [])
  const actions = useMemo(() => {
    const usageMap = new Map(usage.map((row) => [row.id, row]))
    return [...GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS].sort((a, b) => {
      const aScore = usageMap.get(a.id)?.count ?? 0
      const bScore = usageMap.get(b.id)?.count ?? 0
      if (aScore !== bScore) return bScore - aScore
      return a.label.localeCompare(b.label)
    })
  }, [usage])

  return (
    <GrowthEngineCard
      title="Quick Actions"
      data-section="quick-actions"
      data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTION_QA_MARKER}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.id}
              href={action.href}
              onClick={() => recordGrowthWorkspaceQuickActionUsage(action.id)}
              className="group flex min-h-[5.5rem] items-start gap-3 rounded-xl border border-border/80 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{action.label}</span>
                  {action.shortcut ? (
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {action.shortcut}
                    </span>
                  ) : null}
                </span>
                {action.description ? (
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{action.description}</span>
                ) : null}
              </span>
            </Link>
          )
        })}
      </div>
    </GrowthEngineCard>
  )
}

export function GrowthWorkspaceDashboardBody() {
  const { dashboard, loading, error, reload } = useGrowthWorkspaceDashboard()
  const recentViews = useMemo(() => readGrowthWorkspaceRecentViews(), [dashboard?.generatedAt])
  const continueItems = useMemo(() => readGrowthWorkspaceContinueItems(), [dashboard?.generatedAt])

  useGrowthWorkspaceQuickActionShortcuts(Boolean(dashboard))

  if (loading && !dashboard) {
    return (
      <div
        className="space-y-6"
        data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_QA_MARKER}
        data-workspace-dashboard-loading="true"
      >
        <Skeleton className="h-28 rounded-xl" />
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
      <WelcomeSection welcome={dashboard.welcome} briefing={dashboard.briefing} />

      <GrowthAutonomyStatusBanner />

      <OperatorActionCardsSection cards={dashboard.operatorActionCards} />
      <GrowthOperatorSetupHealthPanel compact />

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <p>Some dashboard sources were unavailable. Showing graceful fallbacks.</p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </div>
      ) : null}

      <RecentActivitySection items={recentViews} />
      <ContinueWorkingSection items={continueItems} />

      {metricSections.map((section) => (
        <MetricGrid key={section.id} section={section} />
      ))}

      <QuickActionsSection />
    </div>
  )
}

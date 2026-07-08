"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, Clock3, RefreshCw } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS,
  GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTION_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import { GeV15AutomationRuntimeApprovalInbox } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-inbox"
import { GrowthAutonomyStatusBanner } from "@/components/growth/autonomy/growth-autonomy-status-banner"
import { GrowthOperatorSetupHealthPanel } from "@/components/growth/operational/growth-operator-setup-health-panel"
import { GROWTH_WORKSPACE_DASHBOARD_QA_MARKER } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  readGrowthWorkspaceContinueItems,
  readGrowthWorkspaceQuickActionUsage,
  readGrowthWorkspaceRecentViews,
  recordGrowthWorkspaceQuickActionUsage,
  type GrowthWorkspaceContinueItem,
  type GrowthWorkspaceRecentView,
} from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"
import { GrowthHomeDebugFooter } from "@/components/growth/workspace/growth-home-debug-footer"
import { useGrowthWorkspaceQuickActionShortcuts } from "@/components/growth/workspace/use-growth-workspace-quick-action-shortcuts"
import { GrowthHomeExecutiveBriefingDashboard } from "@/components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function RecentActivitySection({ items }: { items: GrowthWorkspaceRecentView[] }) {
  if (items.length === 0) return null

  return (
    <GrowthEngineCard title="Recent activity" data-section="recent-activity">
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
    <GrowthEngineCard title="Continue working" data-section="continue-working">
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
      title="Quick actions"
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

function DashboardSectionSkeleton() {
  return <Skeleton className="h-40 rounded-xl" />
}

export function GrowthWorkspaceDashboardBody() {
  const { dashboard, avaConsole, loading, error, reload } = useGrowthWorkspaceDashboard()
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
        <Skeleton className="h-64 rounded-2xl" />
        <DashboardSectionSkeleton />
        <DashboardSectionSkeleton />
      </div>
    )
  }

  if (!dashboard) return null

  const everythingElse = (
    <>
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <p>Some dashboard sources were unavailable. Showing graceful fallbacks.</p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </div>
      ) : null}

      <GrowthAutonomyStatusBanner />
      <GeV15AutomationRuntimeApprovalInbox limit={10} />
      <GrowthOperatorSetupHealthPanel compact />
      <RecentActivitySection items={recentViews} />
      <ContinueWorkingSection items={continueItems} />
      <QuickActionsSection />
    </>
  )

  return (
    <div data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_QA_MARKER}>
      <GrowthHomeExecutiveBriefingDashboard
        dashboard={dashboard}
        avaConsole={avaConsole}
        recentViews={recentViews}
        continueItems={continueItems}
        everythingElse={everythingElse}
        onResearchLoopCompleted={() => void reload()}
      />
      <GrowthHomeDebugFooter />
    </div>
  )
}

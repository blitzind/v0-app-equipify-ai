"use client"

import Link from "next/link"
import { ArrowRight, Clock3 } from "lucide-react"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { Button } from "@/components/ui/button"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"
import {
  GROWTH_WORKSPACE_HUB_METRIC_EMPTY_DEFAULT,
  GROWTH_WORKSPACE_HUB_QA_MARKER,
} from "@/lib/growth/hubs/growth-workspace-hub-types"
import { readGrowthWorkspaceRecentViews } from "@/lib/growth/workspace/growth-workspace-activity-memory"
import { cn } from "@/lib/utils"
import {
  GROWTH_ACTION_FIRST_SUPPORTING_METRICS,
  GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-action-first-1f"

type GrowthWorkspaceHubPageProps = {
  manifest: GrowthWorkspaceHubManifest
  /** When true, render hub sections only — parent shell supplies page chrome. */
  embedded?: boolean
  /** When true, quick actions and drill-downs render before overview KPI metrics. */
  actionFirst?: boolean
}

function HubOverviewSection({
  manifest,
  metricsTitle = "Overview",
  sectionId = "overview",
}: GrowthWorkspaceHubPageProps & { metricsTitle?: string; sectionId?: string }) {
  return (
    <GrowthEngineCard title={metricsTitle} data-section={sectionId}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {manifest.overview.map((metric) => (
          <StatTile
            key={metric.id}
            label={metric.label}
            value={metric.emptyValue ?? GROWTH_WORKSPACE_HUB_METRIC_EMPTY_DEFAULT}
            hint={metric.hint}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Overview metrics populate as your workspace activity grows. Use quick actions and drill-downs below to get
        started.
      </p>
    </GrowthEngineCard>
  )
}

function HubQuickActionsSection({ manifest }: GrowthWorkspaceHubPageProps) {
  return (
    <GrowthEngineCard title="Quick Actions" data-section="quick-actions">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {manifest.quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                "group flex min-h-[5.5rem] items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                action.variant === "outline"
                  ? "border-border/80 hover:border-primary/30 hover:bg-muted/20"
                  : "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{action.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{action.description}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </GrowthEngineCard>
  )
}

function HubDrilldownSection({
  section,
}: {
  section: GrowthWorkspaceHubManifest["sections"][number]
}) {
  return (
    <GrowthEngineCard title={section.title} data-section={section.id}>
      <p className="mb-4 text-sm text-muted-foreground">{section.description}</p>
      {section.drilldowns?.length ? (
        <div className="space-y-2">
          {section.drilldowns.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {section.emptyHint ??
            "Nothing to show here yet — use the quick actions above to get started in this area."}
        </p>
      )}
    </GrowthEngineCard>
  )
}

function HubRecentActivitySection({ manifest }: GrowthWorkspaceHubPageProps) {
  const recentViews = readGrowthWorkspaceRecentViews().filter((item) => item.href.includes(`/${manifest.id}`))

  return (
    <GrowthEngineCard title="Recent Activity" data-section="recent-activity">
      {recentViews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Recent views for {manifest.title.toLowerCase()} destinations appear here after you navigate deeper in this
          browser session.
        </p>
      ) : (
        <ul className="space-y-2">
          {recentViews.slice(0, 6).map((item) => (
            <li key={`${item.href}-${item.viewedAt}`}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/80 px-4 py-3 transition-colors hover:bg-muted/20"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{item.label}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {new Date(item.viewedAt).toLocaleString()}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

function HubBody({ manifest, actionFirst = false }: GrowthWorkspaceHubPageProps) {
  const sectionNodes = manifest.sections
    .filter((section) => section.id !== "quick-actions" && section.id !== "overview")
    .map((section) =>
      section.id === "recent-activity" ? (
        <HubRecentActivitySection key={section.id} manifest={manifest} />
      ) : (
        <HubDrilldownSection key={section.id} section={section} />
      ),
    )

  if (actionFirst) {
    return (
      <div
        className="space-y-6"
        data-growth-workspace-hub={manifest.id}
        data-growth-action-first-order="actions-before-metrics"
        data-qa-marker={GROWTH_WORKSPACE_ACTION_FIRST_1F_QA_MARKER}
      >
        <HubQuickActionsSection manifest={manifest} />
        {sectionNodes}
        <HubOverviewSection
          manifest={manifest}
          metricsTitle={GROWTH_ACTION_FIRST_SUPPORTING_METRICS}
          sectionId="supporting-metrics"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6" data-growth-workspace-hub={manifest.id}>
      <HubOverviewSection manifest={manifest} />
      <HubQuickActionsSection manifest={manifest} />
      {sectionNodes}
    </div>
  )
}

export function GrowthWorkspaceHubBody({ manifest, actionFirst }: GrowthWorkspaceHubPageProps) {
  return <HubBody manifest={manifest} actionFirst={actionFirst} />
}

export function GrowthWorkspaceHubPage({ manifest, embedded = false, actionFirst = false }: GrowthWorkspaceHubPageProps) {
  if (embedded) {
    return (
      <div data-qa-marker={GROWTH_WORKSPACE_HUB_QA_MARKER} data-growth-workspace-hub={manifest.id}>
        <HubBody manifest={manifest} actionFirst={actionFirst} />
      </div>
    )
  }

  const Icon = manifest.icon
  const primaryAction = manifest.quickActions[0]

  return (
    <GrowthWorkspacePageContent
      data-qa-marker={GROWTH_WORKSPACE_HUB_QA_MARKER}
      data-growth-workspace-hub={manifest.id}
    >
      <GrowthWorkspacePageHeader
        title={manifest.title}
        description={manifest.description}
        icon={Icon}
        iconClassName={manifest.iconClassName}
        actions={
          primaryAction ? (
            <Button asChild size="sm">
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          ) : undefined
        }
      />

      <HubBody manifest={manifest} actionFirst={actionFirst} />
    </GrowthWorkspacePageContent>
  )
}

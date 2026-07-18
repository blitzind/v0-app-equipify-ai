"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useAdmin } from "@/lib/admin-store"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import { isGrowthWorkspaceFirstUx1aEnabledClient } from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import { synthesizeGrowthWorkspacePriorityFeed } from "@/lib/growth/workspace/ux-1a/growth-workspace-priority-feed-synthesizer"
import {
  GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER,
  type GrowthWorkspacePrimaryAction,
  type GrowthWorkspacePriorityItem,
  type GrowthWorkspaceProgressItem,
} from "@/lib/growth/workspace/ux-1a/growth-workspace-priority-feed-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
}

function PriorityRow({ item }: { item: GrowthWorkspacePriorityItem }) {
  const tone =
    item.kind === "blocker"
      ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
      : item.kind === "info"
        ? "border-border/70 bg-muted/20"
        : "border-primary/20 bg-primary/5"

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.subtitle}</p>
      </div>
      {item.href ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          {item.actionLabel}
          <ArrowRight className="size-3" aria-hidden />
        </span>
      ) : null}
    </>
  )

  if (!item.href) {
    return (
      <article className={cn("rounded-xl border px-4 py-3", tone)}>
        <div className="flex items-start justify-between gap-3">{content}</div>
      </article>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
        "hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        tone,
      )}
      aria-label={`${item.actionLabel}: ${item.title}. ${item.subtitle}`}
    >
      {content}
    </Link>
  )
}

function PrimaryActionButton({ action }: { action: GrowthWorkspacePrimaryAction }) {
  return (
    <Button asChild variant="secondary" className="h-auto min-h-11 w-full justify-between px-4 py-3 text-left">
      <Link href={action.href} aria-label={`${action.label}${action.description ? `: ${action.description}` : ""}`}>
        <span>
          <span className="block font-medium">{action.label}</span>
          {action.description ? (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground line-clamp-1">
              {action.description}
            </span>
          ) : null}
        </span>
        <ArrowRight className="size-4 shrink-0" aria-hidden />
      </Link>
    </Button>
  )
}

function ProgressRow({ item }: { item: GrowthWorkspaceProgressItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-foreground">{item.label}</span>
      <span className="sr-only">{item.status.replace(/_/g, " ")}</span>
    </li>
  )
}

export function GrowthWorkspacePriorityFeedDashboard({ dashboard, workspaceSummary }: Props) {
  const { teammate, hydrated } = useAiTeammateIdentity()
  const { sessionIdentity } = useAdmin()

  const feed = useMemo(
    () =>
      synthesizeGrowthWorkspacePriorityFeed({
        dashboard,
        workspaceSummary,
        teammate,
        operatorDisplayName: sessionIdentity?.displayName ?? dashboard.welcome.operatorName,
        teammateIdentityAvailable: hydrated,
      }),
    [dashboard, workspaceSummary, teammate, sessionIdentity?.displayName, hydrated],
  )

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER}
      data-growth-workspace-first-ux-1a="true"
      data-section="workspace-priority-feed"
      data-operator-action-cards="priority-feed"
    >
      <header className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6" data-section="workspace-hero">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{feed.hero.greeting}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base" data-section="workspace-hero-subline">
          {feed.hero.subline}
        </p>
      </header>

      <section aria-labelledby="workspace-priorities-heading" data-section="workspace-priorities">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="workspace-priorities-heading" className="text-lg font-semibold tracking-tight">
            Today&apos;s priorities
          </h2>
        </div>

        {feed.isCaughtUp ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            data-section="workspace-caught-up"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="font-medium text-foreground">{feed.caughtUpTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{feed.caughtUpMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2" data-section="workspace-priority-items">
            {feed.priorities.map((item) => (
              <PriorityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {feed.primaryActions.length > 0 ? (
        <section aria-labelledby="workspace-primary-actions-heading" data-section="workspace-primary-actions">
          <h2 id="workspace-primary-actions-heading" className="mb-3 text-lg font-semibold tracking-tight">
            Primary actions
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {feed.primaryActions.map((action) => (
              <PrimaryActionButton key={action.id} action={action} />
            ))}
          </div>
        </section>
      ) : null}

      {feed.recentProgress.length > 0 ? (
        <section
          aria-labelledby="workspace-recent-progress-heading"
          className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5"
          data-section="workspace-recent-progress"
        >
          <h2 id="workspace-recent-progress-heading" className="text-lg font-semibold tracking-tight">
            Recent progress
          </h2>
          <ul className="mt-2 divide-y divide-border/70">
            {feed.recentProgress.map((item) => (
              <ProgressRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/** Client helper for dashboard body branching. */
export function isGrowthWorkspacePriorityFeedActive(): boolean {
  return isGrowthWorkspaceFirstUx1aEnabledClient()
}

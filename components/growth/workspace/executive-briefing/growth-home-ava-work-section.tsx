"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, CircleDashed, PauseCircle } from "lucide-react"
import {
  GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildHomeRelationshipScaleLine,
  buildHomeWorkItemPresentation,
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
  type HomeWorkItemPresentation,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import { normalizeAvaWorkManagerResult } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import type { GrowthCanonicalOperatorProgressProjection } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import { GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import {
  AVA_WORK_MANAGER_BLOCKED_TITLE,
  AVA_WORK_MANAGER_COMPLETED_TODAY_TITLE,
  AVA_WORK_MANAGER_UP_NEXT_TITLE,
  AVA_WORK_MANAGER_WORKING_NOW_TITLE,
  GROWTH_WORK_MANAGER_QA_MARKER,
  type AvaWorkItem,
  type AvaWorkManagerResult,
} from "@/lib/growth/work-manager"

type Props = {
  workManager: AvaWorkManagerResult | null
  leadPool?: GrowthHomeLeadPoolSummary | null
  progress?: GrowthCanonicalOperatorProgressProjection | null
  eligibleLeadCount?: number | null
}

function WorkItemRow({ item }: { item: HomeWorkItemPresentation }) {
  const headline = item.companyName ?? item.title

  return (
    <li className="rounded-lg border border-border/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {item.href ? (
              <Link href={item.href} className="hover:text-primary hover:underline">
                {headline}
              </Link>
            ) : (
              headline
            )}
          </p>
          {item.companyName && item.title !== item.companyName ? (
            <p className="text-xs text-muted-foreground">{item.title}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {item.relationshipStage ? <span>{item.relationshipStage}</span> : null}
            {item.nextAction ? <span>Next: {item.nextAction}</span> : null}
          </div>
          {item.whyItMatters ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.whyItMatters}</p>
          ) : null}
        </div>
        {item.href ? (
          <Link
            href={item.href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
          >
            Open
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        ) : null}
      </div>
    </li>
  )
}

function WorkItemList({
  items,
  emptyLabel,
}: {
  items: AvaWorkItem[]
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <WorkItemRow key={item.id} item={buildHomeWorkItemPresentation(item)} />
      ))}
    </ul>
  )
}

export function GrowthHomeAvaWorkSection({ workManager, leadPool = null, progress = null, eligibleLeadCount = null }: Props) {
  const safeWorkManager = normalizeAvaWorkManagerResult(workManager)
  const hasWorkPlan = Boolean(safeWorkManager && safeWorkManager.work_plan.length > 0)
  const scaleLine = buildHomeRelationshipScaleLine(leadPool)

  const upNextItems = hasWorkPlan
    ? safeWorkManager!.work_plan
        .filter((entry) => entry.status === "ready" && entry.work_item_id !== safeWorkManager!.active_work?.id)
        .slice(0, 3)
        .map((entry) => safeWorkManager!.all_work_items.find((row) => row.id === entry.work_item_id))
        .filter((row): row is AvaWorkItem => Boolean(row))
    : []

  const activePresentation =
    safeWorkManager?.active_work != null
      ? buildHomeWorkItemPresentation(safeWorkManager.active_work)
      : null
  const wm = hasWorkPlan ? safeWorkManager! : null

  return (
    <section
      data-qa-section="home-ava-progress"
      data-qa-marker-operator-story={GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER}
      data-qa-marker-11a={GROWTH_WORK_MANAGER_QA_MARKER}
      data-qa-marker-16x={GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3 space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {progress?.title ?? "Progress"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {progress?.subtitle ?? "Background work and momentum across your accounts"}
        </p>
        {scaleLine ? <p className="text-sm text-muted-foreground">{scaleLine}</p> : null}
      </div>

      {!wm ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {eligibleLeadCount === 0
              ? GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY
              : "Nothing needs your attention in the queue right now. Launch or continue a mission and Ava will keep researching and preparing qualified opportunities."}
          </p>
          {eligibleLeadCount === 0 ? null : (
          <Link
            href={GROWTH_HOME_STARTUP_STEP_PATHS.findLeads}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300"
          >
            Find Leads
            <ArrowRight className="size-3" aria-hidden />
          </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
        {activePresentation ? (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              {AVA_WORK_MANAGER_WORKING_NOW_TITLE}
            </p>
            <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <WorkItemRow item={activePresentation} />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {AVA_WORK_MANAGER_UP_NEXT_TITLE}
          </p>
          <WorkItemList items={upNextItems} emptyLabel="No additional work queued." />
        </div>

        {wm.blocked.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {AVA_WORK_MANAGER_BLOCKED_TITLE}
            </p>
            <ul className="space-y-2">
              {wm.blocked.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/20 px-1 py-1 dark:border-amber-900/40 dark:bg-amber-950/10"
                >
                  <PauseCircle className="mt-3 ml-2 size-4 shrink-0 text-amber-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <WorkItemRow item={buildHomeWorkItemPresentation(item)} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {wm.completed_today.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {AVA_WORK_MANAGER_COMPLETED_TODAY_TITLE}
            </p>
            <ul className="space-y-1.5">
              {wm.completed_today.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{buildHomeWorkItemPresentation(item).companyName ?? item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        </div>
      )}
    </section>
  )
}

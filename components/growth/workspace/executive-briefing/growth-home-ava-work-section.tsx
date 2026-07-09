"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, CircleDashed, PauseCircle } from "lucide-react"
import {
  AVA_WORK_MANAGER_BLOCKED_TITLE,
  AVA_WORK_MANAGER_COMPLETED_TODAY_TITLE,
  AVA_WORK_MANAGER_TODAY_WORK_TITLE,
  AVA_WORK_MANAGER_UP_NEXT_TITLE,
  AVA_WORK_MANAGER_WAITING_ON_YOU_TITLE,
  AVA_WORK_MANAGER_WORKING_NOW_TITLE,
  GROWTH_WORK_MANAGER_QA_MARKER,
  type AvaWorkManagerResult,
} from "@/lib/growth/work-manager"

type Props = {
  workManager: AvaWorkManagerResult | null
}

function WorkList({
  items,
  emptyLabel,
}: {
  items: Array<{ id: string; title: string; href?: string | null }>
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-sm text-foreground">
          <CircleDashed className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary hover:underline">
              {item.title}
            </Link>
          ) : (
            <span>{item.title}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function GrowthHomeAvaWorkSection({ workManager }: Props) {
  if (!workManager || workManager.work_plan.length === 0) return null

  const upNext = workManager.work_plan
    .filter((entry) => entry.status === "ready" && entry.work_item_id !== workManager.active_work?.id)
    .slice(0, 3)
    .map((entry) => ({
      id: entry.work_item_id,
      title: entry.title,
      href: workManager.all_work_items.find((row) => row.id === entry.work_item_id)?.href ?? null,
    }))

  return (
    <section
      data-qa-section="home-ava-work"
      data-qa-marker-11a={GROWTH_WORK_MANAGER_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="mb-4 border-b border-border/50 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {AVA_WORK_MANAGER_TODAY_WORK_TITLE}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {workManager.active_work ? (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              {AVA_WORK_MANAGER_WORKING_NOW_TITLE}
            </p>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-200/70 bg-indigo-50/40 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <p className="text-sm font-medium text-foreground">{workManager.active_work.title}</p>
              {workManager.active_work.href ? (
                <Link
                  href={workManager.active_work.href}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
                >
                  Open
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {AVA_WORK_MANAGER_UP_NEXT_TITLE}
          </p>
          <WorkList items={upNext} emptyLabel="No additional work queued." />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {AVA_WORK_MANAGER_WAITING_ON_YOU_TITLE}
          </p>
          <WorkList
            items={workManager.operator_queue.slice(0, 4).map((item) => ({
              id: item.id,
              title: item.title,
              href: item.href,
            }))}
            emptyLabel="Nothing waiting on you."
          />
        </div>

        {workManager.blocked.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {AVA_WORK_MANAGER_BLOCKED_TITLE}
            </p>
            <ul className="space-y-1.5">
              {workManager.blocked.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-foreground">
                  <PauseCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {workManager.completed_today.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {AVA_WORK_MANAGER_COMPLETED_TODAY_TITLE}
            </p>
            <ul className="space-y-1.5">
              {workManager.completed_today.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

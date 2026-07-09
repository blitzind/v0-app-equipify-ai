"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  GROWTH_TRAINING_NAV_ITEMS,
  GROWTH_TRAINING_NAV_QA_MARKER,
  isGrowthTrainingNavItemActive,
} from "@/lib/growth/training/growth-training-workspace-navigation"
import {
  GROWTH_SALES_OPERATIONS_CENTER_ROUTE,
} from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "@/lib/growth/ava-about/growth-ava-about-workspace-types"
import {
  GROWTH_TRAINING_WORKSPACE_DESCRIPTION,
  GROWTH_TRAINING_WORKSPACE_TITLE,
} from "@/lib/growth/training/growth-training-workspace-types"

type GrowthTrainingShellProps = {
  children: ReactNode
}

export function GrowthTrainingShell({ children }: GrowthTrainingShellProps) {
  const pathname = usePathname() ?? ""

  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6"
      data-qa-marker={GROWTH_TRAINING_NAV_QA_MARKER}
      data-qa-section="training-workspace-shell"
    >
      <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{GROWTH_TRAINING_WORKSPACE_TITLE}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {GROWTH_TRAINING_WORKSPACE_DESCRIPTION}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={GROWTH_AVA_ABOUT_WORKSPACE_ROUTE}>
              About Your AI
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={GROWTH_SALES_OPERATIONS_CENTER_ROUTE}>
              Watch results in Operations
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Training sections" className="space-y-1">
          {GROWTH_TRAINING_NAV_ITEMS.map((item) => {
            const active = isGrowthTrainingNavItemActive(pathname, item)
            const Icon = item.icon
            if (item.future) {
              return (
                <div
                  key={item.id}
                  aria-disabled
                  className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/70"
                  data-training-nav-id={item.id}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Soon</span>
                </div>
              )
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-indigo-50 font-medium text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                data-training-nav-id={item.id}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

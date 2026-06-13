"use client"

import Link from "next/link"
import { Zap } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER,
  GROWTH_COMMAND_CENTER_QUICK_ACTIONS,
} from "@/lib/growth/command/command-center-quick-actions"
import { cn } from "@/lib/utils"

type GrowthCommandQuickActionsRailProps = {
  variant?: "rail" | "chips" | "section"
}

export function GrowthCommandQuickActionsRail({ variant = "rail" }: GrowthCommandQuickActionsRailProps) {
  if (variant === "chips") {
    return (
      <div data-qa-marker={GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER}>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {GROWTH_COMMAND_CENTER_QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "shrink-0 rounded-full border border-border/80 bg-background px-4 py-2 text-sm",
                "hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/30",
              )}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  if (variant === "section") {
    return (
      <div data-qa-marker={GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER}>
        <GrowthEngineCard title="Quick Actions" icon={<Zap className="size-4" />} className="shadow-sm">
          <ul
            className="grid items-stretch gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
          >
            {GROWTH_COMMAND_CENTER_QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <li key={action.href} className="h-full">
                  <Link
                    href={action.href}
                    className={cn(
                      "flex min-h-[120px] h-full flex-col justify-center gap-2 rounded-xl border border-border/80 px-4 py-4 text-sm transition-colors",
                      "hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/30",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{action.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </GrowthEngineCard>
      </div>
    )
  }

  return (
    <div data-qa-marker={GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER}>
      <GrowthEngineCard
        title="Quick Actions"
        icon={<Zap className="size-4" />}
        className="sticky top-4 p-5 shadow-sm sm:p-6 [&>div:first-child]:mb-5"
      >
        <ul className="grid gap-3">
          {GROWTH_COMMAND_CENTER_QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-border/80 px-4 py-3 text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/30"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  {action.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </GrowthEngineCard>
    </div>
  )
}

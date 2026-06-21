"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}

export function GrowthSendrBuilderEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/50 dark:border-slate-800 dark:from-slate-950/50 dark:via-slate-900 dark:to-slate-950/30",
        compact ? "px-5 py-6" : "px-6 py-10 sm:px-8 sm:py-12",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.06),transparent_55%)]" />
      <div className="relative flex flex-col items-center text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Icon className="size-7" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}

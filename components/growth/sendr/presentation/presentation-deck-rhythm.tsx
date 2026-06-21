"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PresentationDeckGap({ className }: { className?: string }) {
  return <div className={cn("h-2 sm:h-4", className)} aria-hidden />
}

export function PresentationDeckDivider({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 py-2", className)}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
      {label ? (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      ) : null}
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
    </div>
  )
}

export function PresentationFinaleCta({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-blue-500/15 bg-gradient-to-br from-blue-50/90 via-white to-slate-50 p-6 sm:p-8 dark:border-blue-500/20 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-950",
        className,
      )}
    >
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>
    </section>
  )
}

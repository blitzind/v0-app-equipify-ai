"use client"

import type { ReactNode } from "react"
import { GROWTH_SENDR_PRESENTATION_UX_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-presentation-config"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
}

export function PresentationPageShell({ children, className }: Props) {
  return (
    <div
      className={cn("min-h-screen bg-slate-100/80 px-3 py-6 sm:px-6 sm:py-10 dark:bg-slate-950", className)}
      data-qa-marker={GROWTH_SENDR_PRESENTATION_UX_QA_MARKER}
    >
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgb(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgb(0,0,0,0.45)]">
        {children}
      </div>
    </div>
  )
}

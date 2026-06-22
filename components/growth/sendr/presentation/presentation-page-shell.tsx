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
      className={cn("min-h-screen px-3 py-6 sm:px-6 sm:py-10", className)}
      style={{ backgroundColor: "var(--sendr-page-bg)", color: "var(--sendr-page-text)" }}
      data-qa-marker={GROWTH_SENDR_PRESENTATION_UX_QA_MARKER}
    >
      <div
        className="mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border shadow-[0_24px_80px_rgb(0,0,0,0.08)]"
        style={{
          backgroundColor: "var(--sendr-surface)",
          borderColor: "color-mix(in srgb, var(--sendr-page-text) 12%, transparent)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

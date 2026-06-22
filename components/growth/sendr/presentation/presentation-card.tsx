"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
  variant?: "default" | "muted" | "elevated"
}

export function PresentationCard({ children, className, variant = "default" }: Props) {
  return (
    <div
      className={cn("rounded-2xl border p-5 sm:p-6", variant === "elevated" && "shadow-[0_12px_40px_rgb(0,0,0,0.06)]", className)}
      style={{
        backgroundColor:
          variant === "muted"
            ? "color-mix(in srgb, var(--sendr-page-bg) 65%, var(--sendr-surface))"
            : "var(--sendr-surface)",
        borderColor: "color-mix(in srgb, var(--sendr-page-text) 12%, transparent)",
        color: "var(--sendr-page-text)",
      }}
    >
      {children}
    </div>
  )
}

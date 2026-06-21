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
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        variant === "default" && "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900",
        variant === "muted" && "border-slate-200/60 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40",
        variant === "elevated" &&
          "border-slate-200/80 bg-white shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_12px_40px_rgb(0,0,0,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

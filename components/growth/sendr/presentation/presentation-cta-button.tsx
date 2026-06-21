"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { GROWTH_SENDR_PRESENTATION_ACCENT } from "@/lib/growth/sendr/growth-sendr-presentation-config"

type Props = {
  href: string
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  size?: "default" | "large"
  fullWidth?: boolean
  className?: string
}

export function PresentationCtaButton({
  href,
  children,
  onClick,
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200",
        "hover:-translate-y-0.5 active:translate-y-0",
        size === "default" && "min-h-11 px-6 py-2.5 text-sm",
        size === "large" && "min-h-[3.25rem] px-8 py-3 text-base",
        fullWidth && "w-full",
        variant === "primary" &&
          "text-white shadow-[0_8px_24px_rgb(37,99,235,0.35)] hover:shadow-[0_12px_32px_rgb(37,99,235,0.45)]",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800",
        variant === "ghost" &&
          "border border-white/20 bg-white/5 text-white shadow-none hover:border-white/30 hover:bg-white/10",
        className,
      )}
      style={variant === "primary" ? { backgroundColor: GROWTH_SENDR_PRESENTATION_ACCENT } : undefined}
    >
      {children}
    </a>
  )
}

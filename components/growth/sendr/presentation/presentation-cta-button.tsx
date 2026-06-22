"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

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
        variant === "primary" && "shadow-[0_8px_24px_rgb(0,0,0,0.18)] hover:shadow-[0_12px_32px_rgb(0,0,0,0.24)]",
        variant === "secondary" &&
          "border shadow-sm hover:opacity-95",
        variant === "ghost" &&
          "border shadow-none hover:opacity-95",
        className,
      )}
      style={
        variant === "primary"
          ? { backgroundColor: "var(--sendr-button-bg)", color: "var(--sendr-button-text)" }
          : variant === "ghost"
            ? {
                borderColor: "color-mix(in srgb, var(--sendr-header-text) 25%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--sendr-header-text) 8%, transparent)",
                color: "var(--sendr-header-text)",
              }
            : {
                borderColor: "color-mix(in srgb, var(--sendr-page-text) 15%, transparent)",
                backgroundColor: "var(--sendr-surface)",
                color: "var(--sendr-page-text)",
              }
      }
    >
      {children}
    </a>
  )
}

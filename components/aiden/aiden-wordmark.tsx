"use client"

import { cn } from "@/lib/utils"

/** Visual emphasis on “AI” per Equipify AIden branding; written name stays “AIden”. */
export function AidenWordmark({
  className,
  size = "md",
  tone = "default",
}: {
  className?: string
  /** Text size: sm ≈ text-sm, md ≈ text-base, lg ≈ text-lg */
  size?: "sm" | "md" | "lg"
  /** Use `inverse` on filled AI-blue buttons (white label). */
  tone?: "default" | "inverse"
}) {
  const sz =
    size === "sm" ? "text-sm" : size === "lg" ? "text-lg font-semibold tracking-tight" : "text-base font-semibold tracking-tight"
  return (
    <span className={cn("inline-flex items-baseline gap-0", sz, className)} translate="no">
      <span
        className={cn(
          "font-extrabold tracking-tight",
          tone === "inverse"
            ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            : "text-sky-600 dark:text-sky-400",
        )}
      >
        AI
      </span>
      <span
        className={cn(
          "font-semibold",
          tone === "inverse" ? "text-white/95" : "text-foreground",
        )}
      >
        den
      </span>
    </span>
  )
}

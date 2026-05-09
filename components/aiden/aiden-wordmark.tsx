"use client"

import { cn } from "@/lib/utils"

/** Visual emphasis on “AI” per Equipify AIden branding; written name stays “AIden”. */
export function AidenWordmark({
  className,
  size = "md",
}: {
  className?: string
  /** Text size: sm ≈ text-sm, md ≈ text-base, lg ≈ text-lg */
  size?: "sm" | "md" | "lg"
}) {
  const sz =
    size === "sm" ? "text-sm" : size === "lg" ? "text-lg font-semibold tracking-tight" : "text-base font-semibold tracking-tight"
  return (
    <span className={cn("inline-flex items-baseline gap-0", sz, className)} translate="no">
      <span className="font-bold text-sky-600 dark:text-sky-400">AI</span>
      <span className="font-semibold text-foreground">den</span>
    </span>
  )
}

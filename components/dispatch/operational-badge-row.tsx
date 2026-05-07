"use client"

import { cn } from "@/lib/utils"
import type { OperationalBadge } from "@/lib/dispatch/operational-badges"
import { badgeToneClasses } from "@/lib/dispatch/operational-badges"

/** Compact badge strip for dispatch cards and drawer (max `cap` badges). */
export function OperationalBadgeRow({
  badges,
  cap = 4,
  className,
}: {
  badges: OperationalBadge[]
  cap?: number
  className?: string
}) {
  const shown = badges.slice(0, cap)
  if (shown.length === 0) return null
  return (
    <div className={cn("flex flex-wrap gap-0.5", className)} aria-label="Operational indicators">
      {shown.map((b) => (
        <span
          key={b.key}
          className={cn(
            "inline-flex max-w-[9rem] truncate rounded border px-1 py-px text-[9px] font-medium leading-tight",
            badgeToneClasses(b.tone),
          )}
          title={b.label}
        >
          {b.label}
        </span>
      ))}
      {badges.length > cap ? (
        <span className="text-[9px] font-medium text-muted-foreground">+{badges.length - cap}</span>
      ) : null}
    </div>
  )
}

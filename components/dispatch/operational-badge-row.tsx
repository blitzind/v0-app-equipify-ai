"use client"

import { cn } from "@/lib/utils"
import type { OperationalBadge } from "@/lib/dispatch/operational-badges"
import { badgeToneClasses } from "@/lib/dispatch/operational-badges"

/**
 * Compact badge strip for dispatch cards and drawer.
 *
 * Phase 3 tweaks:
 *   - Default `cap` lowered from 4 → 3 so cards don't clutter.
 *   - Overflow indicator renders the hidden labels in a `title` tooltip so
 *     dispatchers can still see every signal without expanding the card.
 *
 * `cap = Infinity` (or a large number) restores legacy behavior for surfaces
 * like the work-order drawer where space is not constrained.
 */
export function OperationalBadgeRow({
  badges,
  cap = 3,
  className,
}: {
  badges: OperationalBadge[]
  cap?: number
  className?: string
}) {
  const shown = badges.slice(0, cap)
  if (shown.length === 0) return null
  const overflow = Math.max(0, badges.length - cap)
  const overflowLabels = overflow > 0 ? badges.slice(cap).map((b) => b.label).join(" · ") : ""
  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", className)} aria-label="Operational indicators">
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
      {overflow > 0 ? (
        <span
          className="inline-flex shrink-0 cursor-help rounded border border-border bg-muted/40 px-1 py-px text-[9px] font-medium leading-tight text-muted-foreground"
          title={overflowLabels}
          aria-label={`${overflow} more operational signals: ${overflowLabels}`}
        >
          +{overflow} more
        </span>
      ) : null}
    </div>
  )
}

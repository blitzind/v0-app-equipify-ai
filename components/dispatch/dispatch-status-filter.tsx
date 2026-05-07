"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_ORDER,
  type DispatchStatusKey,
} from "@/lib/dispatch/status-filter"

/**
 * Phase 1: chip strip for the dispatch + service-schedule status quick filter.
 *
 * Multi-select; shared between dispatch page and the (mobile) compact list.
 * Filtering is applied client-side; this component does NOT alter fetch
 * semantics. The `invoiced` chip is opt-in and the dispatch page widens the
 * Supabase status `in (...)` only when that chip is enabled.
 */
export function DispatchStatusFilter({
  selected,
  onToggle,
  counts,
  includeInvoiced,
  onIncludeInvoicedChange,
  className,
}: {
  selected: DispatchStatusKey[]
  onToggle: (key: DispatchStatusKey) => void
  counts?: Partial<Record<DispatchStatusKey, number>>
  includeInvoiced: boolean
  onIncludeInvoicedChange: (next: boolean) => void
  className?: string
}) {
  const set = new Set(selected)
  const visibleKeys: DispatchStatusKey[] = DISPATCH_STATUS_ORDER.filter(
    (k) => k !== "invoiced" || includeInvoiced,
  )

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Status quick filter"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mr-1">
        Status
      </span>
      {visibleKeys.map((k) => {
        const active = set.has(k)
        const count = counts?.[k]
        return (
          <Button
            key={k}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 px-2.5 text-xs shrink-0",
              // Selected = primary (blue) tinted state; reserves CTA orange for "+ Quick add" only.
              active &&
                "border-primary bg-primary/10 text-primary shadow-sm hover:bg-primary/15 hover:text-primary",
            )}
            onClick={() => onToggle(k)}
            aria-pressed={active}
          >
            <span>{DISPATCH_STATUS_LABELS[k]}</span>
            {typeof count === "number" ? (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
          </Button>
        )
      })}
      <label
        className={cn(
          "ml-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none",
        )}
        title="Include invoiced work orders in the dispatch view"
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 align-middle"
          checked={includeInvoiced}
          onChange={(e) => onIncludeInvoicedChange(e.target.checked)}
        />
        Include invoiced
      </label>
    </div>
  )
}

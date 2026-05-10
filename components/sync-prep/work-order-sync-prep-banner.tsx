"use client"

import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { ONLINE_REQUIRED_LABEL, SYNC_PREP_COPY } from "@/lib/sync-prep"

/**
 * Mobile-first explanation: current saves are network-backed; no offline queue yet.
 * Hidden at lg+ so desktop layout stays unchanged.
 */
export function WorkOrderSyncPrepBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "lg:hidden shrink-0 border-b border-border bg-muted/25 dark:bg-muted/10 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex gap-2.5 text-[11px] text-muted-foreground leading-snug">
        <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-foreground text-xs">{SYNC_PREP_COPY.workOrderDrawerBannerTitle}</p>
          <p>{SYNC_PREP_COPY.workOrderDrawerBannerBody}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200 pt-0.5">
            {ONLINE_REQUIRED_LABEL} — no queued replay yet
          </p>
        </div>
      </div>
    </div>
  )
}

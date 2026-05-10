"use client"

import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { SYNC_PREP_COPY } from "@/lib/sync-prep"

export type WorkOrderSyncPrepBannerProps = {
  className?: string
  /** Browser online/offline (Phase 53B). */
  networkOnline?: boolean
  /** Pending local technician bundle for this work order. */
  hasPendingOffline?: boolean
  offlineStatus?: "queued" | "failed" | "conflict" | "syncing" | null
}

/**
 * Mobile-first sync / offline guidance. Hidden at lg+ so desktop layout stays unchanged.
 */
export function WorkOrderSyncPrepBanner({
  className,
  networkOnline = true,
  hasPendingOffline = false,
  offlineStatus = null,
}: WorkOrderSyncPrepBannerProps) {
  const stateLine = (() => {
    if (!networkOnline) return "Offline — technician drafts can still be saved on this device."
    if (offlineStatus === "conflict") return "Review conflict — server changed since your draft started."
    if (offlineStatus === "failed") return "Last sync failed — open the sync bar to retry or discard."
    if (hasPendingOffline) return "Sync pending — use Sync now when you are ready (no auto-sync)."
    return "Online — technician-safe fields support offline drafts when signal drops."
  })()

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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-0.5">
            {stateLine}
          </p>
        </div>
      </div>
    </div>
  )
}

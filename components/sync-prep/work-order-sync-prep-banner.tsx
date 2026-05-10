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
  /** Queued image count (device-only until Sync now). */
  pendingPhotoCount?: number
  offlineStatus?: "queued" | "failed" | "conflict" | "syncing" | null
}

/**
 * Mobile-first sync / offline guidance. Hidden at lg+ so desktop layout stays unchanged.
 */
export function WorkOrderSyncPrepBanner({
  className,
  networkOnline = true,
  hasPendingOffline = false,
  pendingPhotoCount = 0,
  offlineStatus = null,
}: WorkOrderSyncPrepBannerProps) {
  const photoBit =
    pendingPhotoCount > 0
      ? pendingPhotoCount === 1
        ? " · 1 photo waiting to upload"
        : ` · ${pendingPhotoCount} photos waiting to upload`
      : ""

  const stateLine = (() => {
    if (!networkOnline)
      return `No connection — technician-safe edits still save on this device.${photoBit}`
    if (offlineStatus === "conflict") return `Compare versions — server changed since this draft.${photoBit}`
    if (offlineStatus === "failed")
      return `Last send didn’t finish — use the bar above to retry or clear the device draft.${photoBit}`
    if (offlineStatus === "syncing") return `Sending to server — keep this screen open.${photoBit}`
    if (hasPendingOffline) return `Not on server yet — tap Sync now when you’re ready.${photoBit}`
    return `Connected — drafts can be saved on device if you lose signal.${photoBit}`
  })()

  return (
    <div
      role="note"
      className={cn(
        "lg:hidden shrink-0 border-b border-border bg-muted/25 dark:bg-muted/10 px-3 py-2",
        className,
      )}
    >
      <div className="flex gap-2 text-[11px] text-muted-foreground leading-snug">
        <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-foreground text-xs">{SYNC_PREP_COPY.workOrderDrawerBannerTitle}</p>
          <p>{SYNC_PREP_COPY.workOrderDrawerBannerBody}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90 pt-0.5 border-t border-border/60 mt-1">
            {stateLine}
          </p>
        </div>
      </div>
    </div>
  )
}

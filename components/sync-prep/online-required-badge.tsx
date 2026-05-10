"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ONLINE_REQUIRED_LABEL, SYNC_PREP_COPY } from "@/lib/sync-prep"

export type TechnicianSyncBadgeMode =
  | "online-required"
  | "offline-draft-supported"
  | "saved-locally"
  | "sync-pending"
  | "syncing"
  | "review-conflict"
  | "sync-failed"

const MODE_STYLES: Record<TechnicianSyncBadgeMode, string> = {
  "online-required":
    "border-amber-500/35 text-amber-900 dark:text-amber-100",
  "offline-draft-supported":
    "border-emerald-600/35 text-emerald-900 dark:text-emerald-100 bg-emerald-500/5",
  "saved-locally": "border-sky-600/35 text-sky-900 dark:text-sky-100 bg-sky-500/5",
  "sync-pending": "border-violet-600/35 text-violet-900 dark:text-violet-100 bg-violet-500/5",
  syncing: "border-blue-600/35 text-blue-900 dark:text-blue-100 bg-blue-500/5",
  "review-conflict": "border-amber-600/40 text-amber-900 dark:text-amber-100 bg-amber-500/8",
  "sync-failed": "border-amber-600/40 text-amber-900 dark:text-amber-100 bg-amber-500/8",
}

function modeLabel(mode: TechnicianSyncBadgeMode): string {
  switch (mode) {
    case "offline-draft-supported":
      return SYNC_PREP_COPY.offlineDraftSupportedLabel
    case "saved-locally":
      return SYNC_PREP_COPY.savedLocallyLabel
    case "sync-pending":
      return SYNC_PREP_COPY.syncPendingLabel
    case "syncing":
      return SYNC_PREP_COPY.syncInProgressLabel
    case "review-conflict":
      return SYNC_PREP_COPY.reviewConflictLabel
    case "sync-failed":
      return SYNC_PREP_COPY.syncFailedLabel
    default:
      return ONLINE_REQUIRED_LABEL
  }
}

function modeTooltip(mode: TechnicianSyncBadgeMode): string {
  switch (mode) {
    case "offline-draft-supported":
      return SYNC_PREP_COPY.offlineDraftSupportedTooltip
    case "saved-locally":
      return SYNC_PREP_COPY.savedLocallyTooltip
    case "sync-pending":
      return SYNC_PREP_COPY.syncPendingTooltip
    case "syncing":
      return SYNC_PREP_COPY.syncInProgressTooltip
    case "review-conflict":
      return SYNC_PREP_COPY.reviewConflictTooltip
    case "sync-failed":
      return SYNC_PREP_COPY.syncFailedTooltip
    default:
      return SYNC_PREP_COPY.onlineRequiredTooltip
  }
}

export function OnlineRequiredBadge({
  className,
  mode = "online-required",
}: {
  className?: string
  /** When not `online-required`, shows Phase 53B technician offline / sync state. */
  mode?: TechnicianSyncBadgeMode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-semibold cursor-help shrink-0",
            MODE_STYLES[mode],
            className,
          )}
        >
          {modeLabel(mode)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {modeTooltip(mode)}
      </TooltipContent>
    </Tooltip>
  )
}

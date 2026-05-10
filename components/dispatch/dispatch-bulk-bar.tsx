"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DispatchBulkDialogTab } from "@/components/dispatch/dispatch-bulk-review-dialog"

export function DispatchBulkBar({
  selectedCount,
  onClear,
  onSelectVisible,
  canManageDispatch,
  canEditStatus,
  onOpenDialog,
}: {
  selectedCount: number
  onClear: () => void
  onSelectVisible: () => void
  canManageDispatch: boolean
  canEditStatus: boolean
  onOpenDialog: (tab: DispatchBulkDialogTab) => void
}) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-1 flex flex-col gap-2 border-t border-border bg-card/95 px-2 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:-mx-0 sm:rounded-lg sm:border sm:shadow-sm",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
      role="region"
      aria-label="Bulk dispatch actions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          <span className="tabular-nums">{selectedCount}</span>{" "}
          {selectedCount === 1 ? "job" : "jobs"} selected
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onSelectVisible}>
            Select visible
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {canManageDispatch ? (
          <>
            <Button
              type="button"
              size="sm"
              className="h-9 min-h-[36px] flex-1 text-xs sm:flex-none"
              onClick={() => onOpenDialog("assign")}
            >
              Assign tech
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 min-h-[36px] flex-1 text-xs sm:flex-none"
              onClick={() => onOpenDialog("unassign")}
            >
              Remove assignment
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-h-[36px] flex-1 text-xs sm:flex-none"
              onClick={() => onOpenDialog("date")}
            >
              Set date
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-h-[36px] flex-1 text-xs sm:flex-none"
              onClick={() => onOpenDialog("time")}
            >
              Set time
            </Button>
          </>
        ) : null}
        {canEditStatus ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-h-[36px] flex-1 text-xs sm:flex-none"
            onClick={() => onOpenDialog("status")}
          >
            Set status
          </Button>
        ) : null}
      </div>
    </div>
  )
}

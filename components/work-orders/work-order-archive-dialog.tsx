"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type WorkOrderArchiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "archive" | "restore" | "bulk-archive"
  busy?: boolean
  selectedCount?: number
  onConfirm: () => void | Promise<void>
}

export function WorkOrderArchiveDialog({
  open,
  onOpenChange,
  mode,
  busy = false,
  selectedCount = 0,
  onConfirm,
}: WorkOrderArchiveDialogProps) {
  const isBulkArchive = mode === "bulk-archive"
  const isArchive = mode === "archive" || isBulkArchive

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulkArchive
              ? "Archive selected work orders?"
              : isArchive
                ? "Delete work order?"
                : "Restore work order?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulkArchive ? (
              <>
                This removes the selected work orders from active queues. You can restore them later from Settings →
                Archived.
                {selectedCount > 0 ? (
                  <>
                    {" "}
                    <span className="font-medium text-foreground">{selectedCount} selected.</span>
                  </>
                ) : null}
              </>
            ) : isArchive ? (
              <>
                This removes the work order from active lists and dispatch queues. It is not permanently deleted —
                service history, certificates, and linked records are kept. You can restore it later from Settings →
                Archived.
              </>
            ) : (
              <>This returns the work order to active lists and dispatch views.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant={isArchive ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void onConfirm()}
            className="gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isBulkArchive ? "Archive work orders" : isArchive ? "Archive work order" : "Restore work order"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

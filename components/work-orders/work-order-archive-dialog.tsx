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
  mode: "archive" | "restore"
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function WorkOrderArchiveDialog({
  open,
  onOpenChange,
  mode,
  busy = false,
  onConfirm,
}: WorkOrderArchiveDialogProps) {
  const isArchive = mode === "archive"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isArchive ? "Delete work order?" : "Restore work order?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isArchive ? (
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
            {isArchive ? "Archive work order" : "Restore work order"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

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

type ProspectBulkArchiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function ProspectBulkArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  busy = false,
  onConfirm,
}: ProspectBulkArchiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive selected prospects?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the selected prospects from active lists. Activity history and source details
            are preserved.
            {selectedCount > 0 ? (
              <>
                {" "}
                <span className="font-medium text-foreground">{selectedCount} selected.</span>
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Archive prospects
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

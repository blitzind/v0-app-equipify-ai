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

type InvoiceBulkArchiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function InvoiceBulkArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  busy = false,
  onConfirm,
}: InvoiceBulkArchiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive selected invoices?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the selected invoices from active lists. Payment history, customer history,
            and exported accounting records are preserved.
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
            Archive invoices
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

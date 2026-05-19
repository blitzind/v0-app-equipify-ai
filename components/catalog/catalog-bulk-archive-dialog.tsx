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

type CatalogBulkArchiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function CatalogBulkArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  busy = false,
  onConfirm,
}: CatalogBulkArchiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive selected catalog items?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the selected items from the active catalog. Existing quotes, invoices, work orders, and
            purchase orders keep their historical item details.
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
            Archive catalog items
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

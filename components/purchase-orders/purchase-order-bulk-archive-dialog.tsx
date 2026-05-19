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

type PurchaseOrderBulkArchiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

export function PurchaseOrderBulkArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  busy = false,
  onConfirm,
}: PurchaseOrderBulkArchiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive selected purchase orders?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the selected purchase orders from active lists. Vendor, inventory, and
            purchasing history are preserved.
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
            Archive purchase orders
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

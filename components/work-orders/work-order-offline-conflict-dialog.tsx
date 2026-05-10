"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"
import {
  fetchWorkOrderOfflineBaseline,
  type WorkOrderOfflineServerBaseline,
} from "@/lib/work-orders/offline/replay-drawer"
import type { WorkOrderOfflineBundlePayload, WorkOrderOfflineOutboxRecord } from "@/lib/work-orders/offline/types"

function baselineRepairSummary(b: WorkOrderOfflineServerBaseline): {
  problem: string
  notes: string
  diagnosis: string
  techNotes: string
  status: string
} {
  const parsed = parseRepairLog(b.repairLog)
  const columnProblem = typeof b.problemReported === "string" ? b.problemReported.trim() : ""
  const problem = columnProblem !== "" ? columnProblem : (parsed.problemReported ?? "")
  return {
    problem,
    notes: b.notes ?? "",
    diagnosis: parsed.diagnosis ?? "",
    techNotes: parsed.technicianNotes ?? "",
    status: b.status,
  }
}

export function WorkOrderOfflineConflictDialog({
  open,
  onOpenChange,
  organizationId,
  workOrderId,
  record,
  intro,
  onDiscardLocal,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  organizationId: string | null
  workOrderId: string | null
  record: WorkOrderOfflineOutboxRecord | null
  intro?: string | null
  onDiscardLocal: () => Promise<void>
}) {
  const [server, setServer] = useState<WorkOrderOfflineServerBaseline | null>(null)

  useEffect(() => {
    if (!open || !organizationId || !workOrderId) {
      setServer(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const b = await fetchWorkOrderOfflineBaseline(supabase, organizationId, workOrderId)
      if (!cancelled) setServer(b)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, workOrderId])

  const payload = (record?.payload ?? null) as WorkOrderOfflineBundlePayload | null
  const srv = server ? baselineRepairSummary(server) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review conflict</DialogTitle>
          <DialogDescription>
            {intro ??
              "The work order changed on the server after this draft started. Compare copies — sync will not overwrite the server automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="font-semibold text-foreground">Your local draft</p>
            {payload?.repair ? (
              <dl className="space-y-1.5 text-muted-foreground">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Problem</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{payload.repair.problemReported || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Diagnosis</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{payload.repair.diagnosis || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Technician notes</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{payload.repair.technicianNotes || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Internal notes</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{payload.repair.notesInternal || "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground">No repair text in this draft.</p>
            )}
            {payload?.tasks ? (
              <p className="text-muted-foreground pt-1">
                Tasks: {payload.tasks.length} item(s) in JSON bundle
              </p>
            ) : null}
            {payload?.statusInProgress ? (
              <p className="text-amber-800 dark:text-amber-200 font-medium">Includes: mark job in progress</p>
            ) : null}
            {(payload?.pendingPhotos?.length ?? 0) > 0 ? (
              <p className="text-sky-800 dark:text-sky-200 pt-1 font-medium">
                {payload!.pendingPhotos!.length} technician photo(s) queued on this device (not on the server until you
                sync successfully — discard deletes them from this device).
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="font-semibold text-foreground">Latest on server</p>
            {!srv ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <dl className="space-y-1.5 text-muted-foreground">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Status (db)</dt>
                  <dd className="text-foreground">{srv.status}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Problem</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{srv.problem || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Diagnosis</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{srv.diagnosis || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Technician notes</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{srv.techNotes || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Internal notes column</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{srv.notes || "—"}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDiscardLocal().then(() => onOpenChange(false))}
          >
            Discard local draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

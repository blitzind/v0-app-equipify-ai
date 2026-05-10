"use client"

import { useEffect, useMemo, useState } from "react"
import {
  buildBulkDispatchReview,
  BULK_DISPATCH_STATUS_OPTIONS,
  partitionBulkDispatchSelection,
  type BulkDispatchFormAction,
} from "@/lib/dispatch/bulk-dispatch"
import type { DispatchTech, DispatchWo } from "@/components/dispatch/dispatch-board"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type DispatchBulkDialogTab = "assign" | "unassign" | "date" | "time" | "status"

const TAB_LABEL: Record<DispatchBulkDialogTab, string> = {
  assign: "Assign",
  unassign: "Unassign",
  date: "Date",
  time: "Time",
  status: "Status",
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ")
}

export function DispatchBulkReviewDialog({
  open,
  onOpenChange,
  initialTab,
  selectedIds,
  displayWorkOrders,
  technicians,
  selectedYmd,
  assignedOnlyUser,
  canManageDispatch,
  canEditStatus,
  busy,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab: DispatchBulkDialogTab
  selectedIds: string[]
  displayWorkOrders: DispatchWo[]
  technicians: DispatchTech[]
  selectedYmd: string
  assignedOnlyUser: boolean
  canManageDispatch: boolean
  canEditStatus: boolean
  busy: boolean
  onApply: (action: BulkDispatchFormAction, eligible: DispatchWo[]) => Promise<void>
}) {
  const [tab, setTab] = useState<DispatchBulkDialogTab>(initialTab)
  const [assignTechId, setAssignTechId] = useState<string>("")
  const [assignDate, setAssignDate] = useState(selectedYmd)
  const [assignTime, setAssignTime] = useState("")
  const [dateOnly, setDateOnly] = useState(selectedYmd)
  const [timeOnly, setTimeOnly] = useState("09:00")
  const [clearTime, setClearTime] = useState(false)
  const [statusTarget, setStatusTarget] = useState<(typeof BULK_DISPATCH_STATUS_OPTIONS)[number]>("scheduled")

  const workOrdersById = useMemo(() => {
    const m = new Map<string, DispatchWo>()
    for (const w of displayWorkOrders) m.set(w.id, w)
    return m
  }, [displayWorkOrders])

  const allowedTabs: DispatchBulkDialogTab[] = useMemo(() => {
    const t: DispatchBulkDialogTab[] = []
    if (canManageDispatch) {
      t.push("assign", "unassign", "date", "time")
    }
    if (canEditStatus) {
      t.push("status")
    }
    return t
  }, [canManageDispatch, canEditStatus])

  useEffect(() => {
    if (!open) return
    setAssignDate(selectedYmd)
    setDateOnly(selectedYmd)
    setAssignTechId((prev) => {
      if (prev && technicians.some((t) => t.id === prev)) return prev
      return technicians[0]?.id ?? ""
    })
    const next = allowedTabs.includes(initialTab) ? initialTab : (allowedTabs[0] ?? "status")
    setTab(next)
  }, [open, initialTab, selectedYmd, technicians, allowedTabs])

  const draftAction = useMemo((): BulkDispatchFormAction | null => {
    if (!canManageDispatch && tab !== "status") return null
    if (tab === "status" && !canEditStatus) return null

    switch (tab) {
      case "assign": {
        if (!assignTechId.trim()) return null
        const t = assignTime.trim()
        return {
          kind: "assign_technician",
          technicianUserId: assignTechId.trim(),
          scheduledOn: assignDate.trim().slice(0, 10) || selectedYmd,
          scheduledTimeHhMm: t.length >= 4 ? t.slice(0, 5) : null,
        }
      }
      case "unassign":
        return { kind: "unassign" }
      case "date": {
        const d = dateOnly.trim().slice(0, 10)
        if (!d) return null
        return { kind: "set_scheduled_date", scheduledOn: d }
      }
      case "time":
        return {
          kind: "set_scheduled_time",
          scheduledTimeHhMm: clearTime ? null : timeOnly.trim().slice(0, 5) || null,
        }
      case "status":
        return { kind: "set_status", targetStatus: statusTarget }
      default:
        return null
    }
  }, [
    tab,
    assignTechId,
    assignDate,
    assignTime,
    dateOnly,
    timeOnly,
    clearTime,
    statusTarget,
    selectedYmd,
    canManageDispatch,
    canEditStatus,
  ])

  const partition = useMemo(() => {
    if (!draftAction) return { eligible: [] as DispatchWo[], skipped: [] as { workOrderId: string; reason: string }[] }
    return partitionBulkDispatchSelection({
      selectedIds,
      workOrdersById,
      action: draftAction,
    })
  }, [draftAction, selectedIds, workOrdersById])

  const review = useMemo(() => {
    if (!draftAction) {
      return null
    }
    return buildBulkDispatchReview({
      action: draftAction,
      eligible: partition.eligible,
      skipped: partition.skipped,
      allWorkOrders: displayWorkOrders,
      technicians,
      selectedYmd,
      assignedOnlyUser,
    })
  }, [
    draftAction,
    partition.eligible,
    partition.skipped,
    displayWorkOrders,
    technicians,
    selectedYmd,
    assignedOnlyUser,
  ])

  async function handleApply() {
    if (!draftAction || partition.eligible.length === 0) return
    await onApply(draftAction, partition.eligible)
  }

  const applyDisabled =
    busy || !draftAction || partition.eligible.length === 0 || (tab === "assign" && !assignTechId.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
        )}
      >
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle>Bulk dispatch review</DialogTitle>
          <DialogDescription>
            Confirm what will change for the selected jobs. Warnings are informational only and do not block
            updates.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {allowedTabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">You do not have permission for bulk dispatch actions.</p>
          ) : (
            <Tabs
              value={tab}
              onValueChange={(v) => {
                if (allowedTabs.includes(v as DispatchBulkDialogTab)) {
                  setTab(v as DispatchBulkDialogTab)
                }
              }}
              className="flex flex-col gap-3"
            >
              <TabsList
                className={cn(
                  "flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1",
                  allowedTabs.length > 3 && "sm:grid sm:grid-cols-3",
                )}
              >
                {allowedTabs.map((id) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="flex-1 px-2 py-1.5 text-xs data-[state=active]:bg-background"
                  >
                    {TAB_LABEL[id]}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="assign" className="mt-0 space-y-3 outline-none">
                <div className="space-y-2">
                  <Label htmlFor="bulk-assign-tech">Technician</Label>
                  <Select value={assignTechId} onValueChange={setAssignTechId}>
                    <SelectTrigger id="bulk-assign-tech" className="h-10 w-full">
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-assign-date">Scheduled date</Label>
                  <Input
                    id="bulk-assign-date"
                    type="date"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-assign-time">Time (optional)</Label>
                  <Input
                    id="bulk-assign-time"
                    type="time"
                    value={assignTime}
                    onChange={(e) => setAssignTime(e.target.value)}
                    className="h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">Leave empty to clear the scheduled time.</p>
                </div>
              </TabsContent>

              <TabsContent value="unassign" className="mt-0 outline-none">
                <p className="text-sm text-muted-foreground">
                  Removes the technician from each eligible job. Scheduled dates and times stay as they are.
                </p>
              </TabsContent>

              <TabsContent value="date" className="mt-0 space-y-3 outline-none">
                <div className="space-y-2">
                  <Label htmlFor="bulk-date">New scheduled date</Label>
                  <Input
                    id="bulk-date"
                    type="date"
                    value={dateOnly}
                    onChange={(e) => setDateOnly(e.target.value)}
                    className="h-10"
                  />
                </div>
              </TabsContent>

              <TabsContent value="time" className="mt-0 space-y-3 outline-none">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-clear-time"
                    checked={clearTime}
                    onCheckedChange={(v) => setClearTime(Boolean(v))}
                  />
                  <Label htmlFor="bulk-clear-time" className="text-sm font-normal">
                    Clear scheduled time
                  </Label>
                </div>
                {!clearTime ? (
                  <div className="space-y-2">
                    <Label htmlFor="bulk-time">Time</Label>
                    <Input
                      id="bulk-time"
                      type="time"
                      value={timeOnly}
                      onChange={(e) => setTimeOnly(e.target.value)}
                      className="h-10"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Jobs without a date use the selected dispatch day ({selectedYmd}) as the scheduled date.
                    </p>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="status" className="mt-0 space-y-3 outline-none">
                <div className="space-y-2">
                  <Label>Target status</Label>
                  <Select
                    value={statusTarget}
                    onValueChange={(v) =>
                      setStatusTarget(v as (typeof BULK_DISPATCH_STATUS_OPTIONS)[number])
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BULK_DISPATCH_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only planning statuses are available here. Use the work order page for completion or invoicing.
                </p>
              </TabsContent>
            </Tabs>
          )}

          {review ? (
            <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                {review.intentSummaryLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <p className="text-sm">
                <span className="font-medium tabular-nums text-foreground">{review.eligible.length}</span>{" "}
                job(s) will be updated
                {review.skipped.length > 0 ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium tabular-nums text-muted-foreground">{review.skipped.length}</span>{" "}
                    skipped
                  </>
                ) : null}
              </p>
              {review.affectedTechnicianLabels.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Affected technicians:{" "}
                  <span className="font-medium text-foreground">{review.affectedTechnicianLabels.join(", ")}</span>
                </p>
              ) : null}
              {review.globalWarnings.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">Warnings</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {review.globalWarnings.map((w) => (
                      <li key={w} className="flex gap-1">
                        <span aria-hidden>·</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {review.skipped.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Skipped records</p>
                  <ScrollArea className="max-h-28 rounded border border-border/60 bg-background/80">
                    <ul className="space-y-1 p-2 text-xs text-muted-foreground">
                      {review.skipped.map((s) => (
                        <li key={s.workOrderId}>
                          <span className="font-mono text-[10px] text-foreground">{s.workOrderId.slice(0, 8)}…</span>{" "}
                          — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleApply()} disabled={applyDisabled}>
            {busy ? "Applying…" : "Apply changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

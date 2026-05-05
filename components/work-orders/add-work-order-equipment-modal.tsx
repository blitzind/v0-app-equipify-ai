"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { DrawerSection } from "@/components/detail-drawer"

const PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]
const TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

type EquipmentRow = {
  id: string
  name: string
  equipment_code: string | null
  serial_number: string | null
  category: string | null
  manufacturer: string | null
  location_label: string | null
}

type PerAssetJob = {
  type: WorkOrderType
  priority: WorkOrderPriority
  problemReported: string
  notes: string
}

function defaultJob(defaultType: WorkOrderType, defaultPriority: WorkOrderPriority): PerAssetJob {
  return {
    type: defaultType,
    priority: defaultPriority,
    problemReported: "",
    notes: "",
  }
}

function matchesSearch(e: EquipmentRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const blob = [
    e.name,
    e.equipment_code,
    e.serial_number,
    e.manufacturer,
    e.category,
    e.location_label,
  ]
    .map((x) => (x ?? "").toLowerCase())
    .join(" ")
  const tokens = q.split(/\s+/).filter(Boolean)
  return tokens.every((t) => blob.includes(t))
}

export interface AddWorkOrderEquipmentModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  organizationId: string
  customerId: string
  workOrderId: string
  /** Equipment already linked (including legacy primary); those ids are hidden and cannot be inserted again. */
  excludeEquipmentIds: string[]
  defaultWorkType: WorkOrderType
  defaultPriority: WorkOrderPriority
}

export function AddWorkOrderEquipmentModal({
  open,
  onClose,
  onSuccess,
  organizationId,
  customerId,
  workOrderId,
  excludeEquipmentIds,
  defaultWorkType,
  defaultPriority,
}: AddWorkOrderEquipmentModalProps) {
  const [equipmentList, setEquipmentList] = useState<EquipmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  const [jobByEquipmentId, setJobByEquipmentId] = useState<Record<string, PerAssetJob>>({})

  const excludeSet = useMemo(() => new Set(excludeEquipmentIds), [excludeEquipmentIds])

  useEffect(() => {
    if (!open) return
    setSearch("")
    setSelectedEquipmentIds([])
    setJobByEquipmentId({})
    setLoadError(null)
    setSubmitError(null)
  }, [open, workOrderId])

  useEffect(() => {
    if (!open || !organizationId || !customerId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("equipment")
        .select("id, name, equipment_code, serial_number, category, manufacturer, location_label")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .eq("is_archived", false)
        .order("name", { ascending: true })
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setEquipmentList([])
      } else {
        setLoadError(null)
        setEquipmentList((data ?? []) as EquipmentRow[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId])

  const visibleList = useMemo(() => {
    return equipmentList.filter((e) => !excludeSet.has(e.id)).filter((e) => matchesSearch(e, search))
  }, [equipmentList, excludeSet, search])

  const toggleEquipment = useCallback(
    (eqId: string) => {
      setSelectedEquipmentIds((prev) => {
        if (prev.includes(eqId)) {
          setJobByEquipmentId((j) => {
            const { [eqId]: _, ...rest } = j
            return rest
          })
          return prev.filter((x) => x !== eqId)
        }
        setJobByEquipmentId((j) => ({
          ...j,
          [eqId]: j[eqId] ?? defaultJob(defaultWorkType, defaultPriority),
        }))
        return [...prev, eqId]
      })
    },
    [defaultPriority, defaultWorkType],
  )

  function setJobForEquipment(equipmentId: string, patch: Partial<PerAssetJob>) {
    setJobByEquipmentId((prev) => ({
      ...prev,
      [equipmentId]: { ...(prev[equipmentId] ?? defaultJob(defaultWorkType, defaultPriority)), ...patch },
    }))
  }

  async function handleSave() {
    if (!organizationId || selectedEquipmentIds.length === 0) return
    setSubmitError(null)
    setSubmitting(true)
    const supabase = createBrowserSupabaseClient()

    for (const eqId of selectedEquipmentIds) {
      if (excludeSet.has(eqId)) {
        setSubmitError("One of the selected assets is already on this work order. Refresh and try again.")
        setSubmitting(false)
        return
      }
      const job = jobByEquipmentId[eqId] ?? defaultJob(defaultWorkType, defaultPriority)
      const { error } = await supabase.from("work_order_equipment").insert({
        organization_id: organizationId,
        work_order_id: workOrderId,
        equipment_id: eqId,
        work_type: uiTypeToDb(job.type),
        priority: uiPriorityToDb(job.priority),
        problem_reported: job.problemReported.trim() || null,
        notes: job.notes.trim() || null,
      })
      if (error) {
        const dup =
          error.code === "23505" ||
          (error.message && /unique|duplicate/i.test(error.message))
        setSubmitError(
          dup
            ? "That equipment is already on this work order."
            : error.message,
        )
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    onSuccess?.()
    onClose()
  }

  const jobsComplete =
    selectedEquipmentIds.length > 0 &&
    selectedEquipmentIds.every((id) => {
      const j = jobByEquipmentId[id]
      return j && TYPES.includes(j.type) && PRIORITIES.includes(j.priority)
    })

  const canSave =
    Boolean(organizationId) &&
    selectedEquipmentIds.length > 0 &&
    jobsComplete &&
    !loading &&
    !loadError

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-4xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[92vh] overflow-y-auto gap-0 p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader className="space-y-1">
            <DialogTitle>Add equipment to work order</DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-6 px-6 pb-6">
          {loadError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {loadError}
            </p>
          )}
          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {submitError}
            </p>
          )}

          <DrawerSection
            title="Search & select"
            action={
              <span className="text-xs font-medium tabular-nums text-muted-foreground normal-case tracking-normal">
                {selectedEquipmentIds.length} selected
              </span>
            }
          >
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Showing assets for this work order&apos;s customer. Search by name, model / code, serial number, or
              manufacturer.
            </p>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, model, serial, code…"
              className="mb-3 bg-white dark:bg-card"
            />

            <div
              className={cn(
                "max-h-[min(320px,42vh)] overflow-y-auto rounded-lg border border-border bg-muted/20",
                "shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]",
              )}
            >
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 px-4 text-center">Loading equipment…</p>
              ) : visibleList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 px-4 text-center">
                  {equipmentList.filter((e) => !excludeSet.has(e.id)).length === 0
                    ? "No additional equipment available for this customer."
                    : "No equipment matches your search."}
                </p>
              ) : (
                <ul className="p-2 sm:p-3 space-y-2.5">
                  {visibleList.map((e) => {
                    const checked = selectedEquipmentIds.includes(e.id)
                    const job = jobByEquipmentId[e.id] ?? defaultJob(defaultWorkType, defaultPriority)
                    const displayName = (e.name ?? "").trim() || "Equipment"
                    const modelCode = (e.equipment_code ?? "").trim() || "—"
                    const serial = (e.serial_number ?? "").trim() || "—"
                    const manufacturer = (e.manufacturer ?? "").trim() || "—"
                    const category = (e.category ?? "").trim() || "—"
                    const loc = (e.location_label ?? "").trim() || "—"
                    return (
                      <li
                        key={e.id}
                        className={cn(
                          "rounded-lg border px-3 py-3 sm:px-4 sm:py-3.5 transition-colors",
                          checked
                            ? "border-primary/35 bg-primary/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            : "border-border/90 bg-card/40 hover:bg-muted/30",
                        )}
                      >
                        <div className="flex flex-col gap-3">
                          <label className="flex gap-2.5 items-start cursor-pointer text-left">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 rounded border-border"
                              checked={checked}
                              onChange={() => toggleEquipment(e.id)}
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-sm font-semibold text-foreground leading-snug">{displayName}</p>
                              <div className="space-y-0.5 text-xs text-muted-foreground leading-relaxed">
                                <p>
                                  <span className="text-muted-foreground/80">Model / code:</span> {modelCode}
                                </p>
                                <p>
                                  <span className="text-muted-foreground/80">Serial number:</span> {serial}
                                </p>
                                <p>
                                  <span className="text-muted-foreground/80">Manufacturer:</span> {manufacturer}
                                </p>
                                <p>
                                  <span className="text-muted-foreground/80">Category / location:</span>{" "}
                                  {[category, loc].filter((x) => x && x !== "—").join(" · ") || "—"}
                                </p>
                              </div>
                            </div>
                          </label>

                          <div
                            className={cn(
                              "pt-3 border-t border-border/70 space-y-2",
                              !checked && "opacity-45 pointer-events-none",
                            )}
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-foreground">Work type</Label>
                                <Select
                                  value={job.type}
                                  disabled={!checked}
                                  onValueChange={(v) => setJobForEquipment(e.id, { type: v as WorkOrderType })}
                                >
                                  <SelectTrigger className="w-full h-9 bg-white dark:bg-card">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TYPES.map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium text-foreground">Priority</Label>
                                <Select
                                  value={job.priority}
                                  disabled={!checked}
                                  onValueChange={(v) => setJobForEquipment(e.id, { priority: v as WorkOrderPriority })}
                                >
                                  <SelectTrigger className="w-full h-9 bg-white dark:bg-card">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRIORITIES.map((p) => (
                                      <SelectItem key={p} value={p}>
                                        {p}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-medium text-foreground">Problem / notes (optional)</Label>
                              <Textarea
                                value={job.problemReported}
                                disabled={!checked}
                                onChange={(ev) => setJobForEquipment(e.id, { problemReported: ev.target.value })}
                                placeholder="Problem reported for this asset…"
                                rows={2}
                                className="text-sm bg-white dark:bg-card resize-y min-h-[52px]"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-medium text-foreground">Internal notes (optional)</Label>
                              <Textarea
                                value={job.notes}
                                disabled={!checked}
                                onChange={(ev) => setJobForEquipment(e.id, { notes: ev.target.value })}
                                placeholder="Technician or office notes for this asset…"
                                rows={2}
                                className="text-sm bg-white dark:bg-card resize-y min-h-[52px]"
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </DrawerSection>
        </div>

        <DialogFooter className="px-6 pb-6 pt-0 gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave || submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Add to work order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

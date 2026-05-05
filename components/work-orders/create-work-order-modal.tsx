"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { AddEquipmentModal } from "@/components/equipment/add-equipment-modal"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import { DrawerSection } from "@/components/detail-drawer"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  /** When the modal opens, pre-select this customer (e.g. deep link from customer profile). */
  initialCustomerId?: string | null
  /** After equipment loads for the customer, select this asset when present in the list. */
  initialEquipmentId?: string | null
}

const PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]
const TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

type CustomerOption = { id: string; company_name: string }
type EquipmentOption = {
  id: string
  name: string
  equipment_code: string | null
  serial_number: string | null
  category: string | null
}
type TechnicianOption = { id: string; label: string; avatarUrl?: string | null }

type PerEquipmentJob = {
  type: WorkOrderType
  priority: WorkOrderPriority
}

function defaultJob(): PerEquipmentJob {
  return { type: "Repair", priority: "Normal" }
}

function initialsFromLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function CreateWorkOrderModal({
  open,
  onClose,
  onSuccess,
  initialCustomerId = null,
  initialEquipmentId = null,
}: Props) {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const organizationId = orgStatus === "ready" ? activeOrgId : null
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)

  const [customerId, setCustomerId] = useState("")
  /** Primary asset is `selectedEquipmentIds[0]` for `work_orders.equipment_id`; all IDs are stored in `work_order_equipment`. */
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  /** Per-equipment type & priority when that row is selected (defaults seeded when selected). */
  const [jobByEquipmentId, setJobByEquipmentId] = useState<Record<string, PerEquipmentJob>>({})
  const [technicianId, setTechnicianId] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("08:00")
  const [description, setDescription] = useState("")
  const [problemReported, setProblemReported] = useState("")

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      setLoadError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) {
          setCustomers([])
          setTechnicians([])
        }
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setCustomers([])
          setTechnicians([])
          setLoadError(
            orgStatus === "ready" && !activeOrgId ? "No organization selected." : null,
          )
        }
        return
      }

      const orgId = activeOrgId

      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("company_name")

      if (custError || cancelled) {
        if (!cancelled) setLoadError(custError?.message ?? "Failed to load customers.")
        return
      }

      if (!cancelled) setCustomers((custRows as CustomerOption[]) ?? [])

      const { data: memberRows, error: memberError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", ["owner", "admin", "manager", "tech"])

      if (memberError || cancelled) {
        if (!cancelled && memberError) setLoadError(memberError.message)
        return
      }

      const userIds = [...new Set((memberRows ?? []).map((m: { user_id: string }) => m.user_id))]
      let techOptions: TechnicianOption[] = []

      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userIds)

        techOptions =
          ((profRows as Array<{
            id: string
            full_name: string | null
            email: string | null
            avatar_url: string | null
          }> | null) ?? []).map((p) => ({
            id: p.id,
            label:
              (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Team member",
            avatarUrl: p.avatar_url?.trim() || null,
          }))
        techOptions.sort((a, b) => a.label.localeCompare(b.label))
      }

      if (!cancelled) setTechnicians(techOptions)
    })()

    return () => {
      cancelled = true
    }
  }, [open, orgStatus, activeOrgId])

  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCustomerId(initialCustomerId ?? "")
    }
    prevOpenRef.current = open
    if (!open) prevOpenRef.current = false
  }, [open, initialCustomerId])

  useEffect(() => {
    if (!open) {
      setAddEquipmentOpen(false)
    }
  }, [open])

  /** Seed default type/priority when equipmentIds gain new selections. */
  useEffect(() => {
    setJobByEquipmentId((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of selectedEquipmentIds) {
        if (!next[id]) {
          next[id] = defaultJob()
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selectedEquipmentIds])

  const refreshEquipmentForCustomer = useCallback(
    async (opts?: { organizationId: string; customerId: string; selectEquipmentId?: string }) => {
      const orgId = opts?.organizationId ?? organizationId
      const custId = opts?.customerId ?? customerId
      const selectId = opts?.selectEquipmentId
      if (!orgId || !custId) return

      const supabase = createBrowserSupabaseClient()
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select("id, name, equipment_code, serial_number, category")
        .eq("organization_id", orgId)
        .eq("customer_id", custId)
        .eq("status", "active")
        .eq("is_archived", false)
        .order("name")

      if (eqError) {
        setEquipmentList([])
        return
      }
      const list = (eqRows as EquipmentOption[]) ?? []
      setEquipmentList(list)
      if (selectId && list.some((e) => e.id === selectId)) {
        setSelectedEquipmentIds([selectId])
      }
    },
    [organizationId, customerId]
  )

  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      if (!customerId) {
        setEquipmentList([])
        setEquipmentLoading(false)
      }
      return
    }

    let cancelled = false
    setEquipmentLoading(true)
    void (async () => {
      await refreshEquipmentForCustomer({
        organizationId,
        customerId,
        selectEquipmentId: initialEquipmentId ?? undefined,
      })
      if (!cancelled) setEquipmentLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId, initialEquipmentId, refreshEquipmentForCustomer])

  const selectedCustomerName = customers.find((c) => c.id === customerId)?.company_name ?? ""

  function setJobForEquipment(equipmentId: string, patch: Partial<PerEquipmentJob>) {
    setJobByEquipmentId((prev) => ({
      ...prev,
      [equipmentId]: { ...(prev[equipmentId] ?? defaultJob()), ...patch },
    }))
  }

  function toggleEquipment(eqId: string) {
    setSelectedEquipmentIds((prev) =>
      prev.includes(eqId) ? prev.filter((x) => x !== eqId) : [...prev, eqId],
    )
  }

  async function handleSubmit() {
    if (
      !customerId ||
      selectedEquipmentIds.length === 0 ||
      !technicianId ||
      !scheduledDate ||
      !description.trim() ||
      !problemReported.trim()
    ) {
      return
    }
    if (!organizationId) return

    const primaryEquipmentId = selectedEquipmentIds[0]!
    const primaryJob = jobByEquipmentId[primaryEquipmentId] ?? defaultJob()
    for (const id of selectedEquipmentIds) {
      if (!jobByEquipmentId[id]) {
        return
      }
    }

    setSubmitError(null)
    setSubmitting(true)

    const supabase = createBrowserSupabaseClient()

    const problemText = problemReported.trim()

    const { data: inserted, error: insertError } = await supabase
      .from("work_orders")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        equipment_id: primaryEquipmentId,
        title: description.trim(),
        status: "open",
        priority: uiPriorityToDb(primaryJob.priority),
        type: uiTypeToDb(primaryJob.type),
        scheduled_on: scheduledDate,
        scheduled_time: normalizeTimeForDb(scheduledTime),
        notes: null,
        problem_reported: problemText,
        assigned_user_id: technicianId,
        repair_log: {
          problemReported: problemText,
          diagnosis: "",
          partsUsed: [],
          laborHours: 0,
          technicianNotes: "",
          photos: [],
          signatureDataUrl: "",
          signedBy: "",
          signedAt: "",
        },
      })
      .select("id")
      .single()

    if (insertError) {
      setSubmitting(false)
      setSubmitError(insertError.message)
      return
    }

    const woId = inserted?.id as string
    const uniqueIds = [...new Set(selectedEquipmentIds)]
    for (const eqId of uniqueIds) {
      const job = jobByEquipmentId[eqId] ?? defaultJob()
      const { error: woeErr } = await supabase.from("work_order_equipment").insert({
        organization_id: organizationId,
        work_order_id: woId,
        equipment_id: eqId,
        work_type: uiTypeToDb(job.type),
        priority: uiPriorityToDb(job.priority),
        problem_reported: problemText,
        notes: null,
      })
      if (woeErr) {
        setSubmitting(false)
        setSubmitError(woeErr.message)
        return
      }
    }

    setSubmitting(false)

    onSuccess?.()
    handleClose()
  }

  function handleClose() {
    setAddEquipmentOpen(false)
    setCustomerId("")
    setSelectedEquipmentIds([])
    setJobByEquipmentId({})
    setTechnicianId("")
    setScheduledDate("")
    setScheduledTime("08:00")
    setDescription("")
    setProblemReported("")
    setSubmitError(null)
    setLoadError(null)
    onClose()
  }

  function handleOpenAddEquipment() {
    if (!customerId) return
    setAddEquipmentOpen(true)
  }

  function handleAddEquipmentClose() {
    setAddEquipmentOpen(false)
  }

  async function handleAddEquipmentSuccess(newId?: string) {
    if (organizationId && customerId) {
      await refreshEquipmentForCustomer({
        organizationId,
        customerId,
        selectEquipmentId: newId,
      })
    }
  }

  const jobsCompleteForSelection =
    selectedEquipmentIds.length > 0 &&
    selectedEquipmentIds.every((id) => {
      const j = jobByEquipmentId[id]
      return j && TYPES.includes(j.type) && PRIORITIES.includes(j.priority)
    })

  const valid =
    organizationId &&
    customerId &&
    selectedEquipmentIds.length > 0 &&
    jobsCompleteForSelection &&
    technicianId &&
    scheduledDate &&
    description.trim() &&
    problemReported.trim() &&
    !loadError

  const woDialogOpen = open && !addEquipmentOpen

  const primaryEquipmentLabel =
    selectedEquipmentIds.length > 0 && equipmentList.length > 0
      ? (() => {
          const first = equipmentList.find((e) => e.id === selectedEquipmentIds[0])
          return first ? getEquipmentDisplayPrimary(first) : null
        })()
      : null

  return (
    <>
      <Dialog
        open={woDialogOpen}
        onOpenChange={(v) => {
          if (!v && !addEquipmentOpen) handleClose()
        }}
      >
        <DialogContent className="max-w-4xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[92vh] overflow-y-auto gap-0 p-0">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader className="space-y-1">
              <DialogTitle>Create Work Order</DialogTitle>
            </DialogHeader>
          </div>

          <div className="grid gap-6 px-6 pb-2">
            {loadError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {loadError}
              </p>
            )}

            <DrawerSection title="Customer">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-wo-customer">
                  Customer <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v)
                    setSelectedEquipmentIds([])
                    setJobByEquipmentId({})
                  }}
                >
                  <SelectTrigger id="create-wo-customer" className="w-full max-w-none bg-white dark:bg-card">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerSection>

            <DrawerSection
              title="Equipment & job details"
              action={
                <span className="text-xs font-medium tabular-nums text-muted-foreground normal-case tracking-normal">
                  {selectedEquipmentIds.length} selected
                </span>
              }
            >
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select one or more assets. Type and priority apply per asset. The{" "}
                <span className="font-medium text-foreground">first selected</span> asset is the primary equipment on the
                work order
                {primaryEquipmentLabel ? (
                  <span>
                    {" "}
                    (
                    <span className="font-medium text-foreground">{primaryEquipmentLabel}</span>).
                  </span>
                ) : (
                  "."
                )}
              </p>

              <div
                className={cn(
                  "max-h-[min(320px,42vh)] overflow-y-auto rounded-lg border border-border bg-muted/20",
                  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]",
                )}
              >
                {!customerId || equipmentLoading ? (
                  <p className="text-sm text-muted-foreground py-8 px-4 text-center">
                    {!customerId ? "Select a customer first." : "Loading equipment…"}
                  </p>
                ) : equipmentList.length === 0 ? (
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-muted-foreground text-center">No equipment found for this customer.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleOpenAddEquipment}
                    >
                      + Add Equipment
                    </Button>
                  </div>
                ) : (
                  <ul className="p-2 sm:p-3 space-y-2.5">
                    {equipmentList.map((e) => {
                      const checked = selectedEquipmentIds.includes(e.id)
                      const job = jobByEquipmentId[e.id] ?? defaultJob()
                      const displayName = (e.name ?? "").trim() || "Equipment"
                      const modelCode = (e.equipment_code ?? "").trim() || "—"
                      const serial = (e.serial_number ?? "").trim() || "—"
                      const category = (e.category ?? "").trim() || "—"
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
                                    <span className="text-muted-foreground/80">Category / location:</span>{" "}
                                    {[category, selectedCustomerName].filter((x) => x && x !== "—").join(" · ") ||
                                      "—"}
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
                                    onValueChange={(v) =>
                                      setJobForEquipment(e.id, { priority: v as WorkOrderPriority })
                                    }
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
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {customerId && !equipmentLoading && equipmentList.length > 0 && (
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={handleOpenAddEquipment}>
                    + Add Equipment
                  </Button>
                </div>
              )}
            </DrawerSection>

            <DrawerSection title="Scheduling">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-1.5 md:col-span-1">
                  <Label>
                    Assign technician <span className="text-destructive">*</span>
                  </Label>
                  <Select value={technicianId} onValueChange={setTechnicianId}>
                    <SelectTrigger className="w-full bg-white dark:bg-card">
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="cursor-pointer">
                          <span className="flex items-center gap-2">
                            <TechnicianAvatar
                              userId={t.id}
                              name={t.label}
                              initials={initialsFromLabel(t.label)}
                              avatarUrl={t.avatarUrl}
                              size="xs"
                            />
                            <span className="truncate">{t.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Scheduled date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="bg-white dark:bg-card"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Scheduled time</Label>
                  <Input
                    type="time"
                    className="bg-white dark:bg-card"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </DrawerSection>

            <DrawerSection title="Description">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-wo-desc">
                    Work description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="create-wo-desc"
                    placeholder="Describe the work to be performed…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-wo-problem">
                    Problem reported <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="create-wo-problem"
                    placeholder="What problem did the customer report? (Required for dispatch and history.)"
                    value={problemReported}
                    onChange={(e) => setProblemReported(e.target.value)}
                    rows={3}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Stored on the work order and copied to each selected asset row for traceability.
                  </p>
                </div>
              </div>
            </DrawerSection>

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {submitError}
              </p>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/10 gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!valid || submitting}>
              Create Work Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddEquipmentModal
        open={addEquipmentOpen}
        onClose={handleAddEquipmentClose}
        onSuccess={(id) => handleAddEquipmentSuccess(id)}
        prefilledCustomerId={customerId || null}
        offerMaintenancePlanNext={false}
      />
    </>
  )
}

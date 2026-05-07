"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, ChevronDown, Clock, Loader2, MapPin, User, Wrench, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { toastRecordEligibilityBlocked } from "@/lib/billing/guard-toast"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { DRAWER_BACKDROP_Z, EQUIPIFY_SCRIM } from "@/components/detail-drawer"

/**
 * Phase 1 quick-create scheduling flow.
 *
 * Speed-optimized appointment dialog tailored for the dispatch board:
 * - prefills date / technician / time when invoked from a slot
 * - minimal field set (customer, equipment, time, priority)
 * - reuses existing `workOrderAssignmentColumns` + `buildSchedulePatch`
 *   semantics so the work order created here is identical to one created
 *   from the full Schedule Service drawer
 *
 * Does NOT replace `ScheduleServiceDrawer` — this is the fast path; the full
 * drawer remains available for richer flows (notifications, locations, etc.).
 */

type CustomerOption = { id: string; company_name: string }
type EquipmentOption = {
  id: string
  name: string
  location_label: string | null
  equipment_code: string | null
  serial_number: string | null
  category: string | null
}
type TechnicianOption = { id: string; label: string }

type Props = {
  open: boolean
  onClose: () => void
  defaultDate: string | null
  defaultTimeHhMm: string | null
  defaultTechnicianId: string | null
  technicians: TechnicianOption[]
  onCreated?: () => void
}

const SERVICE_TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]
const PRIORITIES: WorkOrderPriority[] = ["Normal", "High", "Critical", "Low"]

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function QuickAppointmentDialog({
  open,
  onClose,
  defaultDate,
  defaultTimeHhMm,
  defaultTechnicianId,
  technicians,
  onCreated,
}: Props) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { standardCreateEligibility } = useBillingAccess()

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [equipment, setEquipment] = useState<EquipmentOption[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [serviceType, setServiceType] = useState<WorkOrderType>("Repair")
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal")
  const [date, setDate] = useState<string>(defaultDate ?? todayYmd())
  const [timeHhMm, setTimeHhMm] = useState<string>(defaultTimeHhMm ?? "09:00")
  const [technicianId, setTechnicianId] = useState<string>(defaultTechnicianId ?? "")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) return
    setCustomerId("")
    setEquipmentId("")
    setServiceType("Repair")
    setPriority("Normal")
    setDate(defaultDate ?? todayYmd())
    setTimeHhMm(defaultTimeHhMm ?? "09:00")
    setTechnicianId(defaultTechnicianId ?? "")
    setNotes("")
    setSubmitError(null)
  }, [open, defaultDate, defaultTimeHhMm, defaultTechnicianId])

  useEffect(() => {
    if (!open || !organizationId || orgStatus !== "ready") return
    let cancelled = false
    void (async () => {
      setLoadingRefs(true)
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("company_name")
      if (cancelled) return
      setCustomers((data as CustomerOption[]) ?? [])
      setLoadingRefs(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, orgStatus])

  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      setEquipment([])
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase
        .from("equipment")
        .select("id, name, location_label, equipment_code, serial_number, category")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("name")
      if (cancelled) return
      setEquipment((data as EquipmentOption[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId])

  const selectedEquipmentLabel = useMemo(() => {
    const eq = equipment.find((e) => e.id === equipmentId)
    if (!eq) return null
    return getEquipmentDisplayPrimary({
      id: eq.id,
      name: eq.name,
      equipment_code: eq.equipment_code,
      serial_number: eq.serial_number,
      category: eq.category,
    })
  }, [equipment, equipmentId])

  const selectedEquipmentLocation = useMemo(
    () => equipment.find((e) => e.id === equipmentId)?.location_label?.trim() ?? null,
    [equipment, equipmentId],
  )

  const canSubmit =
    !!organizationId &&
    !!customerId &&
    !!equipmentId &&
    !!date &&
    !!timeHhMm &&
    !submitting &&
    orgStatus === "ready"

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !organizationId) return
    if (toastRecordEligibilityBlocked(standardCreateEligibility)) return

    const serverGate = await enforceCanCreateRecord(organizationId, "work_order")
    if (!serverGate.ok) {
      setSubmitError(serverGate.message)
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const supabase = createBrowserSupabaseClient()
    const assign = await workOrderAssignmentColumns(supabase, organizationId, technicianId || null)
    const trimmedNotes = notes.trim()
    const customer = customers.find((c) => c.id === customerId)
    const eqLabel = selectedEquipmentLabel ?? "service"
    const title = trimmedNotes
      ? trimmedNotes.slice(0, 80)
      : `${serviceType} — ${eqLabel}`

    const status = assign.assigned_technician_id || assign.assigned_user_id ? "scheduled" : "open"
    const repairLog = {
      problemReported: trimmedNotes || title,
      diagnosis: "",
      partsUsed: [] as Array<unknown>,
      laborHours: 0,
      technicianNotes: "",
      photos: [] as Array<unknown>,
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    }

    const { error } = await supabase.from("work_orders").insert({
      organization_id: organizationId,
      customer_id: customerId,
      equipment_id: equipmentId,
      title,
      status,
      priority: uiPriorityToDb(priority),
      type: uiTypeToDb(serviceType),
      scheduled_on: date,
      scheduled_time: normalizeTimeForDb(timeHhMm),
      ...assign,
      notes: trimmedNotes || null,
      problem_reported: trimmedNotes || title,
      repair_log: repairLog,
    })

    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
      return
    }
    onCreated?.()
    onClose()
  }, [
    canSubmit,
    organizationId,
    standardCreateEligibility,
    technicianId,
    notes,
    customers,
    customerId,
    equipmentId,
    selectedEquipmentLabel,
    serviceType,
    priority,
    date,
    timeHhMm,
    onCreated,
    onClose,
  ])

  if (!open) return null

  const selectedCustomerName = customers.find((c) => c.id === customerId)?.company_name ?? ""

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center p-4", DRAWER_BACKDROP_Z)} aria-modal="true">
      <div className={cn("absolute inset-0", EQUIPIFY_SCRIM)} onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background dark:bg-card shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Quick add appointment</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 max-h-[70vh] overflow-y-auto">
          {submitError ? (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">
              Customer <span className="text-destructive">*</span>
            </Label>
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v)
                setEquipmentId("")
              }}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder={loadingRefs ? "Loading…" : "Select customer…"} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">
              Equipment <span className="text-destructive">*</span>
            </Label>
            <Select value={equipmentId} onValueChange={setEquipmentId} disabled={!customerId}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue
                  placeholder={
                    !customerId
                      ? "Select customer first"
                      : equipment.length === 0
                        ? "No equipment for this customer"
                        : "Select equipment…"
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                {equipment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {getEquipmentDisplayPrimary({
                      id: e.id,
                      name: e.name,
                      equipment_code: e.equipment_code,
                      serial_number: e.serial_number,
                      category: e.category,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEquipmentLocation ? (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {selectedEquipmentLocation}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Start time
              </Label>
              <Input
                type="time"
                value={timeHhMm}
                onChange={(e) => setTimeHhMm(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Service type</Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as WorkOrderType)}>
                <SelectTrigger className="h-9 text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start">
                  {SERVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as WorkOrderPriority)}>
                <SelectTrigger className="h-9 text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start">
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
            <Label className="text-xs font-medium flex items-center gap-1">
              <User className="h-3 w-3" /> Technician
            </Label>
            <Select
              value={technicianId || "__unassigned__"}
              onValueChange={(v) => setTechnicianId(v === "__unassigned__" ? "" : v)}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short description (optional)"
              className="text-sm resize-none"
            />
          </div>

          {customerId && selectedCustomerName ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wrench className="h-3 w-3" /> Customer: {selectedCustomerName}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="flex-1 h-9 gap-1.5"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Create work order
          </Button>
        </div>
      </div>
    </div>
  )
}

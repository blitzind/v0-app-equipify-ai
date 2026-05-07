"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Send,
  User,
  Wrench,
  X,
  Zap,
} from "lucide-react"
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
import type { DispatchWo } from "@/components/dispatch/dispatch-board"
import {
  describeConflicts,
  describeNeighborConflicts,
  findNeighborSlotConflicts,
  findSlotConflicts,
} from "@/lib/dispatch/scheduling-conflicts"
import {
  composeConflictAcknowledgedMessage,
  composeQuickAddMessage,
  emitSchedulingEvent,
  severityForConflictAck,
} from "@/lib/dispatch/scheduling-events-client"

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

type CustomerOption = { id: string; company_name: string; billing_email: string | null }
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
  /**
   * Phase 2: existing dispatch rows used to surface lightweight conflict
   * warnings when the chosen technician + date + time slot already has a job.
   * Optional — when omitted, the dialog behaves like Phase 1 (no warning).
   */
  existingWorkOrders?: DispatchWo[]
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
  existingWorkOrders,
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
  // Phase: Scheduling Field-Speed Polish — optional confirmation send.
  // Default off so we never send mail unless the dispatcher opts in.
  const [sendConfirmation, setSendConfirmation] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState("")

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
    setSendConfirmation(false)
    setConfirmationEmail("")
    setSubmitError(null)
  }, [open, defaultDate, defaultTimeHhMm, defaultTechnicianId])

  useEffect(() => {
    if (!open || !organizationId || orgStatus !== "ready") return
    let cancelled = false
    void (async () => {
      setLoadingRefs(true)
      const supabase = createBrowserSupabaseClient()
      // Schema-drift safe: include billing_email when present, but fall back
      // to the legacy column set if the column doesn't exist on this org.
      let { data, error } = await supabase
        .from("customers")
        .select("id, company_name, billing_email")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("company_name")
      if (error) {
        const fallback = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", organizationId)
          .eq("status", "active")
          .is("archived_at", null)
          .order("company_name")
        data = fallback.data as Array<{ id: string; company_name: string }> | null
      }
      if (cancelled) return
      setCustomers(
        ((data ?? []) as Array<{ id: string; company_name: string; billing_email?: string | null }>).map((c) => ({
          id: c.id,
          company_name: c.company_name,
          billing_email: (c.billing_email ?? null) || null,
        })),
      )
      setLoadingRefs(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, orgStatus])

  // Phase: Scheduling Field-Speed Polish — auto-select the only equipment
  // option to remove a tap on the most common case (single asset per
  // customer site). Never overrides an explicit pick.
  useEffect(() => {
    if (!equipmentId && equipment.length === 1) {
      setEquipmentId(equipment[0].id)
    }
  }, [equipment, equipmentId])

  // Phase: Scheduling Field-Speed Polish — prefill confirmation recipient
  // from the selected customer's billing_email when available.
  useEffect(() => {
    if (!customerId) return
    const cust = customers.find((c) => c.id === customerId)
    const email = cust?.billing_email?.trim() ?? ""
    if (!email) return
    setConfirmationEmail((prev) => (prev.trim() ? prev : email))
  }, [customerId, customers])

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

  const conflicts = useMemo(() => {
    if (!existingWorkOrders || existingWorkOrders.length === 0) return []
    if (!technicianId || !date) return []
    return findSlotConflicts(existingWorkOrders, {
      technicianId,
      scheduledOn: date,
      scheduledTimeHhMm: timeHhMm || null,
    })
  }, [existingWorkOrders, technicianId, date, timeHhMm])

  // Phase 4: ±1 slot warning. Only renders when no exact-slot conflict already
  // dominates the alert (we keep the inline UI to one row at a time).
  const neighborConflicts = useMemo(() => {
    if (!existingWorkOrders || existingWorkOrders.length === 0) return []
    if (!technicianId || !date || !timeHhMm) return []
    return findNeighborSlotConflicts(existingWorkOrders, {
      technicianId,
      scheduledOn: date,
      scheduledTimeHhMm: timeHhMm,
    })
  }, [existingWorkOrders, technicianId, date, timeHhMm])

  const conflictTechLabel = useMemo(
    () => technicians.find((t) => t.id === technicianId)?.label ?? null,
    [technicians, technicianId],
  )
  const conflictMessage = useMemo(
    () => describeConflicts(conflicts, conflictTechLabel),
    [conflicts, conflictTechLabel],
  )
  const neighborConflictMessage = useMemo(
    () =>
      conflicts.length > 0
        ? null
        : describeNeighborConflicts(neighborConflicts, conflictTechLabel),
    [conflicts.length, neighborConflicts, conflictTechLabel],
  )

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

    const { data: insertedRow, error } = await supabase
      .from("work_orders")
      .insert({
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
      .select("id")
      .single()

    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
      return
    }

    // Phase 4: emit scheduling events (non-blocking — never gate the user).
    const newWoId = (insertedRow as { id?: string } | null)?.id ?? null
    const techLabel = technicianId
      ? technicians.find((t) => t.id === technicianId)?.label ?? null
      : null

    // Phase: Scheduling Field-Speed Polish — fire-and-forget appointment
    // confirmation email when the dispatcher opted in. Reuses the
    // capability-gated /api/email/work-order-summary route.
    const confirmationRecipient = confirmationEmail.trim()
    if (
      newWoId &&
      sendConfirmation &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmationRecipient)
    ) {
      void fetch("/api/email/work-order-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          workOrderId: newWoId,
          to: confirmationRecipient,
          variant: "appointment_confirmation",
        }),
      }).catch(() => {})
    }

    if (newWoId) {
      void emitSchedulingEvent({
        organizationId,
        workOrderId: newWoId,
        eventType: "quick_add",
        severity: "info",
        message: composeQuickAddMessage({
          scheduledOn: date,
          scheduledTimeHhMm: timeHhMm || null,
          techLabel,
        }),
        metadata: {
          source: "dispatch_quick_add_dialog",
          // ID stays in metadata only (RLS-protected); never rendered.
          technicianId: technicianId || null,
          serviceType,
          priority,
        },
      })

      if (conflicts.length > 0) {
        void emitSchedulingEvent({
          organizationId,
          workOrderId: newWoId,
          eventType: "conflict_acknowledged",
          severity: severityForConflictAck("exact"),
          message: composeConflictAcknowledgedMessage({
            conflictCount: conflicts.length,
            techLabel,
            proximity: "exact",
          }),
          metadata: {
            source: "dispatch_quick_add_dialog",
            proximity: "exact",
            conflictCount: conflicts.length,
            conflictWorkOrderIds: conflicts.map((c) => c.id),
          },
        })
      } else if (neighborConflicts.length > 0) {
        void emitSchedulingEvent({
          organizationId,
          workOrderId: newWoId,
          eventType: "conflict_acknowledged",
          severity: severityForConflictAck("neighbor"),
          message: composeConflictAcknowledgedMessage({
            conflictCount: neighborConflicts.length,
            techLabel,
            proximity: "neighbor",
          }),
          metadata: {
            source: "dispatch_quick_add_dialog",
            proximity: "neighbor",
            conflictCount: neighborConflicts.length,
            conflictWorkOrderIds: neighborConflicts.map((c) => c.id),
          },
        })
      }
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
    conflicts,
    neighborConflicts,
    technicians,
    sendConfirmation,
    confirmationEmail,
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

          {/* Phase: Scheduling Field-Speed Polish — confirmation toggle */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={sendConfirmation}
                onChange={(e) => setSendConfirmation(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border accent-primary"
              />
              <span className="flex-1">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Mail className="h-3 w-3" /> Send confirmation to customer
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Sends an appointment email right after the work order is
                  created. Reuses the existing customer email pipeline.
                </span>
              </span>
            </label>
            {sendConfirmation ? (
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={confirmationEmail}
                onChange={(e) => setConfirmationEmail(e.target.value)}
                placeholder="customer@example.com"
                className="h-9 text-sm"
              />
            ) : null}
          </div>

          {customerId && selectedCustomerName ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wrench className="h-3 w-3" /> Customer: {selectedCustomerName}
            </p>
          ) : null}

          {conflictMessage ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2 rounded-md border border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/10 px-3 py-2 text-[11px] text-foreground"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[color:var(--status-warning)]"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[color:var(--status-warning)]">
                  Possible scheduling conflict
                </p>
                <p className="mt-0.5 text-muted-foreground">{conflictMessage}</p>
                {conflicts.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-muted-foreground/90">
                    {conflicts.slice(0, 3).map((c) => (
                      <li key={c.id} className="truncate">
                        ·{" "}
                        {c.workOrderNumber ? (
                          <span className="font-mono">#{c.workOrderNumber}</span>
                        ) : null}{" "}
                        {c.title} — {c.customerName}
                      </li>
                    ))}
                    {conflicts.length > 3 ? (
                      <li className="text-muted-foreground/70">
                        + {conflicts.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <p className="mt-1 text-muted-foreground/70">
                  You can still continue — this is informational only.
                </p>
              </div>
            </div>
          ) : neighborConflictMessage ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-foreground"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">Tight schedule</p>
                <p className="mt-0.5 text-muted-foreground">{neighborConflictMessage}</p>
                {neighborConflicts.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-muted-foreground/90">
                    {neighborConflicts.slice(0, 3).map((c) => (
                      <li key={c.id} className="truncate">
                        ·{" "}
                        {c.workOrderNumber ? (
                          <span className="font-mono">#{c.workOrderNumber}</span>
                        ) : null}{" "}
                        {c.title} — {c.customerName}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Phase: Scheduling Field-Speed Polish — sticky footer with bigger
            tap targets (≥44px tall) for in-vehicle use. */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-card sm:py-4">
          <Button
            variant="outline"
            className="flex-1 h-11 sm:h-10"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 sm:h-10 gap-1.5"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sendConfirmation ? (
              <Send className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {sendConfirmation ? "Save & send" : "Create work order"}
          </Button>
        </div>
      </div>
    </div>
  )
}

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

type CustomerOption = {
  id: string
  company_name: string
  billing_email: string | null
  po_required?: boolean | null
  po_number_required_before_service?: boolean | null
  invoice_instructions?: string | null
  parent_customer_id?: string | null
  child_count?: number
  location_count?: number
}
type LocationOption = {
  id: string
  name: string | null
  address_line1: string | null
  city: string | null
  state: string | null
}
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
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [equipment, setEquipment] = useState<EquipmentOption[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [locationId, setLocationId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [summary, setSummary] = useState("")
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
    setLocationId("")
    setEquipmentId("")
    setSummary("")
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
        .select("id, company_name, billing_email, po_required, po_number_required_before_service, invoice_instructions, parent_customer_id")
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
      const base = ((data ?? []) as Array<{
        id: string
        company_name: string
        billing_email?: string | null
        po_required?: boolean | null
        po_number_required_before_service?: boolean | null
        invoice_instructions?: string | null
        parent_customer_id?: string | null
      }>).map((c) => ({
          id: c.id,
          company_name: c.company_name,
          billing_email: (c.billing_email ?? null) || null,
          po_required: c.po_required ?? null,
          po_number_required_before_service: c.po_number_required_before_service ?? null,
          invoice_instructions: c.invoice_instructions ?? null,
          parent_customer_id: c.parent_customer_id ?? null,
          child_count: 0,
          location_count: 0,
        }))
      if (base.length > 0) {
        const ids = base.map((c) => c.id)
        const [{ data: locRows }, { data: childRows }] = await Promise.all([
          supabase
            .from("customer_locations")
            .select("customer_id")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .in("customer_id", ids),
          supabase
            .from("customers")
            .select("parent_customer_id")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .in("parent_customer_id", ids),
        ])
        const locCounts = new Map<string, number>()
        for (const row of (locRows ?? []) as Array<{ customer_id: string }>) {
          locCounts.set(row.customer_id, (locCounts.get(row.customer_id) ?? 0) + 1)
        }
        const childCounts = new Map<string, number>()
        for (const row of (childRows ?? []) as Array<{ parent_customer_id: string | null }>) {
          if (row.parent_customer_id) childCounts.set(row.parent_customer_id, (childCounts.get(row.parent_customer_id) ?? 0) + 1)
        }
        for (const c of base) {
          c.location_count = locCounts.get(c.id) ?? 0
          c.child_count = childCounts.get(c.id) ?? 0
        }
      }
      setCustomers(base)
      setLoadingRefs(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, orgStatus])

  useEffect(() => {
    if (!locationId && locations.length === 1) {
      setLocationId(locations[0].id)
    }
  }, [locationId, locations])

  // Phase: Scheduling Field-Speed Polish — prefill confirmation recipient
  // from the selected customer's billing_email when available.
  useEffect(() => {
    if (!customerId || !organizationId) return
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const [{ data: locRows }, { data: contactRows }] = await Promise.all([
        supabase
          .from("customer_locations")
          .select("id, name, address_line1, city, state")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .is("archived_at", null)
          .order("is_default", { ascending: false })
          .order("name"),
        supabase
          .from("customer_contacts")
          .select("email")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .is("archived_at", null)
          .order("is_primary", { ascending: false })
          .limit(1),
      ])
      if (cancelled) return
      setLocations((locRows as LocationOption[] | null) ?? [])
      const cust = customers.find((c) => c.id === customerId)
      const contactEmail = ((contactRows as Array<{ email: string | null }> | null) ?? [])[0]?.email?.trim() ?? ""
      const email = contactEmail || cust?.billing_email?.trim() || ""
      if (email) setConfirmationEmail((prev) => (prev.trim() ? prev : email))
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, customers, organizationId])

  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      setLocations([])
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

  const selectedEquipmentLocation = useMemo(
    () => equipment.find((e) => e.id === equipmentId)?.location_label?.trim() ?? null,
    [equipment, equipmentId],
  )

  const canSubmit =
    !!organizationId &&
    !!customerId &&
    !!summary.trim() &&
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
    const trimmedSummary = summary.trim()
    const location = locations.find((loc) => loc.id === locationId)
    const hasSchedule = Boolean(technicianId && date && timeHhMm)
    const title = trimmedSummary.slice(0, 160)

    const status = hasSchedule && (assign.assigned_technician_id || assign.assigned_user_id) ? "scheduled" : "open"
    const repairLog = {
      problemReported: title,
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
        equipment_id: equipmentId || null,
        title,
        status,
        priority: uiPriorityToDb(priority),
        type: uiTypeToDb(serviceType),
        scheduled_on: date || null,
        scheduled_time: hasSchedule ? normalizeTimeForDb(timeHhMm) : null,
        ...assign,
        notes: [
          trimmedNotes || null,
          location
            ? `Service location: ${[location.name, location.address_line1, location.city, location.state].filter(Boolean).join(", ")}`
            : null,
        ].filter(Boolean).join("\n\n") || null,
        problem_reported: title,
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
          scheduledOn: date || null,
          scheduledTimeHhMm: hasSchedule ? timeHhMm : null,
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
    customerId,
    equipmentId,
    summary,
    locations,
    locationId,
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

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const selectedCustomerName = selectedCustomer?.company_name ?? ""
  const filteredCustomers = customers.filter((c) =>
    c.company_name.toLowerCase().includes(customerSearch.trim().toLowerCase()),
  )
  const poBeforeService = Boolean(selectedCustomer?.po_required || selectedCustomer?.po_number_required_before_service)

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
            <Input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customers..."
              className="h-10 text-sm"
            />
            <Select
              value={customerId}
              onValueChange={(v) => {
                setCustomerId(v)
                setLocationId("")
                setEquipmentId("")
              }}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder={loadingRefs ? "Loading…" : "Select customer…"} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                {filteredCustomers.slice(0, 80).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name}
                    {c.parent_customer_id ? " · child/site" : c.child_count ? ` · ${c.child_count} sites` : ""}
                    {c.location_count ? ` · ${c.location_count} locations` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">
              Service summary <span className="text-destructive">*</span>
            </Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Repair sterilizer alarm, annual PM, site visit"
              className="h-10 text-sm"
            />
          </div>

          {poBeforeService ? (
            <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-3 py-2 text-xs text-[color:var(--status-warning)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  PO required before service.
                  {selectedCustomer?.invoice_instructions ? ` ${selectedCustomer.invoice_instructions}` : ""}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Location</Label>
            <Select value={locationId || "__none__"} onValueChange={(v) => setLocationId(v === "__none__" ? "" : v)} disabled={!customerId}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder={!customerId ? "Select customer first" : "Optional location"} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                <SelectItem value="__none__">No specific location</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {[loc.name, loc.address_line1, loc.city, loc.state].filter(Boolean).join(" · ") || "Customer location"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Equipment</Label>
            <Select value={equipmentId || "__none__"} onValueChange={(v) => setEquipmentId(v === "__none__" ? "" : v)} disabled={!customerId}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue
                  placeholder={
                    !customerId
                      ? "Select customer first"
                      : equipment.length === 0
                        ? "No equipment for this customer"
                        : "Optional equipment…"
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
                <SelectItem value="__none__">No specific equipment</SelectItem>
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
              <>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={confirmationEmail}
                  onChange={(e) => setConfirmationEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="h-9 text-sm"
                />
                {!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmationEmail.trim()) ? (
                  <p className="text-[11px] text-[color:var(--status-warning)]">
                    Add a valid email to send confirmation. The appointment can still be created without sending.
                  </p>
                ) : null}
              </>
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
            {sendConfirmation ? "Create & send" : technicianId && date && timeHhMm ? "Create scheduled visit" : "Create unscheduled"}
          </Button>
        </div>
      </div>
    </div>
  )
}

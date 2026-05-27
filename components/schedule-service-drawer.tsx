"use client"

import { useState, useEffect, type ComponentProps, type ElementType } from "react"
import type { WorkOrderType, WorkOrderPriority } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import { scheduleTimeRangeError, SCHEDULE_WORK_ORDER_FLOW_QA_MARKER } from "@/lib/work-orders/schedule-time"
import {
  WORK_ORDER_TYPE_PICKER_OPTIONS,
  workOrderTypeUiLabel,
} from "@/lib/work-orders/work-order-type-labels"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"
import {
  ASSIGNEE_PICKER_EMPTY_HINT,
  loadTechnicianAssignOptions,
  toScheduleAssigneePickerOptions,
} from "@/lib/work-orders/load-technician-assign-options"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { toastRecordEligibilityBlocked } from "@/lib/billing/guard-toast"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { DetailDrawer } from "@/components/detail-drawer"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  User,
  Wrench,
  MapPin,
  Clock,
  CheckCircle2,
  Mail,
  Bell,
  Repeat,
  Plus,
  X,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a work order is successfully inserted (when “Create Work Order” is on). */
  onScheduled?: () => void
}

interface FormState {
  customerId: string
  equipmentId: string
  locationId: string       // uuid from customer_locations, or "manual"
  locationText: string
  serviceType: WorkOrderType | ""
  date: string
  timeWindow: string
  technicianId: string
  priority: WorkOrderPriority
  notes: string
  createWorkOrder: boolean
  sendConfirmation: boolean
  /**
   * Phase: Scheduling Field-Speed Polish — recipient address for the
   * "Send confirmation" toggle. Pre-filled from the customer's billing_email
   * when available; the dispatcher can override before submitting.
   */
  confirmationEmail: string
  sendReminder: boolean
  repeatSchedule: boolean
}

interface NewLocForm {
  name: string
  address: string
  city: string
  state: string
  zip: string
}

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
type LocationOption = {
  id: string
  name: string
  city: string
  state: string
}

const SERVICE_TYPES = WORK_ORDER_TYPE_PICKER_OPTIONS
const PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]

const TIME_WINDOWS = [
  "07:00 – 09:00",
  "08:00 – 10:00",
  "09:00 – 11:00",
  "10:00 – 12:00",
  "12:00 – 14:00",
  "13:00 – 15:00",
  "14:00 – 16:00",
  "15:00 – 17:00",
]

const BLANK: FormState = {
  customerId: "",
  equipmentId: "",
  locationId: "",
  locationText: "",
  serviceType: "",
  date: "",
  timeWindow: "08:00 – 10:00",
  technicianId: "",
  priority: "Normal",
  notes: "",
  createWorkOrder: true,
  sendConfirmation: false,
  confirmationEmail: "",
  sendReminder: false,
  repeatSchedule: false,
}

const BLANK_LOC: NewLocForm = { name: "", address: "", city: "", state: "", zip: "" }

// ─── Helpers ────────────────────────────────────────────────────────────────

function windowStartTime(window: string): string {
  return window.split(" – ")[0]?.trim() ?? "08:00"
}

function windowEndTime(window: string): string {
  const parts = window.split(" – ")
  return (parts[1] ?? parts[0] ?? "10:00").trim()
}

function locationLabel(loc: LocationOption): string {
  return `${loc.name}, ${loc.city}, ${loc.state}`
}

// DrawerSelectContent — thin alias with popper positioning
function DrawerSelectContent({
  children,
  className,
  ...props
}: ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent position="popper" side="bottom" align="start" className={className} {...props}>
      {children}
    </SelectContent>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScheduleServiceDrawer({ open, onClose, onScheduled }: Props) {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { standardCreateEligibility } = useBillingAccess()
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [technicianOptions, setTechnicianOptions] = useState<TechnicianOption[]>([])
  const [customerLocations, setCustomerLocations] = useState<LocationOption[]>([])

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [locSaveError, setLocSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<FormState>(BLANK)
  const [submitted, setSubmitted] = useState(false)

  const [showAddLoc, setShowAddLoc] = useState(false)
  const [newLoc, setNewLoc] = useState<NewLocForm>(BLANK_LOC)
  const [locSaved, setLocSaved] = useState(false)

  // Reset when drawer opens
  useEffect(() => {
    if (open) {
      setForm(BLANK)
      setSubmitted(false)
      setShowAddLoc(false)
      setNewLoc(BLANK_LOC)
      setLocSaved(false)
      setSubmitError(null)
      setLocSaveError(null)
      setLoadError(null)
    }
  }, [open])

  // Load org, customers, technicians when drawer opens
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
          setCustomerOptions([])
          setTechnicianOptions([])
        }
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setCustomerOptions([])
          setTechnicianOptions([])
          setLoadError(
            orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Loading organization…"
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
        .is("archived_at", null)
        .order("company_name")

      if (custError || cancelled) {
        if (!cancelled) setLoadError(custError?.message ?? "Failed to load customers.")
        return
      }

      if (!cancelled) setCustomerOptions((custRows as CustomerOption[]) ?? [])

      const assignOpts = await loadTechnicianAssignOptions(supabase, orgId)
      if (cancelled) return
      if (!cancelled) setTechnicianOptions(toScheduleAssigneePickerOptions(assignOpts))
    })()

    return () => {
      cancelled = true
    }
  }, [open, activeOrgId, orgStatus])

  // Equipment + customer_locations when customer selected
  useEffect(() => {
    if (!open || !activeOrgId || !form.customerId) {
      if (!form.customerId) {
        setEquipmentList([])
        setCustomerLocations([])
      }
      return
    }

    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select("id, name, location_label, equipment_code, serial_number, category")
        .eq("organization_id", activeOrgId)
        .eq("customer_id", form.customerId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("name")

      if (cancelled) return
      if (eqError) {
        setEquipmentList([])
      } else {
        setEquipmentList((eqRows as EquipmentOption[]) ?? [])
      }

      const { data: locRows, error: locError } = await supabase
        .from("customer_locations")
        .select("id, name, city, state")
        .eq("organization_id", activeOrgId)
        .eq("customer_id", form.customerId)
        .is("archived_at", null)
        .order("is_default", { ascending: false })
        .order("name")

      if (cancelled) return
      if (locError) {
        setCustomerLocations([])
      } else {
        setCustomerLocations((locRows as LocationOption[]) ?? [])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, activeOrgId, form.customerId])

  // Auto-fill location from equipment.location_label when possible
  useEffect(() => {
    if (!form.equipmentId || equipmentList.length === 0) return
    const eq = equipmentList.find((e) => e.id === form.equipmentId)
    if (!eq?.location_label?.trim()) return

    const lb = eq.location_label.trim()
    const matched = customerLocations.find((l) => locationLabel(l) === lb)
    setForm((prev) => ({
      ...prev,
      locationId: matched ? matched.id : "manual",
      locationText: matched ? locationLabel(matched) : lb,
    }))
  }, [form.equipmentId, equipmentList, customerLocations])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setLoc(key: keyof NewLocForm, value: string) {
    setNewLoc((prev) => ({ ...prev, [key]: value }))
  }

  function handleCustomerChange(v: string) {
    setForm((prev) => ({
      ...prev,
      customerId: v,
      equipmentId: "",
      locationId: "",
      locationText: "",
      // Phase: Scheduling Field-Speed Polish — clear stale email; the
      // billing_email lookup below repopulates it asynchronously.
      confirmationEmail: prev.customerId === v ? prev.confirmationEmail : "",
    }))
    setShowAddLoc(false)
    setNewLoc(BLANK_LOC)
    setLocSaved(false)
    setLocSaveError(null)
  }

  // Phase: Scheduling Field-Speed Polish — prefill confirmation recipient
  // from the customer's billing email when available. Schema-drift safe:
  // if the column ever disappears we silently fall back to the manual entry.
  useEffect(() => {
    if (!open || !activeOrgId || !form.customerId) return
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("customers")
        .select("billing_email")
        .eq("organization_id", activeOrgId)
        .eq("id", form.customerId)
        .maybeSingle()
      if (cancelled || error) return
      const email = (data as { billing_email?: string | null } | null)?.billing_email?.trim() ?? ""
      if (!email) return
      setForm((prev) =>
        prev.customerId === form.customerId && !prev.confirmationEmail.trim()
          ? { ...prev, confirmationEmail: email }
          : prev,
      )
    })()
    return () => {
      cancelled = true
    }
  }, [open, activeOrgId, form.customerId])

  function handleLocationChange(v: string) {
    if (v === "__add_new__") {
      setShowAddLoc(true)
      return
    }
    const loc = customerLocations.find((l) => l.id === v)
    if (loc) {
      set("locationId", loc.id)
      set("locationText", locationLabel(loc))
    }
  }

  async function handleSaveNewLoc() {
    if (!activeOrgId || !form.customerId || !newLoc.name.trim() || !newLoc.address.trim()) return
    if (!newLoc.city.trim() || !newLoc.state.trim() || !newLoc.zip.trim()) {
      setLocSaveError("City, state, and ZIP are required.")
      return
    }

    setLocSaveError(null)
    const supabase = createBrowserSupabaseClient()

    const { data, error } = await supabase
      .from("customer_locations")
      .insert({
        organization_id: activeOrgId,
        customer_id: form.customerId,
        name: newLoc.name.trim(),
        address_line1: newLoc.address.trim(),
        city: newLoc.city.trim(),
        state: newLoc.state.trim().slice(0, 2),
        postal_code: newLoc.zip.trim(),
      })
      .select("id, name, city, state")
      .single()

    if (error) {
      setLocSaveError(error.message)
      return
    }

    const row = data as LocationOption
    setCustomerLocations((prev) =>
      [...prev, row].sort((a, b) => a.name.localeCompare(b.name))
    )
    set("locationId", row.id)
    set("locationText", locationLabel(row))
    setShowAddLoc(false)
    setLocSaved(true)
    setNewLoc(BLANK_LOC)
  }

  const canSubmit =
    !!activeOrgId &&
    !!form.customerId &&
    !!form.equipmentId &&
    !!form.serviceType &&
    !!form.date &&
    !!form.timeWindow &&
    !!form.technicianId &&
    !submitting &&
    !loadError

  async function handleSubmit() {
    if (!canSubmit || !activeOrgId) return

    setSubmitError(null)

    if (!form.createWorkOrder) {
      setSubmitted(true)
      return
    }

    if (toastRecordEligibilityBlocked(standardCreateEligibility)) return

    const serverGate = await enforceCanCreateRecord(activeOrgId, "work_order")
    if (!serverGate.ok) {
      setSubmitError(serverGate.message)
      return
    }

    setSubmitting(true)
    const supabase = createBrowserSupabaseClient()

    const title =
      form.notes.trim().slice(0, 500) ||
      `${form.serviceType} service — scheduled via Service Schedule`

    const notesParts = [form.notes.trim()]
    if (form.locationText.trim()) {
      notesParts.push(`Location: ${form.locationText.trim()}`)
    }
    const notesCombined = notesParts.filter(Boolean).join("\n\n") || null

    const startHm = windowStartTime(form.timeWindow)
    const endHm = windowEndTime(form.timeWindow)
    const timeErr = scheduleTimeRangeError(startHm, endHm)
    if (timeErr) {
      setSubmitError(timeErr)
      setSubmitting(false)
      return
    }
    const scheduledTime = normalizeTimeForDb(startHm)
    const scheduledEndTime = normalizeTimeForDb(endHm)
    const problemReported = form.notes.trim() || title
    const assign = await workOrderAssignmentColumns(
      supabase,
      activeOrgId,
      form.technicianId?.trim() ? form.technicianId.trim() : null,
    )

    const { data: insertedRow, error: insertError } = await supabase
      .from("work_orders")
      .insert({
        organization_id: activeOrgId,
        customer_id: form.customerId,
        equipment_id: form.equipmentId,
        title,
        status: "scheduled",
        priority: uiPriorityToDb(form.priority as WorkOrderPriority),
        type: uiTypeToDb(form.serviceType as WorkOrderType),
        scheduled_on: form.date,
        scheduled_time: scheduledTime,
        scheduled_end_time: scheduledEndTime,
        ...assign,
        notes: notesCombined,
        problem_reported: problemReported,
        repair_log: {
          problemReported,
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

    setSubmitting(false)

    if (insertError) {
      setSubmitError(insertError.message)
      return
    }

    // Phase: Scheduling Field-Speed Polish — fire-and-forget appointment
    // confirmation email. Reuses the same /api/email/work-order-summary
    // route (capability-gated by canEditWorkOrders ∨ canManageDispatch) but
    // switches the body via `variant: "appointment_confirmation"`. We never
    // block the dispatcher's "scheduled" success state on this network call.
    const newWoId = (insertedRow as { id?: string } | null)?.id ?? null
    const recipient = form.confirmationEmail.trim()
    if (form.sendConfirmation && newWoId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      void fetch("/api/email/work-order-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrgId,
          workOrderId: newWoId,
          to: recipient,
          variant: "appointment_confirmation",
        }),
      }).catch(() => {
        // Intentionally swallowed: dispatcher already has a scheduled WO,
        // and the failure surfaces in the audit/communication log.
      })
    }

    setSubmitted(true)
    onScheduled?.()
  }

  const scheduleEquipmentCustomerName =
    customerOptions.find((c) => c.id === form.customerId)?.company_name ?? ""

  function ToggleChip({
    label,
    icon: Icon,
    checked,
    onChange,
  }: {
    label: string
    icon: ElementType
    checked: boolean
    onChange: (v: boolean) => void
  }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-transparent text-xs font-medium transition-all duration-150",
          checked
            ? "bg-primary text-primary-foreground border-primary shadow-sm dark:bg-[#13233F] dark:text-[#6EA8FF] dark:border-[#296cff]/30 dark:shadow-[0_0_18px_-6px_rgba(41,108,255,0.45)]"
            : "bg-transparent text-muted-foreground border-border hover:bg-muted dark:hover:bg-[#13233F]/25",
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    )
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Schedule Service"
      width="md"
      noScroll
    >
      <div data-qa-marker={SCHEDULE_WORK_ORDER_FLOW_QA_MARKER} className="contents">
      {submitted ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--ds-success-subtle)] flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[var(--ds-success)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Service Scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">
              {form.createWorkOrder
                ? "Work order created and added to the queue."
                : "Appointment saved without a work order."}
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setForm(BLANK)
                setSubmitted(false)
                setSubmitError(null)
              }}
            >
              Schedule Another
            </Button>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-5 px-5 py-5">
              {loadError && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {loadError}
                </p>
              )}

              {/* Customer */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">
                  Customer <span className="text-destructive">*</span>
                </Label>
                <Select value={form.customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <DrawerSelectContent>
                    {customerOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </DrawerSelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Location
                </Label>
                <Select
                  value={form.locationId}
                  onValueChange={handleLocationChange}
                  disabled={!form.customerId}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue
                      placeholder={
                        form.customerId ? "Select location…" : "Select a customer first"
                      }
                    />
                  </SelectTrigger>
                  <DrawerSelectContent>
                    {customerLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {locationLabel(loc)}
                      </SelectItem>
                    ))}
                    {customerLocations.length > 0 && <SelectSeparator />}
                    <SelectItem value="__add_new__">
                      <span className="flex items-center gap-1.5 text-primary font-medium">
                        <Plus className="w-3.5 h-3.5" /> Add New Location
                      </span>
                    </SelectItem>
                  </DrawerSelectContent>
                </Select>

                {showAddLoc && (
                  <div className="mt-1 p-3 rounded-md border border-border bg-muted/30 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">New Location</p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddLoc(false)
                          setNewLoc(BLANK_LOC)
                          setLocSaveError(null)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {locSaveError && (
                      <p className="text-xs text-destructive">{locSaveError}</p>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Location Name"
                        value={newLoc.name}
                        onChange={(e) => setLoc("name", e.target.value)}
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="Street Address"
                        value={newLoc.address}
                        onChange={(e) => setLoc("address", e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          className="h-8 text-xs col-span-1"
                          placeholder="City"
                          value={newLoc.city}
                          onChange={(e) => setLoc("city", e.target.value)}
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="State"
                          value={newLoc.state}
                          onChange={(e) => setLoc("state", e.target.value)}
                          maxLength={2}
                        />
                        <Input
                          className="h-8 text-xs"
                          placeholder="ZIP"
                          value={newLoc.zip}
                          onChange={(e) => setLoc("zip", e.target.value)}
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="self-end h-7 text-xs"
                      disabled={
                        !newLoc.name.trim() ||
                        !newLoc.address.trim() ||
                        !newLoc.city.trim() ||
                        !newLoc.state.trim() ||
                        !newLoc.zip.trim()
                      }
                      onClick={() => void handleSaveNewLoc()}
                    >
                      Save Location
                    </Button>
                  </div>
                )}

                {locSaved && (
                  <p className="text-[10px] text-[var(--ds-success)] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Location saved and selected.
                  </p>
                )}
              </div>

              {/* Equipment */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground" /> Equipment{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.equipmentId}
                  onValueChange={(v) => set("equipmentId", v)}
                  disabled={!form.customerId}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue
                      placeholder={form.customerId ? "Select equipment…" : "Select customer first"}
                    />
                  </SelectTrigger>
                  <DrawerSelectContent>
                    {equipmentList.map((e) => (
                      <SelectItem key={e.id} value={e.id} textValue={getEquipmentDisplayPrimary(e)}>
                        <span className="block font-medium leading-tight">{getEquipmentDisplayPrimary(e)}</span>
                        <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                          {getEquipmentSecondaryLine(e, scheduleEquipmentCustomerName)}
                        </span>
                      </SelectItem>
                    ))}
                  </DrawerSelectContent>
                </Select>
              </div>

              {/* Service Type + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    Service Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.serviceType}
                    onValueChange={(v) => set("serviceType", v as WorkOrderType)}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue placeholder="Type…" />
                    </SelectTrigger>
                    <DrawerSelectContent>
                      {SERVICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {workOrderTypeUiLabel(t)}
                        </SelectItem>
                      ))}
                    </DrawerSelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => set("priority", v as WorkOrderPriority)}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <DrawerSelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </DrawerSelectContent>
                  </Select>
                </div>
              </div>

              {/* Date + Time Window */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Time Window <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.timeWindow} onValueChange={(v) => set("timeWindow", v)}>
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <DrawerSelectContent>
                      {TIME_WINDOWS.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </DrawerSelectContent>
                  </Select>
                </div>
              </div>

              {/* Technician */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  Technician <span className="text-destructive">*</span>
                </Label>
                <Select value={form.technicianId} onValueChange={(v) => set("technicianId", v)}>
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder="Assign technician…" />
                  </SelectTrigger>
                  <DrawerSelectContent>
                    {technicianOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </DrawerSelectContent>
                </Select>
                {technicianOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{ASSIGNEE_PICKER_EMPTY_HINT}</p>
                ) : null}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea
                  className="text-sm resize-none min-h-[72px]"
                  placeholder="Describe the service, access instructions, customer notes…"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium">Options</Label>
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    label="Create Work Order"
                    icon={Wrench}
                    checked={form.createWorkOrder}
                    onChange={(v) => set("createWorkOrder", v)}
                  />
                  <ToggleChip
                    label="Send Confirmation"
                    icon={Mail}
                    checked={form.sendConfirmation}
                    onChange={(v) => set("sendConfirmation", v)}
                  />
                  <ToggleChip
                    label="Send Reminder"
                    icon={Bell}
                    checked={form.sendReminder}
                    onChange={(v) => set("sendReminder", v)}
                  />
                  <ToggleChip
                    label="Repeat Schedule"
                    icon={Repeat}
                    checked={form.repeatSchedule}
                    onChange={(v) => set("repeatSchedule", v)}
                  />
                </div>
                {form.sendConfirmation ? (
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2 flex flex-col gap-1.5">
                    <Label className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      Confirmation recipient
                    </Label>
                    <Input
                      type="email"
                      value={form.confirmationEmail}
                      onChange={(e) => set("confirmationEmail", e.target.value)}
                      placeholder="customer@example.com"
                      className="h-8 text-xs"
                      autoComplete="email"
                      inputMode="email"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Sent right after the work order is scheduled. Reuses the
                      existing customer email infrastructure.
                    </p>
                  </div>
                ) : null}
              </div>

              {submitError && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {submitError}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 px-5 py-4 border-t border-border flex items-center justify-between gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!canSubmit} onClick={() => void handleSubmit()}>
              {submitting ? "Saving…" : "Schedule Service"}
            </Button>
          </div>
        </>
      )}
      </div>
    </DetailDrawer>
  )
}

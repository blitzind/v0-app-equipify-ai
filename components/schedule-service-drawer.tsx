"use client"

import { useState, useMemo, useEffect } from "react"
import { useCustomers } from "@/lib/customer-store"
import { useEquipment } from "@/lib/equipment-store"
import { useWorkOrders } from "@/lib/work-order-store"
import { technicians } from "@/lib/mock-data"
import type { WorkOrder, WorkOrderType, WorkOrderPriority } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  CalendarPlus, User, Wrench, MapPin, Clock,
  AlertTriangle, CheckCircle2, Lightbulb, Mail, Bell, Repeat,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

interface FormState {
  customerId: string
  equipmentId: string
  location: string
  serviceType: WorkOrderType | ""
  date: string
  timeWindow: string
  technicianId: string
  priority: WorkOrderPriority
  notes: string
  createWorkOrder: boolean
  sendConfirmation: boolean
  sendReminder: boolean
  repeatSchedule: boolean
}

const SERVICE_TYPES: WorkOrderType[] = ["PM", "Inspection", "Repair", "Install", "Emergency"]
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

const PRIORITY_STYLE: Record<WorkOrderPriority, string> = {
  Low:      "bg-muted text-muted-foreground",
  Normal:   "ds-badge-info",
  High:     "ds-badge-warning",
  Critical: "ds-badge-danger",
}

const BLANK: FormState = {
  customerId: "",
  equipmentId: "",
  location: "",
  serviceType: "",
  date: "",
  timeWindow: "08:00 – 10:00",
  technicianId: "",
  priority: "Normal",
  notes: "",
  createWorkOrder: true,
  sendConfirmation: false,
  sendReminder: false,
  repeatSchedule: false,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the start time string (HH:MM) from a window label */
function windowStartTime(window: string): string {
  return window.split(" – ")[0] ?? "08:00"
}

/** Check if a technician is double-booked on a given date+time */
function isTechBooked(
  techId: string,
  date: string,
  time: string,
  workOrders: WorkOrder[]
): boolean {
  return workOrders.some(
    (wo) =>
      wo.technicianId === techId &&
      wo.scheduledDate === date &&
      wo.scheduledTime === time &&
      wo.status !== "Completed" &&
      wo.status !== "Cancelled"
  )
}

/** Find the next free time window for a technician on a date */
function nextOpenSlot(
  techId: string,
  date: string,
  workOrders: WorkOrder[]
): string | null {
  for (const win of TIME_WINDOWS) {
    const t = windowStartTime(win)
    if (!isTechBooked(techId, date, t, workOrders)) return win
  }
  return null
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScheduleServiceDrawer({ open, onClose }: Props) {
  const { customers } = useCustomers()
  const { equipment } = useEquipment()
  const { workOrders, createWorkOrder } = useWorkOrders()

  const [form, setForm] = useState<FormState>(BLANK)
  const [submitted, setSubmitted] = useState(false)

  // Reset when drawer opens
  useEffect(() => {
    if (open) {
      setForm(BLANK)
      setSubmitted(false)
    }
  }, [open])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Derived: equipment filtered by selected customer
  const customerEquipment = useMemo(() =>
    form.customerId ? equipment.filter((e) => e.customerId === form.customerId) : [],
    [form.customerId, equipment]
  )

  // Auto-fill location when equipment selected
  useEffect(() => {
    const eq = equipment.find((e) => e.id === form.equipmentId)
    if (eq) set("location", eq.location)
  }, [form.equipmentId, equipment])

  // Technician availability check
  const technicianAvailability = useMemo(() => {
    if (!form.date || !form.timeWindow) return {}
    const startTime = windowStartTime(form.timeWindow)
    return Object.fromEntries(
      technicians.map((t) => [
        t.id,
        !isTechBooked(t.id, form.date, startTime, workOrders),
      ])
    )
  }, [form.date, form.timeWindow, workOrders])

  // Double-booking warning
  const isDoubleBooked = useMemo(() => {
    if (!form.technicianId || !form.date || !form.timeWindow) return false
    const startTime = windowStartTime(form.timeWindow)
    return isTechBooked(form.technicianId, form.date, startTime, workOrders)
  }, [form.technicianId, form.date, form.timeWindow, workOrders])

  // Suggested next open slot for selected technician
  const suggestedSlot = useMemo(() => {
    if (!form.technicianId || !form.date || !isDoubleBooked) return null
    return nextOpenSlot(form.technicianId, form.date, workOrders)
  }, [form.technicianId, form.date, isDoubleBooked, workOrders])

  const canSubmit =
    form.customerId &&
    form.serviceType &&
    form.date &&
    form.timeWindow &&
    form.technicianId &&
    !isDoubleBooked

  function handleSubmit() {
    if (!canSubmit) return

    const existingIds = workOrders
      .map((w) => parseInt(w.id.replace("WO-", "")))
      .filter((n) => !isNaN(n))
    const maxId = Math.max(...existingIds, 2041)

    const customer = customers.find((c) => c.id === form.customerId)
    const eq = equipment.find((e) => e.id === form.equipmentId)
    const tech = technicians.find((t) => t.id === form.technicianId)

    const wo: WorkOrder = {
      id: `WO-${maxId + 1}`,
      customerId: form.customerId,
      customerName: customer?.company ?? "",
      equipmentId: form.equipmentId || "",
      equipmentName: eq?.model ?? "",
      location: form.location,
      type: form.serviceType as WorkOrderType,
      status: "Scheduled",
      priority: form.priority,
      technicianId: form.technicianId,
      technicianName: tech?.name ?? "",
      scheduledDate: form.date,
      scheduledTime: windowStartTime(form.timeWindow),
      completedDate: "",
      createdAt: new Date().toISOString(),
      createdBy: "Service Schedule",
      description: form.notes || `${form.serviceType} service scheduled via Service Schedule.`,
      repairLog: {
        problemReported: form.notes || "",
        diagnosis: "",
        partsUsed: [],
        laborHours: 0,
        technicianNotes: "",
        photos: [],
        signatureDataUrl: "",
        signedBy: "",
        signedAt: "",
      },
      totalLaborCost: 0,
      totalPartsCost: 0,
      invoiceNumber: "",
    }

    if (form.createWorkOrder) createWorkOrder(wo)
    setSubmitted(true)
  }

  function ToggleChip({
    label,
    icon: Icon,
    checked,
    onChange,
  }: {
    label: string
    icon: React.ElementType
    checked: boolean
    onChange: (v: boolean) => void
  }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
          checked
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:bg-muted"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="w-4 h-4 text-primary" />
            Schedule Service
          </SheetTitle>
        </SheetHeader>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--ds-success-subtle)] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[var(--ds-success)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Service Scheduled</p>
              <p className="text-xs text-muted-foreground mt-1">
                {form.createWorkOrder ? "Work order created and added to the queue." : "Appointment saved without a work order."}
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => { setForm(BLANK); setSubmitted(false) }}>
                Schedule Another
              </Button>
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-5 px-6 py-5">

              {/* Customer */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Customer <span className="text-destructive">*</span></Label>
                <Select value={form.customerId} onValueChange={(v) => { set("customerId", v); set("equipmentId", ""); set("location", "") }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Location
                </Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Site address or location name"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                />
              </div>

              {/* Equipment */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground" /> Equipment
                </Label>
                <Select
                  value={form.equipmentId}
                  onValueChange={(v) => set("equipmentId", v)}
                  disabled={!form.customerId}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={form.customerId ? "Select equipment…" : "Select customer first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerEquipment.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Type + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Service Type <span className="text-destructive">*</span></Label>
                  <Select value={form.serviceType} onValueChange={(v) => set("serviceType", v as WorkOrderType)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => set("priority", v as WorkOrderPriority)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date + Time Window */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Time Window <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.timeWindow} onValueChange={(v) => set("timeWindow", v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_WINDOWS.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Technician */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> Technician <span className="text-destructive">*</span>
                </Label>
                <Select value={form.technicianId} onValueChange={(v) => set("technicianId", v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Assign technician…" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => {
                      const available = form.date && form.timeWindow
                        ? (technicianAvailability[t.id] ?? true)
                        : null
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            {t.name}
                            {available === true && (
                              <span className="text-[10px] text-[var(--ds-success)] font-medium">Available</span>
                            )}
                            {available === false && (
                              <span className="text-[10px] text-[var(--ds-warning)] font-medium">Busy</span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                {/* Double-booking warning */}
                {isDoubleBooked && (
                  <div className="flex flex-col gap-2 p-3 rounded-md border border-[var(--ds-warning-border)] bg-[var(--ds-warning-subtle)]">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--ds-warning)] shrink-0 mt-0.5" />
                      <p className="text-xs text-[var(--ds-warning-foreground)] font-medium">
                        This technician is already booked at this time.
                      </p>
                    </div>
                    {suggestedSlot && (
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-[var(--ds-warning)] shrink-0" />
                        <p className="text-xs text-[var(--ds-warning-foreground)]">
                          Next open slot:{" "}
                          <button
                            type="button"
                            className="font-semibold underline underline-offset-2 cursor-pointer"
                            onClick={() => set("timeWindow", suggestedSlot)}
                          >
                            {suggestedSlot}
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                )}
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
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        {!submitted && (
          <div className="shrink-0 px-6 py-4 border-t border-border flex items-center justify-between gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Schedule Service
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

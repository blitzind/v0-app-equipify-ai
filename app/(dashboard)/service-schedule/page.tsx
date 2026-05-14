"use client"

import { Fragment, useState, useMemo, useEffect, Suspense } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import { AidenOperationalInsightsCard } from "@/components/aiden/aiden-operational-insights-card"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import {
  missingOperationalBillingColumns,
  missingWorkOrderNumberColumn,
} from "@/lib/work-orders/postgrest-fallback"
import { WO_DISPATCH_SCHEDULE_SELECT_NO_BILLING_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { enrichDispatchWorkOrders, filterDispatchRows } from "@/lib/dispatch/build-dispatch-wos"
import type { DispatchWoRow } from "@/lib/dispatch/build-dispatch-wos"
import { DISPATCH_FOCUS_OPTIONS, type DispatchFilterId } from "@/lib/dispatch/operational-badges"
import {
  DEFAULT_DISPATCH_STATUSES,
  DISPATCH_STATUS_ORDER,
  filterByStatuses,
  countByStatus,
  type DispatchStatusKey,
} from "@/lib/dispatch/status-filter"
import { DispatchStatusFilter } from "@/components/dispatch/dispatch-status-filter"
import { DispatchWeekOverview } from "@/components/dispatch/dispatch-week-overview"
import { usePersistedDispatchPref } from "@/lib/dispatch/persisted-prefs"
import type { DispatchTech, DispatchWo } from "@/components/dispatch/dispatch-board"
import {
  DND,
  DISPATCH_SLOT_COUNT,
  formatSlotLabel,
  slotIndexToTimeHhMm,
  startOfWeekMonday,
  timeToSlotIndex,
  toYmd,
} from "@/lib/dispatch/board-utils"
import { deriveDispatchState } from "@/lib/dispatch/dispatch-state"
import { OperationalBadgeRow } from "@/components/dispatch/operational-badge-row"
import {
  buildScheduleWarningsByPeer,
  type ScheduleWarningItem,
  type ScheduleWarnPeer,
} from "@/lib/dispatch/schedule-warnings"
import { useToast } from "@/hooks/use-toast"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"
import {
  loadTechnicianAssignOptions,
  toScheduleAssigneePickerOptions,
} from "@/lib/work-orders/load-technician-assign-options"
import { buildSchedulePatch } from "@/lib/work-orders/schedule-patch"
import { emitSchedulingEvent } from "@/lib/dispatch/scheduling-events-client"
import { DRAWER_BACKDROP_Z, EQUIPIFY_SCRIM } from "@/components/detail-drawer"
import { createWorkOrderFromMaintenancePlan } from "@/lib/maintenance-plans/create-work-order-from-plan"
import type { MaintenancePlan, WorkOrderType, WorkOrderPriority } from "@/lib/mock-data"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Bell,
  Plus,
  List,
  Map as MapIcon,
  CalendarDays,
  Users,
  User,
  MapPin,
  Mail,
  RefreshCw,
  Sparkles,
  X,
  Navigation,
  ExternalLink,
  MessageSquare,
  BellRing,
  BellOff,
  Send,
  ClipboardList,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { MaintenancePlanDrawer } from "@/components/drawers/maintenance-plan-drawer"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { ScheduleServiceDrawer } from "@/components/schedule-service-drawer"
import { QuickAppointmentDialog } from "@/components/dispatch/quick-appointment-dialog"

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

const INTERVAL_COLORS: Record<string, string> = {
  "Annual":      "ds-badge-accent border",
  "Semi-Annual": "ds-badge-info border",
  "Quarterly":   "ds-badge-info border",
  "Monthly":     "ds-badge-success border",
  "Custom":      "ds-badge-warning border",
}

type ViewTab = "list" | "calendar" | "map"
type CalendarSub = "day" | "week" | "month"
type TeamScope = "my" | "team"
type ViewMode = "1" | "3" | "4" | "6" | "12" | "year"

// Reminder status mock — derived from plan notification rules
type ReminderStatus = "confirmation_sent" | "reminder_scheduled" | "reminder_sent" | "failed" | "not_sent"

const REMINDER_CONFIG: Record<ReminderStatus, { label: string; className: string }> = {
  confirmation_sent:  { label: "Confirmation Sent",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  reminder_scheduled: { label: "Reminder Scheduled",  className: "bg-blue-50 text-blue-700 border-blue-200" },
  reminder_sent:      { label: "Reminder Sent",       className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  failed:             { label: "Failed",              className: "bg-red-50 text-red-700 border-red-200" },
  not_sent:           { label: "Not Sent",            className: "bg-muted text-muted-foreground border-border" },
}

// Mock current user
const CURRENT_USER = "Marcus Webb"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyBg(days: number): string {
  if (days < 0)   return "border-l-4 border-l-[var(--ds-danger-subtle)]"
  if (days <= 7)  return "border-l-4 border-l-[var(--ds-danger-subtle)]"
  if (days <= 14) return "border-l-4 border-l-[var(--ds-warning-subtle)]"
  if (days <= 30) return "border-l-4 border-l-[var(--ds-warning-border)]"
  return "border-l-4 border-l-border"
}

function urgencyText(days: number): string {
  if (days < 0)   return "ds-text-danger font-semibold"
  if (days <= 7)  return "ds-text-danger font-medium"
  if (days <= 14) return "ds-text-warning font-medium"
  if (days <= 30) return "ds-text-warning"
  return "text-muted-foreground"
}

function formatDaysLabel(days: number): string {
  if (days < 0)   return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "1 day"
  return `${days} days`
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return `${MONTHS[month]} ${year}`
}

// Deterministic mock reminder status based on plan id
function getReminderStatus(plan: MaintenancePlan): ReminderStatus {
  const hasRules = plan.notificationRules.some((r) => r.enabled)
  if (!hasRules) return "not_sent"
  const hash = plan.id.charCodeAt(plan.id.length - 1)
  const statuses: ReminderStatus[] = ["confirmation_sent", "reminder_scheduled", "reminder_sent", "failed", "not_sent"]
  return statuses[hash % statuses.length]
}

// Mock time window for a plan
function getMockTimeWindow(plan: MaintenancePlan): string {
  const hash = plan.id.charCodeAt(plan.id.length - 1) % 4
  return ["08:00 – 10:00", "10:00 – 12:00", "13:00 – 15:00", "15:00 – 17:00"][hash]
}

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  "1":    "Month View",
  "3":    "3-Month View",
  "4":    "4-Month View",
  "6":    "6-Month View",
  "12":   "12-Month View",
  "year": "Year View",
}

function viewModeMonths(mode: ViewMode): number {
  if (mode === "year") return 12
  return parseInt(mode, 10)
}

function dateRangeLabel(mode: ViewMode, offset: number, today: Date): string {
  if (mode === "year") return String(today.getFullYear() + offset)
  const start = new Date(today.getFullYear(), today.getMonth() + offset * viewModeMonths(mode), 1)
  const count = viewModeMonths(mode)
  if (count === 1) return start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const end = new Date(start.getFullYear(), start.getMonth() + count - 1, 1)
  return `${start.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
}

function buildMonthKeys(mode: ViewMode, offset: number, today: Date): string[] {
  const count = viewModeMonths(mode)
  if (mode === "year") {
    const year = today.getFullYear() + offset
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i).padStart(2, "0")}`)
  }
  const base = new Date(today.getFullYear(), today.getMonth() + offset * count, 1)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
  })
}

// ─── Reschedule Modal ─────────────────────────────────────────────────────────

interface ReschedulePlan {
  plan: MaintenancePlan
  onClose: () => void
}

function RescheduleModal({ plan, onClose }: ReschedulePlan) {
  const { updatePlan } = useMaintenancePlans()
  const [date, setDate] = useState(plan.nextDueDate)
  const [timeWindow, setTimeWindow] = useState(getMockTimeWindow(plan))
  const [technician, setTechnician] = useState(plan.technicianName)
  const [reason, setReason] = useState("")
  const [sendUpdate, setSendUpdate] = useState(true)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const res = await updatePlan(plan.id, { nextDueDate: date })
    if (res.error) return
    setSaved(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div
      className={cn("fixed inset-0 flex items-center justify-center p-4", DRAWER_BACKDROP_Z)}
      aria-modal="true"
    >
      <div className={cn("absolute inset-0", EQUIPIFY_SCRIM)} onClick={onClose} aria-hidden />

      <div className="relative z-10 bg-background dark:bg-card rounded-xl border border-border shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Reschedule Service</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">Service Rescheduled</p>
            <p className="text-xs text-muted-foreground">Updated to {new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-5 py-5">
              {/* Plan info */}
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.customerName} · {plan.equipmentName}</p>
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">New Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Time window */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Time Window</label>
                <Select value={timeWindow} onValueChange={setTimeWindow}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["08:00 – 10:00", "10:00 – 12:00", "13:00 – 15:00", "15:00 – 17:00"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Technician */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Technician</label>
                <Select value={technician} onValueChange={setTechnician}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Marcus Webb", "Sandra Liu", "Priya Mehta", "Tyler Oakes", "James Torres"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer requested earlier slot"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Send update toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Send customer update</p>
                  <p className="text-xs text-muted-foreground">Email customer about the reschedule</p>
                </div>
                <Switch checked={sendUpdate} onCheckedChange={setSendUpdate} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={() => void handleSave()} disabled={!date}>
                {sendUpdate ? "Reschedule & Notify" : "Reschedule"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── AI Smart Scheduling Panel ────────────────────────────────────────────────

function SmartSchedulingPanel({ plans }: { plans: MaintenancePlan[] }) {
  const [expanded, setExpanded] = useState(false)

  // Mock AI suggestions
  const suggestions = useMemo(() => {
    const sorted = [...plans].filter((p) => p.status === "Active").sort((a, b) =>
      new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    ).slice(0, 6)

    // Group by location prefix (mock "nearby" grouping)
    const groups: Record<string, MaintenancePlan[]> = {}
    sorted.forEach((p) => {
      const key = p.location.split(",")[0].trim()
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })

    return Object.entries(groups).filter(([, g]) => g.length > 1).slice(0, 3)
  }, [plans])

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Smart Scheduling
          </span>
          <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-90")} />
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 flex flex-col gap-4">
          {/* Best technician suggestion */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" /> Suggested Technician
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Marcus Webb</span> is available and has the fewest open jobs this week (3). Recommended for next 2 service slots.
            </p>
          </div>

          {/* Best time slot */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Optimal Time Slots
            </p>
            <p className="text-xs text-muted-foreground">
              Tuesday and Thursday mornings (08:00–12:00) have the lowest double-booking risk across all technicians this month.
            </p>
          </div>

          {/* Nearby grouping */}
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Group Nearby Appointments
              </p>
              <div className="flex flex-col gap-2">
                {suggestions.map(([loc, group]) => (
                  <div key={loc} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{group.length} jobs</span> near {loc} — consider grouping on the same day to reduce travel.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Double booking check */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Double Booking Check
            </p>
            <p className="text-xs text-muted-foreground">
              No double bookings detected for this period. Sandra Liu has 2 jobs within 1 hour on May 8 — review if needed.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Reminder Status Badge ────────────────────────────────────────────────────

function ReminderBadge({ status }: { status: ReminderStatus }) {
  const cfg = REMINDER_CONFIG[status]
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", cfg.className)}>
      {cfg.label}
    </span>
  )
}

// ─── Service Card (shared between List and Calendar detail) ───────────────────

function ServiceCard({
  plan,
  onOpenPlan,
  onCreateWo,
  createdIds,
  onReschedule,
  compact = false,
}: {
  plan: MaintenancePlan
  onOpenPlan: (id: string) => void
  onCreateWo: (plan: MaintenancePlan) => void
  createdIds: Set<string>
  onReschedule: (plan: MaintenancePlan) => void
  compact?: boolean
}) {
  const days = daysUntil(plan.nextDueDate)
  const alreadyCreated = createdIds.has(plan.id)
  const activeRules = plan.notificationRules.filter((r) => r.enabled)
  const nextEmail = activeRules.find((r) => r.channel === "Email")
  const nextSms = activeRules.find((r) => r.channel === "SMS")
  const reminderStatus = getReminderStatus(plan)
  const timeWindow = getMockTimeWindow(plan)

  return (
    <div
      className={cn(
        "flex items-stretch gap-0 bg-card rounded-lg border border-border overflow-hidden hover:shadow-sm transition-shadow cursor-pointer",
        urgencyBg(days)
      )}
      onClick={() => onOpenPlan(plan.id)}
    >
      {/* Date block */}
      <div className="flex flex-col items-center justify-center px-4 py-3 border-r border-border bg-muted/30 min-w-[72px] shrink-0">
        <span className="text-xs text-muted-foreground uppercase tracking-wide leading-none">
          {new Date(plan.nextDueDate).toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="text-2xl font-bold text-foreground leading-tight">
          {new Date(plan.nextDueDate).getDate()}
        </span>
        <span className={cn("text-xs mt-0.5 text-center leading-tight", urgencyText(days))}>
          {formatDaysLabel(days)}
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-start gap-3 px-4 py-3 min-w-0 flex-col">
        {/* Row 1: name + badges */}
        <div className="flex items-center gap-2 flex-wrap w-full">
          <span className="text-sm font-semibold text-foreground">{plan.name}</span>
          <span className={cn("text-xs px-1.5 py-0.5 rounded-full border font-medium", INTERVAL_COLORS[plan.interval] ?? INTERVAL_COLORS.Custom)}>
            {plan.interval === "Custom" ? `${plan.customIntervalDays}d` : plan.interval}
          </span>
          {plan.status === "Paused" && (
            <span className="text-xs px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Paused</span>
          )}
          <ReminderBadge status={reminderStatus} />
        </div>

        {/* Row 2: meta */}
        <div className="flex flex-col gap-1 w-full -mt-1">
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeWindow}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{plan.customerName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{plan.location}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{plan.equipmentName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{plan.technicianName}</span>
            {plan.services.length > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{plan.services.length} service{plan.services.length !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>

        {/* Row 3: actions */}
        {!compact && (
          <div className="flex items-center gap-2 flex-wrap mt-0.5 w-full" onClick={(e) => e.stopPropagation()}>
            {/* Navigate + Email */}
            {plan.location && (
              <AppointmentActions
                address={plan.location}
                emailParams={{
                  customerName:  plan.customerName,
                  equipmentName: plan.equipmentName,
                  technicianName: plan.technicianName,
                  scheduledDate:  plan.nextDueDate,
                  address:        plan.location,
                  workOrderTitle:   plan.name,
                  ccEmails:       ["service@equipify.ai"],
                }}
              />
            )}

            {/* Reschedule */}
            <button
              onClick={(e) => { e.stopPropagation(); onReschedule(plan) }}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border text-xs font-medium transition-colors bg-background border-border text-foreground hover:bg-muted sm:h-8 sm:min-h-0 touch-manipulation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reschedule
            </button>

            {/* Create WO */}
            {plan.autoCreateWorkOrder && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateWo(plan) }}
                disabled={alreadyCreated || plan.status === "Paused"}
                className={cn(
                  "inline-flex items-center gap-1.5 min-h-11 px-3 rounded-md border text-xs font-medium transition-colors sm:h-8 sm:min-h-0 touch-manipulation",
                  alreadyCreated
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                    : plan.status === "Paused"
                    ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                    : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                )}
              >
                {alreadyCreated ? <><CheckCircle2 className="w-3.5 h-3.5" /> WO Created</> : <><Zap className="w-3.5 h-3.5" /> Create WO</>}
              </button>
            )}

            {/* Notification chips */}
            <div className="flex items-center gap-1.5">
              {nextEmail && <span className="text-xs px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200">Email</span>}
              {nextSms   && <span className="text-xs px-2 py-0.5 rounded border bg-green-50 text-green-600 border-green-200">SMS</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

function MonthSection({
  monthKey, plans, onCreateWo, createdIds, onOpenPlan, onReschedule, today,
}: {
  monthKey: string
  plans: MaintenancePlan[]
  onCreateWo: (plan: MaintenancePlan) => void
  createdIds: Set<string>
  onOpenPlan: (id: string) => void
  onReschedule: (plan: MaintenancePlan) => void
  today: Date
}) {
  const [year, month] = monthKey.split("-").map(Number)
  const label = `${MONTHS[month]} ${year}`
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const isPast = new Date(year, month + 1, 0) < today && !isCurrentMonth

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border",
          isCurrentMonth
            ? "bg-primary text-primary-foreground border-primary"
            : isPast
            ? "bg-muted text-muted-foreground border-border"
            : "bg-card text-foreground border-border"
        )}>
          <Calendar className="w-3.5 h-3.5" />
          {label}
          {isCurrentMonth && <span className="text-xs font-normal opacity-80">Current</span>}
        </div>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground shrink-0">{plans.length} service{plans.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {plans
          .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
          .map((plan) => (
            <ServiceCard
              key={plan.id}
              plan={plan}
              onOpenPlan={onOpenPlan}
              onCreateWo={onCreateWo}
              createdIds={createdIds}
              onReschedule={onReschedule}
            />
          ))}
      </div>
    </div>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({
  plans, calSub, calDate, setCalDate, onOpenPlan, onCreateWo, createdIds, onReschedule,
}: {
  plans: MaintenancePlan[]
  calSub: CalendarSub
  calDate: Date
  setCalDate: (d: Date) => void
  onOpenPlan: (id: string) => void
  onCreateWo: (plan: MaintenancePlan) => void
  createdIds: Set<string>
  onReschedule: (plan: MaintenancePlan) => void
}) {
  // Index plans by date string
  const byDate = useMemo(() => {
    const map: Record<string, MaintenancePlan[]> = {}
    plans.forEach((p) => {
      const key = p.nextDueDate
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return map
  }, [plans])

  function fmtKey(d: Date): string {
    return d.toISOString().split("T")[0]
  }

  // ── Day View ──
  if (calSub === "day") {
    const key = fmtKey(calDate)
    const dayPlans = byDate[key] ?? []
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { const d = new Date(calDate); d.setDate(d.getDate() - 1); setCalDate(d) }} className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground flex-1 text-center">
            {calDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </span>
          <button onClick={() => { const d = new Date(calDate); d.setDate(d.getDate() + 1); setCalDate(d) }} className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {dayPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No services scheduled for this day.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dayPlans.map((plan) => (
              <ServiceCard key={plan.id} plan={plan} onOpenPlan={onOpenPlan} onCreateWo={onCreateWo} createdIds={createdIds} onReschedule={onReschedule} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Week View ──
  if (calSub === "week") {
    const dow = calDate.getDay()
    const weekStart = new Date(calDate)
    weekStart.setDate(calDate.getDate() - dow)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { const d = new Date(calDate); d.setDate(d.getDate() - 7); setCalDate(d) }} className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground flex-1 text-center">
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button onClick={() => { const d = new Date(calDate); d.setDate(d.getDate() + 7); setCalDate(d) }} className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {days.map((d) => (
            <div key={d.toISOString()} className="text-center">
              <span className="text-[10px] text-muted-foreground uppercase">{DAYS_SHORT[d.getDay()]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = fmtKey(d)
            const dayPlans = byDate[key] ?? []
            const isToday = d.getTime() === today.getTime()
            return (
              <div
                key={key}
                className={cn("min-h-[100px] rounded-lg border p-1.5 flex flex-col gap-1 cursor-pointer hover:border-primary/40 transition-colors",
                  isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                )}
                onClick={() => { setCalDate(d) }}
              >
                <span className={cn("text-xs font-semibold self-center w-6 h-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                )}>
                  {d.getDate()}
                </span>
                {dayPlans.slice(0, 3).map((plan) => (
                  <div
                    key={plan.id}
                    onClick={(e) => { e.stopPropagation(); onOpenPlan(plan.id) }}
                    className={cn("text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer",
                      daysUntil(plan.nextDueDate) < 0 ? "bg-red-100 text-red-700" :
                      daysUntil(plan.nextDueDate) <= 7 ? "bg-amber-100 text-amber-700" :
                      "bg-primary/10 text-primary"
                    )}
                    title={plan.name}
                  >
                    {plan.name}
                  </div>
                ))}
                {dayPlans.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayPlans.length - 3} more</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Month View ──
  const year = calDate.getFullYear()
  const month = calDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const totalCells = startOffset + lastDay.getDate()
  const rows = Math.ceil(totalCells / 7)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() - 1); setCalDate(d) }} className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground flex-1 text-center">
          {calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() + 1); setCalDate(d) }} className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center py-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {Array.from({ length: rows * 7 }, (_, i) => {
          const dayNum = i - startOffset + 1
          if (dayNum < 1 || dayNum > lastDay.getDate()) {
            return <div key={i} className="bg-muted/30 min-h-[80px]" />
          }
          const d = new Date(year, month, dayNum)
          const key = fmtKey(d)
          const dayPlans = byDate[key] ?? []
          const isToday = d.getTime() === today.getTime()
          return (
            <div
              key={i}
              className={cn("bg-card min-h-[80px] p-1.5 flex flex-col gap-0.5",
                isToday && "bg-primary/5"
              )}
            >
              <span className={cn("text-xs font-semibold self-start w-6 h-6 flex items-center justify-center rounded-full",
                isToday ? "bg-primary text-primary-foreground" : "text-foreground"
              )}>
                {dayNum}
              </span>
              {dayPlans.slice(0, 2).map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => onOpenPlan(plan.id)}
                  className={cn("text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer hover:opacity-80",
                    daysUntil(plan.nextDueDate) < 0 ? "bg-red-100 text-red-700" :
                    daysUntil(plan.nextDueDate) <= 7 ? "bg-amber-100 text-amber-700" :
                    "bg-primary/10 text-primary"
                  )}
                  title={plan.name}
                >
                  {plan.name}
                </div>
              ))}
              {dayPlans.length > 2 && (
                <span className="text-[10px] text-muted-foreground px-1">+{dayPlans.length - 2}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Map View ─────────────────────────────────────────────────────────────────

function MapView({
  plans, onOpenPlan, onReschedule, createdIds, onCreateWo,
}: {
  plans: MaintenancePlan[]
  onOpenPlan: (id: string) => void
  onReschedule: (plan: MaintenancePlan) => void
  createdIds: Set<string>
  onCreateWo: (plan: MaintenancePlan) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [routeOptimized, setRouteOptimized] = useState(false)

  // Group by unique location
  const locationGroups = useMemo(() => {
    const map: Record<string, MaintenancePlan[]> = {}
    plans.forEach((p) => {
      if (!map[p.location]) map[p.location] = []
      map[p.location].push(p)
    })
    return Object.entries(map)
  }, [plans])

  // Mock route order
  const sorted = routeOptimized
    ? [...locationGroups].sort((a, b) => a[0].localeCompare(b[0]))
    : locationGroups

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Mock map */}
      <div className="lg:flex-1 rounded-xl border border-border bg-muted/20 overflow-hidden relative min-h-[320px] lg:min-h-0">
        {/* Fake map background */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,var(--border)_39px,var(--border)_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,var(--border)_39px,var(--border)_40px)] opacity-40" />

        {/* Mock pins */}
        {locationGroups.map(([loc, group], i) => {
          // Pseudo-random positions based on index
          const left = 10 + (i * 137 + 23) % 75
          const top  = 10 + (i * 79  + 41) % 75
          const isSelected = selected === loc
          return (
            <button
              key={loc}
              onClick={() => setSelected(isSelected ? null : loc)}
              style={{ left: `${left}%`, top: `${top}%` }}
              className="absolute -translate-x-1/2 -translate-y-full group"
              aria-label={`Pin for ${loc}`}
            >
              <div className={cn(
                "flex flex-col items-center transition-transform duration-150",
                isSelected ? "scale-125" : "group-hover:scale-110"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-md",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : daysUntil(group[0].nextDueDate) < 0
                    ? "bg-red-500 text-white border-red-600"
                    : daysUntil(group[0].nextDueDate) <= 7
                    ? "bg-amber-400 text-amber-900 border-amber-500"
                    : "bg-card text-foreground border-border"
                )}>
                  {group.length}
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-current -mt-px" />
              </div>
              {/* Tooltip */}
              {isSelected && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover border border-border rounded-lg shadow-xl p-3 text-left min-w-[200px] z-10">
                  <p className="text-xs font-semibold text-foreground mb-1 truncate">{loc}</p>
                  {group.map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5" onClick={(e) => { e.stopPropagation(); onOpenPlan(p.id) }}>
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        daysUntil(p.nextDueDate) < 0 ? "bg-red-500" :
                        daysUntil(p.nextDueDate) <= 7 ? "bg-amber-400" : "bg-primary"
                      )} />
                      <span className="truncate hover:text-foreground cursor-pointer">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          )
        })}

        {/* Map actions */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={() => setRouteOptimized((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium shadow-md transition-colors",
              routeOptimized ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-muted"
            )}
          >
            <Navigation className="w-3.5 h-3.5" />
            {routeOptimized ? "Optimized Route" : "Optimize Route"}
          </button>
        </div>
      </div>

      {/* Location list */}
      <div className="lg:w-80 flex flex-col gap-2 overflow-y-auto max-h-[480px] lg:max-h-full">
        {sorted.map(([loc, group], i) => (
          <div
            key={loc}
            className={cn(
              "rounded-lg border p-3 flex flex-col gap-2 transition-colors cursor-pointer",
              selected === loc ? "border-primary/50 bg-primary/5" : "border-border bg-card ds-hover-list-row"
            )}
            onClick={() => setSelected(selected === loc ? null : loc)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {routeOptimized && (
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{loc}</p>
                  <p className="text-[10px] text-muted-foreground">{group.length} appointment{group.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-7 h-7 flex items-center justify-center rounded border border-border bg-background hover:bg-muted text-muted-foreground"
                  title="Open in Google Maps"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {selected === loc && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
                {group.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={(e) => { e.stopPropagation(); onOpenPlan(plan.id) }}
                    className="text-xs text-foreground hover:text-primary cursor-pointer flex items-center gap-1.5"
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                      daysUntil(plan.nextDueDate) < 0 ? "bg-red-500" :
                      daysUntil(plan.nextDueDate) <= 7 ? "bg-amber-400" : "bg-primary"
                    )} />
                    {plan.name} — {new Date(plan.nextDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No locations in this period.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Scheduled work orders (Supabase) ──────────────────────────────────────────

type DbScheduledWoRow = {
  id: string
  work_order_number?: number | null
  customer_id: string
  customer_location_id?: string | null
  equipment_id: string | null
  title: string
  status: string
  scheduled_on: string
  scheduled_time: string | null
  assigned_user_id: string | null
  assigned_technician_id?: string | null
  priority?: string | null
  type?: string | null
  billing_state?: string | null
  maintenance_plan_id?: string | null
  calibration_template_id?: string | null
  created_by_pm_automation?: boolean | null
  billable_to_customer?: boolean | null
  warranty_review_required?: boolean | null
  total_parts_cents?: number | null
  created_at?: string | null
  completed_at?: string | null
}

type ScheduledWoRowView = {
  wo: DispatchWo
  equipmentName: string
  location: string
}

type ScheduleTechnicianOption = {
  id: string
  label: string
}

function scheduleInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function mapDbRowToDispatchWoRow(r: DbScheduledWoRow, mini: boolean): DispatchWoRow {
  return {
    id: r.id,
    work_order_number: r.work_order_number ?? null,
    title: r.title,
    status: r.status,
    scheduled_on: r.scheduled_on,
    scheduled_time: r.scheduled_time,
    assigned_user_id: r.assigned_user_id,
    assigned_technician_id: r.assigned_technician_id ?? null,
    customer_id: r.customer_id,
    customer_location_id: r.customer_location_id ?? null,
    equipment_id: r.equipment_id,
    priority: r.priority ?? "normal",
    type: r.type ?? "repair",
    billing_state: mini ? null : (r.billing_state ?? null),
    maintenance_plan_id: mini ? null : (r.maintenance_plan_id ?? null),
    calibration_template_id: mini ? null : (r.calibration_template_id ?? null),
    created_by_pm_automation: mini ? false : Boolean(r.created_by_pm_automation),
    billable_to_customer: mini ? true : (r.billable_to_customer ?? true),
    warranty_review_required: mini ? false : Boolean(r.warranty_review_required),
    total_parts_cents: mini ? 0 : (r.total_parts_cents ?? 0),
    created_at: r.created_at ?? new Date(0).toISOString(),
    completed_at: mini ? null : (r.completed_at ?? null),
  }
}

function formatScheduleTimeHm(t: string | null): string {
  if (!t) return ""
  const s = t.trim()
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatWoStatusLabel(status: string): string {
  return status.split("_").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "")).join(" ")
}

function scheduleRowToWarnPeer(row: ScheduledWoRowView): ScheduleWarnPeer {
  const w = row.wo
  return {
    id: w.id,
    status: w.status,
    scheduled_on: w.scheduled_on,
    scheduled_time: w.scheduled_time,
    assigned_user_id: w.assigned_user_id,
    customer_id: w.customer_id,
    customerLocationId: w.customerLocationId ?? null,
    opsFlags: w.opsFlags ?? null,
  }
}

function ScheduledWorkOrdersSection({
  rows,
  loading,
  overlapKeys,
  scheduleWarningsByWoId,
}: {
  rows: ScheduledWoRowView[]
  loading: boolean
  overlapKeys: Set<string>
  scheduleWarningsByWoId: Map<string, ScheduleWarningItem[]>
}) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          Scheduled Work Orders
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal pt-0.5">
          Active work orders with a scheduled date — same operational signals as dispatch (billing, PM/cal, invoices,
          certificates).
        </p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-3">
        {loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading scheduled work orders…</p>
        )}
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground/30" aria-hidden />
            <p className="text-sm font-medium text-foreground">No scheduled work orders match your filters.</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Try adjusting status chips above, switching the operational focus, or toggle{" "}
              <span className="font-medium text-foreground">Include invoiced</span> to widen the
              window.
            </p>
          </div>
        )}
        {!loading &&
          rows.map((row) => {
            const wo = row.wo
            const softWarnings = scheduleWarningsByWoId.get(wo.id)
            const days = daysUntil(wo.scheduled_on ?? "")
            const timeStr = formatScheduleTimeHm(wo.scheduled_time)
            const slotKey =
              wo.assigned_user_id && wo.scheduled_on
                ? `${wo.assigned_user_id}|${wo.scheduled_on}|${timeToSlotIndex(wo.scheduled_time)}`
                : ""
            const slotOverlap = Boolean(slotKey && overlapKeys.has(slotKey))
            return (
              <div
                key={wo.id}
                className={cn(
                  "flex items-stretch gap-0 bg-card rounded-lg border border-border overflow-hidden hover:shadow-sm transition-shadow",
                  urgencyBg(days)
                )}
              >
                <div className="flex flex-col items-center justify-center px-4 py-3 border-r border-border bg-muted/30 min-w-[72px] shrink-0">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide leading-none">
                    {new Date((wo.scheduled_on ?? "") + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-2xl font-bold text-foreground leading-tight">
                    {new Date((wo.scheduled_on ?? "") + "T12:00:00").getDate()}
                  </span>
                  {timeStr && (
                    <span className="text-xs mt-1 text-muted-foreground tabular-nums">{timeStr}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 px-4 py-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {formatWorkOrderDisplay(wo.work_order_number ?? undefined, wo.id)}
                        </p>
                        {slotOverlap ? (
                          <AlertTriangle
                            className="h-3.5 w-3.5 shrink-0 text-[color:var(--status-warning)]"
                            aria-label="Technician overlap"
                          />
                        ) : null}
                      </div>
                      <Link
                        href={`/work-orders?open=${wo.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary truncate min-w-0 block"
                      >
                        {wo.title}
                      </Link>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
                        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30"
                      )}
                    >
                      {formatWoStatusLabel(wo.status)}
                    </span>
                  </div>
                  <OperationalBadgeRow badges={wo.opsBadges ?? []} className="mt-0.5" cap={5} />
                  {softWarnings?.length ? (
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-muted-foreground">
                      {softWarnings.map((w) => (
                        <li key={w.key}>{w.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{wo.customerName}</span>
                    <span className="flex items-center gap-1 min-w-0">
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span className="truncate">{row.equipmentName}</span>
                    </span>
                    {row.location ? (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{row.location}</span>
                      </span>
                    ) : null}
                    {wo.technicianLabel ? (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0" />
                        {wo.technicianLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}

function UnassignedWorkLane({
  rows,
  loading,
  technicians,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  assigningWoId,
  onQuickAssign,
}: {
  rows: ScheduledWoRowView[]
  loading: boolean
  technicians: ScheduleTechnicianOption[]
  search: string
  onSearchChange: (value: string) => void
  filter: "all" | "needs_assignment" | "needs_scheduling" | "overdue" | "open_only"
  onFilterChange: (value: "all" | "needs_assignment" | "needs_scheduling" | "overdue" | "open_only") => void
  assigningWoId: string | null
  onQuickAssign: (args: { wo: DispatchWo; technicianId: string | null; scheduledOn: string; scheduledTime: string | null }) => void
}) {
  return (
    <Card className="border border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Unassigned work lane
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal pt-0.5">
              Open work needing technician assignment, date, or time before dispatch.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {rows.length} in queue
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search WO, customer, equipment, location..."
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as typeof filter)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All unassigned</option>
            <option value="needs_assignment">Needs assignment</option>
            <option value="needs_scheduling">Needs date/time</option>
            <option value="overdue">Overdue unscheduled</option>
            <option value="open_only">Open only</option>
          </select>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading unassigned work...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background/60 px-4 py-6 text-center">
            <ClipboardList className="mx-auto h-7 w-7 text-muted-foreground/40" aria-hidden />
            <p className="mt-2 text-sm font-medium text-foreground">No work waiting for dispatch</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Maintenance-generated work orders will appear here until assigned and scheduled.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.slice(0, 12).map((row) => {
              const wo = row.wo
              const state = deriveDispatchState({
                status: wo.status,
                customerId: wo.customer_id,
                scheduledOn: wo.scheduled_on,
                scheduledTime: wo.scheduled_time,
                assignedUserId: wo.assigned_user_id,
              })
              const defaultDate = wo.scheduled_on ?? toYmd(new Date())
              return (
                <UnassignedWorkCard
                  key={wo.id}
                  row={row}
                  state={state}
                  technicians={technicians}
                  defaultDate={defaultDate}
                  assigning={assigningWoId === wo.id}
                  onQuickAssign={(args) => onQuickAssign({ wo, ...args })}
                />
              )
            })}
          </div>
        )}
        {!loading && rows.length > 12 ? (
          <p className="text-xs text-muted-foreground">Showing first 12 of {rows.length}. Use search or filters to narrow the queue.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function assignedScheduleKey(wo: DispatchWo): string | null {
  return wo.assigned_technician_id ?? wo.assigned_user_id ?? null
}

function DraggableScheduleCard({
  row,
  compact = false,
}: {
  row: ScheduledWoRowView
  compact?: boolean
}) {
  const wo = row.wo
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: DND.wo(wo.id),
    data: { woId: wo.id },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none select-none">
      <ScheduleDragCard row={row} compact={compact} dragging={isDragging} />
    </div>
  )
}

function ScheduleDragCard({
  row,
  compact = false,
  dragging = false,
  overlay = false,
}: {
  row: ScheduledWoRowView
  compact?: boolean
  dragging?: boolean
  overlay?: boolean
}) {
  const wo = row.wo
  const state = deriveDispatchState({
    status: wo.status,
    customerId: wo.customer_id,
    scheduledOn: wo.scheduled_on,
    scheduledTime: wo.scheduled_time,
    assignedUserId: wo.assigned_user_id,
    assignedTechnicianId: wo.assigned_technician_id,
  })
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-2 py-1.5 text-left shadow-sm",
        "cursor-grab active:cursor-grabbing",
        wo.priority === "critical" || wo.priority === "high"
          ? "border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/10"
          : "border-border",
        dragging && "opacity-40",
        overlay && "w-64 shadow-xl ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-primary">
          {formatWorkOrderDisplay(wo.work_order_number, wo.id)}
        </span>
        <Badge variant="outline" className="text-[9px]">
          {formatWoStatusLabel(wo.status)}
        </Badge>
      </div>
      <p className={cn("mt-0.5 font-medium text-foreground", compact ? "line-clamp-1 text-[11px]" : "line-clamp-2 text-xs")}>
        {wo.customerName}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {formatScheduleTimeHm(wo.scheduled_time) || "No time"} · {row.location || wo.serviceLocationLabel || "No location"}
      </p>
      {!compact && state.dispatchIncomplete ? (
        <p className="mt-1 text-[10px] text-[color:var(--status-warning)]">Dispatch incomplete</p>
      ) : null}
    </div>
  )
}

function ScheduleDropCell({
  technicianId,
  slotIdx,
  children,
}: {
  technicianId: string
  slotIdx: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: DND.cell(technicianId, slotIdx) })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[58px] border-b border-l border-border/50 p-1 transition-colors",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
    >
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function DragScheduleBoard({
  date,
  technicians,
  rows,
  unassignedRows,
  activeRow,
  onDragStart,
  onDragEnd,
}: {
  date: string
  technicians: ScheduleTechnicianOption[]
  rows: ScheduledWoRowView[]
  unassignedRows: ScheduledWoRowView[]
  activeRow: ScheduledWoRowView | null
  onDragStart: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )
  const dayRows = rows.filter((row) => row.wo.scheduled_on === date)
  const rowsBySlot = new Map<string, ScheduledWoRowView[]>()
  for (const row of dayRows) {
    const techId = assignedScheduleKey(row.wo)
    if (!techId) continue
    const key = `${techId}@@${timeToSlotIndex(row.wo.scheduled_time)}`
    const list = rowsBySlot.get(key) ?? []
    list.push(row)
    rowsBySlot.set(key, list)
  }

  if (technicians.length === 0) return null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Drag schedule for {date}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal pt-0.5">
            Drag an unassigned job or scheduled block onto a technician time slot. Quick assignment remains available below.
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Unassigned queue</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unassignedRows.slice(0, 6).map((row) => (
                <DraggableScheduleCard key={row.wo.id} row={row} compact />
              ))}
              {unassignedRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching unassigned work.</p>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <div
              className="grid min-w-[760px]"
              style={{ gridTemplateColumns: `70px repeat(${technicians.length}, minmax(160px, 1fr))` }}
            >
              <div className="border-b border-border bg-muted/40 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Time
              </div>
              {technicians.map((tech) => (
                <div key={tech.id} className="border-b border-l border-border bg-muted/40 px-2 py-2">
                  <p className="truncate text-xs font-semibold text-foreground">{tech.label}</p>
                </div>
              ))}
              {Array.from({ length: DISPATCH_SLOT_COUNT }, (_, slotIdx) => (
                <Fragment key={slotIdx}>
                  <div className="border-b border-border/60 bg-muted/10 px-2 py-2 text-[10px] text-muted-foreground">
                    {formatSlotLabel(slotIdx)}
                  </div>
                  {technicians.map((tech) => {
                    const list = rowsBySlot.get(`${tech.id}@@${slotIdx}`) ?? []
                    return (
                      <ScheduleDropCell key={`${tech.id}-${slotIdx}`} technicianId={tech.id} slotIdx={slotIdx}>
                        {list.map((row) => (
                          <DraggableScheduleCard key={row.wo.id} row={row} compact />
                        ))}
                      </ScheduleDropCell>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <DragOverlay dropAnimation={null}>
        {activeRow ? <ScheduleDragCard row={activeRow} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function UnassignedWorkCard({
  row,
  state,
  technicians,
  defaultDate,
  assigning,
  onQuickAssign,
}: {
  row: ScheduledWoRowView
  state: ReturnType<typeof deriveDispatchState>
  technicians: ScheduleTechnicianOption[]
  defaultDate: string
  assigning: boolean
  onQuickAssign: (args: { technicianId: string | null; scheduledOn: string; scheduledTime: string | null }) => void
}) {
  const wo = row.wo
  const [technicianId, setTechnicianId] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState(formatScheduleTimeHm(wo.scheduled_time) || "08:00")

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/work-orders?workOrderId=${encodeURIComponent(wo.id)}`} className="font-mono text-[11px] text-primary hover:underline">
              {formatWorkOrderDisplay(wo.work_order_number, wo.id)}
            </Link>
            <Badge variant="outline" className="text-[10px]">{formatWoStatusLabel(wo.status)}</Badge>
            <Badge variant="outline" className="text-[10px]">{state.label}</Badge>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{wo.customerName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {row.location || wo.serviceLocationLabel || "Location not set"} · {row.equipmentName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            {state.readyToDispatch ? (
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-primary">Ready to dispatch</span>
            ) : null}
            {state.needsAssignment ? (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">Needs assignment</span>
            ) : null}
            {state.needsScheduling ? (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">Needs date/time</span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>{wo.priority ? `${formatWoStatusLabel(wo.priority)} priority` : "Normal priority"}</p>
          <p>{wo.type ? formatWoStatusLabel(wo.type) : "Service"}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_110px_auto]">
        <select
          value={technicianId}
          onChange={(event) => setTechnicianId(event.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="">Select technician</option>
          {technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>{tech.label}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={assigning || !technicianId || !date}
          onClick={() => onQuickAssign({ technicianId, scheduledOn: date, scheduledTime: time || null })}
        >
          {assigning ? "Saving..." : "Assign"}
        </Button>
      </div>
    </div>
  )
}

// ─── Notification Timeline ────────────────────────────────────────────────────

function NotificationTimeline({ plans }: { plans: MaintenancePlan[] }) {
  const upcoming = useMemo(() => {
    const events: Array<{
      planId: string; planName: string; equipmentName: string;
      customerName: string; channel: string; triggerDays: number;
      fireDate: string; recipient: string;
    }> = []
    const today = new Date()
    plans.filter((p) => p.status === "Active").forEach((plan) => {
      const due = new Date(plan.nextDueDate)
      plan.notificationRules.filter((r) => r.enabled).forEach((rule) => {
        const fireDate = new Date(due)
        fireDate.setDate(fireDate.getDate() - rule.triggerDays)
        if (fireDate >= today) {
          rule.recipients.forEach((rec) => {
            events.push({
              planId: plan.id, planName: plan.name,
              equipmentName: plan.equipmentName, customerName: plan.customerName,
              channel: rule.channel, triggerDays: rule.triggerDays,
              fireDate: fireDate.toISOString().split("T")[0], recipient: rec,
            })
          })
        }
      })
    })
    return events.sort((a, b) => new Date(a.fireDate).getTime() - new Date(b.fireDate).getTime()).slice(0, 18)
  }, [plans])

  const CHANNEL_STYLE: Record<string, string> = {
    "Email":          "bg-blue-50 text-blue-700 border-blue-200",
    "SMS":            "bg-green-50 text-green-700 border-green-200",
    "Internal Alert": "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  }

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          Upcoming Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming notifications.</p>
          )}
          {upcoming.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b last:border-0 border-border">
              <div className="flex flex-col items-center min-w-[44px]">
                <span className="text-xs font-bold text-foreground">{new Date(ev.fireDate).getDate()}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{new Date(ev.fireDate).toLocaleDateString("en-US", { month: "short" })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", CHANNEL_STYLE[ev.channel] ?? "bg-muted text-muted-foreground border-border")}>
                    {ev.channel}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{ev.triggerDays}d warning</span>
                </div>
                <p className="text-xs font-medium text-foreground mt-0.5 truncate">{ev.planName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{ev.customerName} · {ev.recipient}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Compact alert banners ────────────────────────────────────────────────────
//
// Replaces the previous full-paragraph red/amber strip that listed every plan
// inline. Shows an actionable summary by default; expands into a scrollable list
// of plan rows with per-row "View plan" / "Create work order" affordances.

const PREVIEW_PLAN_ROWS = 5

function PlanAlertRow({
  plan,
  tone,
  onOpenPlan,
  onCreateWo,
  alreadyCreated,
}: {
  plan: MaintenancePlan
  tone: "danger" | "warning"
  onOpenPlan: (id: string) => void
  onCreateWo: (plan: MaintenancePlan) => void | Promise<void>
  alreadyCreated: boolean
}) {
  const days = daysUntil(plan.nextDueDate)
  const ageLabel = formatDaysLabel(days)
  const ageClass =
    tone === "danger"
      ? "text-red-700 dark:text-red-300"
      : "text-amber-700 dark:text-amber-300"

  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3",
        "ds-hover-list-row-sm",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{plan.name}</p>
          <span className={cn("shrink-0 text-xs font-semibold tabular-nums", ageClass)}>
            {ageLabel}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {plan.customerName}
          {plan.equipmentName ? ` · ${plan.equipmentName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onOpenPlan(plan.id)}
        >
          View plan
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={alreadyCreated}
          onClick={() => void onCreateWo(plan)}
        >
          {alreadyCreated ? "WO created" : "Create work order"}
        </Button>
      </div>
    </li>
  )
}

function CompactPlanAlert({
  tone,
  plans,
  onOpenPlan,
  onCreateWo,
  createdIds,
}: {
  tone: "danger" | "warning"
  plans: MaintenancePlan[]
  onOpenPlan: (id: string) => void
  onCreateWo: (plan: MaintenancePlan) => void | Promise<void>
  createdIds: Set<string>
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Most-overdue first; for "warning" tone, soonest-due first (same comparator).
  const sorted = useMemo(
    () =>
      [...plans].sort(
        (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime(),
      ),
    [plans],
  )

  if (plans.length === 0) return null

  const isDanger = tone === "danger"
  const Icon = isDanger ? AlertTriangle : Clock
  const count = plans.length

  const visible = showAll ? sorted : sorted.slice(0, PREVIEW_PLAN_ROWS)
  const hiddenCount = Math.max(0, sorted.length - visible.length)

  const headline = isDanger
    ? `${count} plan${count !== 1 ? "s" : ""} overdue`
    : `${count} plan${count !== 1 ? "s" : ""} due within 7 days`
  const helper = isDanger
    ? "Review overdue maintenance plans that may need scheduling."
    : "These plans are coming up soon — schedule before they slip."

  return (
    <div
      role="region"
      aria-label={isDanger ? "Overdue maintenance plans" : "Upcoming maintenance plans"}
      className={cn(
        "rounded-lg border shadow-sm",
        isDanger
          ? "border-red-200/70 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/30",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isDanger
            ? "hover:bg-red-100/60 dark:hover:bg-red-950/50"
            : "hover:bg-amber-100/60 dark:hover:bg-amber-950/50",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isDanger ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold",
              isDanger ? "text-red-800 dark:text-red-200" : "text-amber-900 dark:text-amber-200",
            )}
          >
            {headline}
          </p>
          <p
            className={cn(
              "text-xs",
              isDanger ? "text-red-700/80 dark:text-red-300/80" : "text-amber-800/80 dark:text-amber-300/80",
            )}
          >
            {helper}
          </p>
        </div>
        <span
          className={cn(
            "ml-2 hidden shrink-0 items-center gap-1 text-xs font-medium sm:inline-flex",
            isDanger ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300",
          )}
        >
          {expanded ? "Hide details" : "Show details"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform sm:hidden",
            expanded && "rotate-180",
            isDanger ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300",
          )}
        />
      </button>

      {expanded && (
        <div
          className={cn(
            "border-t",
            isDanger ? "border-red-200/70 dark:border-red-900/50" : "border-amber-200/70 dark:border-amber-900/50",
          )}
        >
          <ul
            className={cn(
              "max-h-[19rem] divide-y overflow-y-auto bg-card/60",
              isDanger ? "divide-red-100 dark:divide-red-900/40" : "divide-amber-100 dark:divide-amber-900/40",
            )}
          >
            {visible.map((plan) => (
              <PlanAlertRow
                key={plan.id}
                plan={plan}
                tone={tone}
                onOpenPlan={onOpenPlan}
                onCreateWo={onCreateWo}
                alreadyCreated={createdIds.has(plan.id)}
              />
            ))}
          </ul>
          {hiddenCount > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Showing {visible.length} of {sorted.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setShowAll(true)}
              >
                View all {sorted.length}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ServiceSchedulePageInner() {
  const { plans, organizationId } = useMaintenancePlans()
  const { permissions } = useOrgPermissions()
  const { toast } = useToast()
  const assignedOnlyView = isAssignedWorkOnly(permissions)
  const canManageSchedule = permissions.canManageDispatch

  const [scheduledWoRows, setScheduledWoRows] = useState<ScheduledWoRowView[]>([])
  const [unassignedWoRows, setUnassignedWoRows] = useState<ScheduledWoRowView[]>([])
  const [assignTechnicians, setAssignTechnicians] = useState<ScheduleTechnicianOption[]>([])
  const [unassignedSearch, setUnassignedSearch] = useState("")
  const [unassignedFilter, setUnassignedFilter] = useState<"all" | "needs_assignment" | "needs_scheduling" | "overdue" | "open_only">("all")
  const [assigningWoId, setAssigningWoId] = useState<string | null>(null)
  const [activeDragRow, setActiveDragRow] = useState<ScheduledWoRowView | null>(null)
  const [scheduledWoLoading, setScheduledWoLoading] = useState(true)
  const [scheduledWoRefresh, setScheduledWoRefresh] = useState(0)

  useEffect(() => {
    let active = true

    async function loadScheduledWorkOrders() {
      setScheduledWoLoading(true)
      try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setScheduledWoRows([])
          setUnassignedWoRows([])
        }
        return
      }

      if (!organizationId) {
        if (active) {
          setScheduledWoRows([])
          setUnassignedWoRows([])
        }
        return
      }

      const orgId = organizationId
      const assignedScope = assignedOnlyView
        ? await loadAssignedWorkScope(supabase, { organizationId: orgId, userId: user.id })
        : null
      const assignedWorkOrderIds = assignedScope?.workOrderIds ?? []

      const selFull =
        "id, work_order_number, customer_id, customer_location_id, equipment_id, title, status, scheduled_on, scheduled_time, assigned_user_id, assigned_technician_id, priority, type, billing_state, maintenance_plan_id, calibration_template_id, created_by_pm_automation, billable_to_customer, warranty_review_required, total_parts_cents, created_at, completed_at"
      const selNoBilling = WO_DISPATCH_SCHEDULE_SELECT_NO_BILLING_WITH_NUM
      const selMini =
        "id, work_order_number, customer_id, customer_location_id, equipment_id, title, status, scheduled_on, scheduled_time, assigned_user_id, assigned_technician_id, priority, type, created_by_pm_automation, created_at"

      async function fetchScheduled() {
        let mini = false
        let fullQuery = supabase
          .from("work_orders")
          .select(selFull)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .not("scheduled_on", "is", null)
        if (assignedOnlyView) {
          fullQuery = assignedWorkOrderIds.length > 0
            ? fullQuery.in("id", assignedWorkOrderIds)
            : fullQuery.eq("id", "__none__")
        }
        let res = await fullQuery
          .order("scheduled_on", { ascending: true })
          .order("scheduled_time", { ascending: true, nullsFirst: false })
        if (res.error && missingOperationalBillingColumns(res.error)) {
          let noBillingQuery = supabase
            .from("work_orders")
            .select(selNoBilling)
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .not("scheduled_on", "is", null)
          if (assignedOnlyView) {
            noBillingQuery = assignedWorkOrderIds.length > 0
              ? noBillingQuery.in("id", assignedWorkOrderIds)
              : noBillingQuery.eq("id", "__none__")
          }
          res = await noBillingQuery
            .order("scheduled_on", { ascending: true })
            .order("scheduled_time", { ascending: true, nullsFirst: false })
        }
        if (res.error && missingWorkOrderNumberColumn(res.error)) {
          mini = true
          let miniQuery = supabase
            .from("work_orders")
            .select(selMini)
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .not("scheduled_on", "is", null)
          if (assignedOnlyView) {
            miniQuery = assignedWorkOrderIds.length > 0
              ? miniQuery.in("id", assignedWorkOrderIds)
              : miniQuery.eq("id", "__none__")
          }
          res = await miniQuery
            .order("scheduled_on", { ascending: true })
            .order("scheduled_time", { ascending: true, nullsFirst: false })
        }
        return { data: res.data, error: res.error, mini }
      }

      async function fetchUnassigned() {
        let mini = false
        let res = await supabase
          .from("work_orders")
          .select(selFull)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .in("status", ["open", "scheduled", "in_progress"])
          .or("assigned_user_id.is.null,assigned_technician_id.is.null,scheduled_on.is.null,scheduled_time.is.null")
          .order("created_at", { ascending: false })
          .limit(75)
        if (res.error && missingOperationalBillingColumns(res.error)) {
          res = await supabase
            .from("work_orders")
            .select(selNoBilling)
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .in("status", ["open", "scheduled", "in_progress"])
            .or("assigned_user_id.is.null,assigned_technician_id.is.null,scheduled_on.is.null,scheduled_time.is.null")
            .order("created_at", { ascending: false })
            .limit(75)
        }
        if (res.error && missingWorkOrderNumberColumn(res.error)) {
          mini = true
          res = await supabase
            .from("work_orders")
            .select(selMini)
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .in("status", ["open", "scheduled", "in_progress"])
            .or("assigned_user_id.is.null,assigned_technician_id.is.null,scheduled_on.is.null,scheduled_time.is.null")
            .order("created_at", { ascending: false })
            .limit(75)
        }
        return { data: res.data, error: res.error, mini }
      }

      const [scheduledRes, unassignedRes] = await Promise.all([
        fetchScheduled(),
        canManageSchedule ? fetchUnassigned() : Promise.resolve({ data: [] as DbScheduledWoRow[], error: null, mini: false }),
      ])
      const { data: rows, error: woError } = scheduledRes

      if (woError || !rows || !active) {
        if (active) {
          setScheduledWoRows([])
          setUnassignedWoRows([])
        }
        return
      }

      const list = rows as DbScheduledWoRow[]
      const unassignedList = (unassignedRes.error ? [] : (unassignedRes.data as DbScheduledWoRow[] | null) ?? [])
      const combined = [...list, ...unassignedList.filter((row) => !list.some((scheduled) => scheduled.id === row.id))]
      const customerIds = [...new Set(combined.map((r) => r.customer_id))]
      const equipmentIds = [...new Set(combined.map((r) => r.equipment_id).filter((id): id is string => Boolean(id)))]
      const assigneeIds = [
        ...new Set(combined.map((r) => r.assigned_user_id).filter((id): id is string => Boolean(id))),
      ]

      const customerMap = new Map<string, string>()
      if (customerIds.length > 0) {
        const { data: custRows } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .in("id", customerIds)

        ;((custRows as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
          customerMap.set(c.id, c.company_name)
        })
      }

      const equipmentMap = new Map<
        string,
        {
          name: string
          location: string
          equipment_code: string | null
          serial_number: string | null
          category: string | null
        }
      >()
      if (equipmentIds.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipment")
          .select("id, name, location_label, equipment_code, serial_number, category")
          .eq("organization_id", orgId)
          .in("id", equipmentIds)

        ;(
          (eqRows as Array<{
            id: string
            name: string
            location_label: string | null
            equipment_code: string | null
            serial_number: string | null
            category: string | null
          }> | null) ?? []
        ).forEach((e) => {
          equipmentMap.set(e.id, {
            name: e.name,
            location: e.location_label ?? "",
            equipment_code: e.equipment_code,
            serial_number: e.serial_number,
            category: e.category,
          })
        })
      }

      const profileMap = new Map<string, string>()
      if (assigneeIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assigneeIds)

        ;(
          (profRows as Array<{ id: string; full_name: string | null; email: string | null }> | null) ?? []
        ).forEach((p) => {
          const label =
            (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Technician"
          profileMap.set(p.id, label)
        })
      }

      if (!active) return

      const dispatchRows = combined.map((row) => mapDbRowToDispatchWoRow(row, scheduledRes.mini && unassignedRes.mini))

      const techByUserId = new Map<string, DispatchTech>()
      for (const id of assigneeIds) {
        const label = profileMap.get(id) ?? "Technician"
        techByUserId.set(id, {
          id,
          label,
          initials: scheduleInitialsFromName(label),
          avatarUrl: null,
        })
      }

      const enriched = await enrichDispatchWorkOrders(supabase, orgId, dispatchRows, techByUserId, customerMap)

      const mappedAll: ScheduledWoRowView[] = combined.map((row, i) => {
        const eq = row.equipment_id ? equipmentMap.get(row.equipment_id) : undefined
        const equipmentName = eq
          ? getEquipmentDisplayPrimary({
              id: row.equipment_id ?? "",
              name: eq.name,
              equipment_code: eq.equipment_code,
              serial_number: eq.serial_number,
              category: eq.category,
            })
          : "Service visit"
        return {
          wo: enriched[i]!,
          equipmentName,
          location: eq?.location ?? "",
        }
      })

      const byId = new Map(mappedAll.map((row) => [row.wo.id, row]))
      setScheduledWoRows(list.map((row) => byId.get(row.id)).filter((row): row is ScheduledWoRowView => Boolean(row)))
      setUnassignedWoRows(unassignedList.map((row) => byId.get(row.id)).filter((row): row is ScheduledWoRowView => Boolean(row)))

      const assignOpts = await loadTechnicianAssignOptions(supabase, orgId)
      if (!active) return
      setAssignTechnicians(toScheduleAssigneePickerOptions(assignOpts))
      } catch {
        if (active) {
          setScheduledWoRows([])
          setUnassignedWoRows([])
        }
      } finally {
        if (active) setScheduledWoLoading(false)
      }
    }

    loadScheduledWorkOrders()
    return () => {
      active = false
    }
  }, [scheduledWoRefresh, organizationId, assignedOnlyView, canManageSchedule])

  // View state
  const [viewTab, setViewTab]             = useState<ViewTab>("list")
  const [calSub, setCalSub]               = useState<CalendarSub>("week")
  const [teamScope, setTeamScope]         = useState<TeamScope>("team")
  const [viewMode, setViewMode]           = useState<ViewMode>("1")
  const [offset, setOffset]               = useState(0)

  // Calendar date
  const [calDate, setCalDate]             = useState<Date>(() => new Date())

  // Filters
  const [customerFilter, setCustomerFilter] = useState("All")
  const [statusFilter, setStatusFilter]   = useState("All")
  const [techFilter, setTechFilter]       = useState("All")
  const [scheduleOpsFilter, setScheduleOpsFilter] = useState<DispatchFilterId>("all")
  const [scheduleStatusFilter, setScheduleStatusFilter] = usePersistedDispatchPref<DispatchStatusKey[]>({
    scope: "schedule",
    key: "status-filter",
    organizationId,
    defaultValue: DEFAULT_DISPATCH_STATUSES,
    isValid: (v): v is DispatchStatusKey[] => {
      if (!Array.isArray(v)) return false
      const known = new Set<string>(DISPATCH_STATUS_ORDER)
      return v.every((x) => typeof x === "string" && known.has(x))
    },
  })
  const [includeInvoicedSchedule, setIncludeInvoicedSchedule] = usePersistedDispatchPref<boolean>({
    scope: "schedule",
    key: "include-invoiced",
    organizationId,
    defaultValue: false,
    isValid: (v): v is boolean => typeof v === "boolean",
  })

  function handleScheduleStatusToggle(key: DispatchStatusKey) {
    setScheduleStatusFilter((prev) => {
      const set = new Set(prev)
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return [...set]
    })
  }

  // Drawer / modal state
  const [createdIds, setCreatedIds]       = useState<Set<string>>(new Set())
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen]   = useState(false)
  const [quickAppointmentOpen, setQuickAppointmentOpen] = useState(false)
  const [reschedulePlan, setReschedulePlan] = useState<MaintenancePlan | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedPlanId(openId)
      router.replace("/service-schedule", { scroll: false })
    }
  }, [searchParams, router])

  const [today, setToday] = useState<Date>(() => new Date(0))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    setToday(now)
    setCalDate(now)
    setMounted(true)
  }, [])

  function handleModeChange(m: ViewMode) { setViewMode(m); setOffset(0) }

  const monthKeys = useMemo(() => buildMonthKeys(viewMode, offset, today), [viewMode, offset, today])

  const customers = useMemo(() =>
    ["All", ...Array.from(new Set(plans.map((p) => p.customerName))).sort()],
    [plans]
  )
  const technicians = useMemo(() =>
    ["All", ...Array.from(new Set(plans.map((p) => p.technicianName))).sort()],
    [plans]
  )

  const filteredScheduledWoRows = useMemo(() => {
    const opsFiltered = scheduledWoRows.filter(
      (row) => filterDispatchRows([row.wo], scheduleOpsFilter).length > 0,
    )
    const statusBucketed = filterByStatuses(
      opsFiltered.map((r) => r.wo),
      scheduleStatusFilter,
    )
    const allowedIds = new Set(statusBucketed.map((w) => w.id))
    let rows = opsFiltered.filter((row) => allowedIds.has(row.wo.id))
    if (customerFilter !== "All") {
      rows = rows.filter((row) => row.wo.customerName === customerFilter)
    }
    if (techFilter !== "All") {
      rows = rows.filter((row) => row.wo.technicianLabel === techFilter)
    }
    return rows
  }, [scheduledWoRows, scheduleOpsFilter, scheduleStatusFilter, customerFilter, techFilter])

  const filteredUnassignedWoRows = useMemo(() => {
    const q = unassignedSearch.trim().toLowerCase()
    return unassignedWoRows.filter((row) => {
      const wo = row.wo
      const state = deriveDispatchState({
        status: wo.status,
        customerId: wo.customer_id,
        scheduledOn: wo.scheduled_on,
        scheduledTime: wo.scheduled_time,
        assignedUserId: wo.assigned_user_id,
      })
      if (unassignedFilter === "needs_assignment" && !state.needsAssignment) return false
      if (unassignedFilter === "needs_scheduling" && !state.needsScheduling) return false
      if (unassignedFilter === "overdue" && !state.overdueUnscheduled) return false
      if (unassignedFilter === "open_only" && wo.status !== "open") return false
      if (!q) return true
      return [
        formatWorkOrderDisplay(wo.work_order_number, wo.id),
        wo.title,
        wo.customerName,
        row.equipmentName,
        row.location,
        wo.serviceLocationLabel ?? "",
        wo.priority ?? "",
        wo.type ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [unassignedWoRows, unassignedFilter, unassignedSearch])

  const scheduleStatusCounts = useMemo(() => {
    const opsFiltered = scheduledWoRows
      .filter((row) => filterDispatchRows([row.wo], scheduleOpsFilter).length > 0)
      .map((r) => r.wo)
    return countByStatus(opsFiltered)
  }, [scheduledWoRows, scheduleOpsFilter])

  const scheduleOverlapKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of filteredScheduledWoRows) {
      const w = row.wo
      if (!w.assigned_user_id || !w.scheduled_on) continue
      const slot = timeToSlotIndex(w.scheduled_time)
      const k = `${w.assigned_user_id}|${w.scheduled_on}|${slot}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k))
  }, [filteredScheduledWoRows])

  const scheduleListWarningsByWoId = useMemo(() => {
    const peers = filteredScheduledWoRows.map(scheduleRowToWarnPeer)
    return buildScheduleWarningsByPeer(peers)
  }, [filteredScheduledWoRows])

  /**
   * Phase 2: lightweight scheduling KPIs derived from the same operational
   * flag set the dispatch board uses. Click-to-filter via `scheduleOpsFilter`
   * keeps the schedule view in sync with dispatch parity.
   */
  const scheduleKpi = useMemo(() => {
    const k = { dueToday: 0, dueTomorrow: 0, dueNext7: 0, overdue: 0, unassigned: 0 }
    for (const row of scheduledWoRows) {
      const f = row.wo.opsFlags
      if (!f) continue
      if (f.due_today) k.dueToday++
      if (f.due_tomorrow) k.dueTomorrow++
      if (f.due_next_7) k.dueNext7++
      if (f.sched_past_due) k.overdue++
      if (f.unassigned_aging) k.unassigned++
    }
    return k
  }, [scheduledWoRows])

  /**
   * Phase 2: technician roster derived from already-loaded scheduled WO rows
   * for the inline week overview (no extra fetch). Falls back to empty when
   * nothing is scheduled this period — overview hides itself in that case.
   */
  const scheduleTechnicians = useMemo<DispatchTech[]>(() => {
    const map = new Map<string, DispatchTech>()
    for (const row of scheduledWoRows) {
      const id = row.wo.assigned_user_id
      if (!id) continue
      const label = row.wo.technicianLabel?.trim() || "Technician"
      if (!map.has(id)) {
        map.set(id, {
          id,
          label,
          initials: scheduleInitialsFromName(label),
          avatarUrl: null,
        })
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [scheduledWoRows])

  const scheduleWeekDispatchRows = useMemo<DispatchWo[]>(
    () => filteredScheduledWoRows.map((r) => r.wo),
    [filteredScheduledWoRows],
  )

  const [scheduleWeekAnchor, setScheduleWeekAnchor] = useState<Date>(() =>
    startOfWeekMonday(new Date()),
  )
  const [scheduleSelectedYmd, setScheduleSelectedYmd] = useState<string>(() => toYmd(new Date()))

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (teamScope === "my" && p.technicianName !== CURRENT_USER) return false
      if (customerFilter !== "All" && p.customerName !== customerFilter) return false
      if (statusFilter === "Active" && p.status !== "Active") return false
      if (statusFilter === "Paused" && p.status !== "Paused") return false
      if (techFilter !== "All" && p.technicianName !== techFilter) return false
      return true
    })
  }, [plans, teamScope, customerFilter, statusFilter, techFilter])

  // List-view grouped plans (filtered + windowed)
  const grouped = useMemo(() => {
    return monthKeys.reduce<Record<string, MaintenancePlan[]>>((acc, key) => {
      acc[key] = filteredPlans.filter((p) => getMonthKey(p.nextDueDate) === key)
      return acc
    }, {})
  }, [filteredPlans, monthKeys])

  const totalVisible = Object.values(grouped).flat().length

  const overduePlans = useMemo(() =>
    plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) < 0), [plans])

  const criticalSoon = useMemo(() =>
    plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) >= 0 && daysUntil(p.nextDueDate) <= 7), [plans])

  async function handleCreateWo(plan: MaintenancePlan) {
    if (!organizationId) return
    const { error } = await createWorkOrderFromMaintenancePlan({
      organizationId,
      plan,
    })
    if (error) return
    setCreatedIds((prev) => new Set([...prev, plan.id]))
    setScheduledWoRefresh((n) => n + 1)
  }

  async function handleQuickAssignWork(args: {
    wo: DispatchWo
    technicianId: string | null
    scheduledOn: string
    scheduledTime: string | null
  }) {
    if (!organizationId || !args.technicianId || !args.scheduledOn) return
    setAssigningWoId(args.wo.id)
    const supabase = createBrowserSupabaseClient()
    const assignment = await workOrderAssignmentColumns(supabase, organizationId, args.technicianId)
    const patch = buildSchedulePatch({
      scheduledOn: args.scheduledOn,
      scheduledTimeHhMm: args.scheduledTime,
      assignment,
      previousStatus: args.wo.status,
    })
    const { error } = await supabase
      .from("work_orders")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", args.wo.id)
    setAssigningWoId(null)
    if (error) {
      window.alert(`Could not update schedule: ${error.message}`)
      return
    }

    const techLabel = assignTechnicians.find((tech) => tech.id === args.technicianId)?.label ?? "Technician"
    const previousTechnicianId = assignedScheduleKey(args.wo)
    const technicianChanged = previousTechnicianId !== args.technicianId
    const scheduleChanged =
      args.wo.scheduled_on !== args.scheduledOn ||
      (args.wo.scheduled_time ?? null) !== (args.scheduledTime ?? null)
    void emitSchedulingEvent({
      organizationId,
      workOrderId: args.wo.id,
      eventType: technicianChanged ? "reassign" : "reschedule",
      severity: "info",
      message: `Assigned to ${techLabel} for ${args.scheduledOn}${args.scheduledTime ? ` at ${args.scheduledTime}` : ""}.`,
      metadata: {
        source: "service_schedule.drag_or_quick_assign",
        previousTechnicianId,
        nextTechnicianId: args.technicianId,
        previousScheduledOn: args.wo.scheduled_on,
        previousScheduledTime: args.wo.scheduled_time,
        nextScheduledOn: args.scheduledOn,
        nextScheduledTime: args.scheduledTime,
        scheduleChanged,
      },
    })
    setScheduledWoRefresh((n) => n + 1)
  }

  function handleScheduleDragStart(event: DragStartEvent) {
    const woId = DND.parseWo(String(event.active.id))
    if (!woId) return
    setActiveDragRow(
      [...scheduledWoRows, ...unassignedWoRows].find((row) => row.wo.id === woId) ?? null,
    )
  }

  async function handleScheduleDragEnd(event: DragEndEvent) {
    const active = activeDragRow
    setActiveDragRow(null)
    const woId = DND.parseWo(String(event.active.id))
    const overId = event.over?.id != null ? String(event.over.id) : null
    const cell = overId ? DND.parseCell(overId) : null
    if (!woId || !cell || !active) return
    if (active.wo.status === "completed" || active.wo.status === "invoiced") {
      window.alert("This work order is already completed or invoiced. You can still edit it from the work-order drawer if needed.")
      return
    }
    const scheduledTime = slotIndexToTimeHhMm(cell.slotIdx)
    const overlaps = scheduledWoRows.filter((row) => {
      if (row.wo.id === woId) return false
      if (assignedScheduleKey(row.wo) !== cell.techId) return false
      return row.wo.scheduled_on === scheduleSelectedYmd && timeToSlotIndex(row.wo.scheduled_time) === cell.slotIdx
    })
    if (overlaps.length > 0) {
      const techLabel = assignTechnicians.find((tech) => tech.id === cell.techId)?.label ?? "This technician"
      toast({
        title: "Possible overlap",
        description: `${techLabel} already has ${overlaps.length} job${overlaps.length === 1 ? "" : "s"} in that slot — scheduling anyway (soft check).`,
      })
    }
    await handleQuickAssignWork({
      wo: active.wo,
      technicianId: cell.techId,
      scheduledOn: scheduleSelectedYmd,
      scheduledTime,
    })
  }

  return (
    <div className="flex flex-col gap-5">

      {assignedOnlyView ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Technician schedule</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing assigned scheduled jobs only. Maintenance-plan queues, team scheduling, and reassignment tools are restricted to dispatchers and admins.
          </p>
        </div>
      ) : (
        <>
          <CompactPlanAlert
            tone="danger"
            plans={overduePlans}
            onOpenPlan={setSelectedPlanId}
            onCreateWo={handleCreateWo}
            createdIds={createdIds}
          />
          <CompactPlanAlert
            tone="warning"
            plans={criticalSoon}
            onOpenPlan={setSelectedPlanId}
            onCreateWo={handleCreateWo}
            createdIds={createdIds}
          />
        </>
      )}

      {organizationId ?
        <AidenOperationalInsightsCard organizationId={organizationId} moduleContext="service_schedule" />
      : null}

      {/* ── View Tabs + My/Team Toggle ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* View tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          {([ 
            { id: "list",     label: "List",     Icon: List },
            { id: "calendar", label: "Calendar", Icon: CalendarDays },
            { id: "map",      label: "Map",      Icon: MapIcon },
          ] as { id: ViewTab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewTab(id)}
              className={cn(
                "flex items-center gap-1.5 min-h-11 px-3 rounded-md text-sm font-medium transition-colors sm:h-8 sm:min-h-0 touch-manipulation",
                viewTab === id
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Calendar sub-views — only show when calendar is active */}
        {viewTab === "calendar" && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
            {(["day", "week", "month"] as CalendarSub[]).map((sub) => (
              <button
                key={sub}
                onClick={() => setCalSub(sub)}
                className={cn(
                  "min-h-11 px-3 rounded-md text-sm font-medium transition-colors capitalize sm:h-8 sm:min-h-0 touch-manipulation",
                  calSub === sub
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* My / Team toggle */}
        {!assignedOnlyView ? (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          {([
            { id: "my",   label: "My Schedule",   Icon: User },
            { id: "team", label: "Team Schedule",  Icon: Users },
          ] as { id: TeamScope; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTeamScope(id)}
              className={cn(
                "flex items-center gap-1.5 min-h-11 px-3 rounded-md text-sm font-medium transition-colors sm:h-8 sm:min-h-0 touch-manipulation",
                teamScope === id
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        ) : null}

        {canManageSchedule ? (
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 shrink-0 h-9" onClick={() => setQuickAppointmentOpen(true)}>
              <Plus className="w-4 h-4" />
              New Appointment
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0 h-9" onClick={() => setScheduleOpen(true)}>
              <Calendar className="w-4 h-4" />
              Full Schedule
            </Button>
          </div>
        ) : null}
      </div>

      {/* ── Secondary Toolbar (filters + date nav for list view) ──────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="Active">Active Only</SelectItem>
            <SelectItem value="Paused">Paused Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="h-9 w-52 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {!assignedOnlyView && teamScope === "team" && (
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="h-9 w-44 text-sm shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={scheduleOpsFilter} onValueChange={(v) => setScheduleOpsFilter(v as DispatchFilterId)}>
          <SelectTrigger className="h-9 min-w-[200px] max-w-[min(100vw-2rem,280px)] text-sm shrink-0">
            <SelectValue placeholder="Operational focus" />
          </SelectTrigger>
          <SelectContent>
            {DISPATCH_FOCUS_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* List-only: view mode + date nav */}
        {viewTab === "list" && (
          <>
            <Select value={viewMode} onValueChange={(v) => handleModeChange(v as ViewMode)}>
              <SelectTrigger className="h-9 w-40 text-sm shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((m) => (
                  <SelectItem key={m} value={m}>{VIEW_MODE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="icon-sm" onClick={() => setOffset((n) => n - 1)} aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div
                className="inline-flex items-center h-9 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground min-w-[144px] justify-center select-none"
                suppressHydrationWarning
              >
                {mounted ? dateRangeLabel(viewMode, offset, today) : ""}
              </div>
              <Button variant="outline" size="icon-sm" onClick={() => setOffset((n) => n + 1)} aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </Button>
              {offset !== 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-9 px-2.5" onClick={() => setOffset(0)}>
                  Today
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Main content area */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Scheduling snapshot
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {(
                [
                  ["Due today", scheduleKpi.dueToday, "due_today"],
                  ["Tomorrow", scheduleKpi.dueTomorrow, "due_tomorrow"],
                  ["Next 7 days", scheduleKpi.dueNext7, "due_next_7"],
                  ["Overdue", scheduleKpi.overdue, "sched_past_due"],
                  ...(canManageSchedule ? ([["Unassigned 48h+", scheduleKpi.unassigned, "unassigned_aging"]] as const) : []),
                ] as const
              ).map(([label, n, focus]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => setScheduleOpsFilter(focus as DispatchFilterId)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-left transition-colors",
                    scheduleOpsFilter === focus
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                  aria-pressed={scheduleOpsFilter === focus}
                >
                  <p className="text-lg font-semibold tabular-nums text-foreground text-center">{n}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight text-center">{label}</p>
                </button>
              ))}
            </div>
          </div>
          <DispatchStatusFilter
            selected={scheduleStatusFilter}
            onToggle={handleScheduleStatusToggle}
            counts={scheduleStatusCounts}
            includeInvoiced={includeInvoicedSchedule}
            onIncludeInvoicedChange={setIncludeInvoicedSchedule}
            className="px-1"
          />
          {scheduleTechnicians.length > 0 && scheduleWeekDispatchRows.length > 0 ? (
            <DispatchWeekOverview
              technicians={scheduleTechnicians}
              workOrders={scheduleWeekDispatchRows}
              weekAnchor={scheduleWeekAnchor}
              selectedYmd={scheduleSelectedYmd}
              onSelectYmd={(ymd) => {
                setScheduleSelectedYmd(ymd)
                const next = new Date(ymd + "T12:00:00")
                setScheduleWeekAnchor(startOfWeekMonday(next))
                setCalDate(next)
                setCalSub("day")
                setViewTab("calendar")
              }}
            />
          ) : null}
          {canManageSchedule ? (
            <>
              <DragScheduleBoard
                date={scheduleSelectedYmd}
                technicians={assignTechnicians}
                rows={filteredScheduledWoRows}
                unassignedRows={filteredUnassignedWoRows}
                activeRow={activeDragRow}
                onDragStart={handleScheduleDragStart}
                onDragEnd={(event) => void handleScheduleDragEnd(event)}
              />
              <UnassignedWorkLane
                rows={filteredUnassignedWoRows}
                loading={scheduledWoLoading}
                technicians={assignTechnicians}
                search={unassignedSearch}
                onSearchChange={setUnassignedSearch}
                filter={unassignedFilter}
                onFilterChange={setUnassignedFilter}
                assigningWoId={assigningWoId}
                onQuickAssign={(args) => void handleQuickAssignWork(args)}
              />
            </>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">My schedule</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Showing assigned appointments only. Dispatch queues and drag/drop scheduling are restricted to dispatchers and admins.
              </p>
            </div>
          )}
          <ScheduledWorkOrdersSection
            rows={filteredScheduledWoRows}
            loading={scheduledWoLoading}
            overlapKeys={scheduleOverlapKeys}
            scheduleWarningsByWoId={scheduleListWarningsByWoId}
          />

          {viewTab === "list" && (
            <>
              {!assignedOnlyView && monthKeys.map((key) => {
                const monthPlans = grouped[key]
                if (!monthPlans?.length) return null
                return (
                  <MonthSection
                    key={key}
                    monthKey={key}
                    plans={monthPlans}
                    onCreateWo={handleCreateWo}
                    createdIds={createdIds}
                    onOpenPlan={setSelectedPlanId}
                    onReschedule={setReschedulePlan}
                    today={today}
                  />
                )
              })}
              {!assignedOnlyView && totalVisible === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No services scheduled in this window.</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting the date range or filters.</p>
                </div>
              )}
            </>
          )}

          {!assignedOnlyView && viewTab === "calendar" && (
            <CalendarView
              plans={filteredPlans}
              calSub={calSub}
              calDate={calDate}
              setCalDate={setCalDate}
              onOpenPlan={setSelectedPlanId}
              onCreateWo={handleCreateWo}
              createdIds={createdIds}
              onReschedule={setReschedulePlan}
            />
          )}

          {!assignedOnlyView && viewTab === "map" && (
            <MapView
              plans={filteredPlans}
              onOpenPlan={setSelectedPlanId}
              onReschedule={setReschedulePlan}
              createdIds={createdIds}
              onCreateWo={handleCreateWo}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:sticky lg:top-0">

          {/* Summary card — only in list view */}
          {!assignedOnlyView && viewTab === "list" && (
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  {VIEW_MODE_LABELS[viewMode].replace(" View", "") + " Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col gap-3">
                {monthKeys.map((key) => {
                  const count = grouped[key]?.length ?? 0
                  const estCost = (grouped[key] ?? []).reduce((a, p) => a + p.services.reduce((b, s) => b + s.estimatedCost, 0), 0)
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{monthLabel(key)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{count}</span>
                        {estCost > 0 && <span className="text-xs text-muted-foreground">${estCost.toLocaleString()}</span>}
                      </div>
                    </div>
                  )
                })}
                <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-semibold">
                  <span>Total</span>
                  <div className="flex items-center gap-2">
                    <span>{totalVisible}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      ${Object.values(grouped).flat().reduce((a, p) => a + p.services.reduce((b, s) => b + s.estimatedCost, 0), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Smart Scheduling */}
          {!assignedOnlyView ? <SmartSchedulingPanel plans={filteredPlans} /> : null}

          {/* Notification timeline */}
          {!assignedOnlyView ? <NotificationTimeline plans={plans} /> : null}
        </div>
      </div>

      {/* Drawers + Modals */}
      <MaintenancePlanDrawer planId={selectedPlanId} onClose={() => setSelectedPlanId(null)} />
      <ScheduleServiceDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => setScheduledWoRefresh((n) => n + 1)}
      />
      <QuickAppointmentDialog
        open={quickAppointmentOpen}
        onClose={() => setQuickAppointmentOpen(false)}
        defaultDate={scheduleSelectedYmd}
        defaultTimeHhMm={null}
        defaultTechnicianId={null}
        technicians={assignTechnicians}
        existingWorkOrders={scheduledWoRows.map((row) => row.wo)}
        onCreated={() => setScheduledWoRefresh((n) => n + 1)}
      />
      {reschedulePlan && (
        <RescheduleModal plan={reschedulePlan} onClose={() => setReschedulePlan(null)} />
      )}
    </div>
  )
}

export default function ServiceSchedulePage() {
  return <Suspense fallback={null}><ServiceSchedulePageInner /></Suspense>
}

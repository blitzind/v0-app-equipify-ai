"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import { DRAWER_BACKDROP_Z, EQUIPIFY_SCRIM } from "@/components/detail-drawer"
import { createWorkOrderFromMaintenancePlan } from "@/lib/maintenance-plans/create-work-order-from-plan"
import type { MaintenancePlan, WorkOrderType, WorkOrderPriority } from "@/lib/mock-data"
import {
  ChevronLeft,
  ChevronRight,
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

      <div className="relative z-10 bg-background rounded-xl border border-border shadow-2xl w-full max-w-md flex flex-col">
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
                  workOrderId:    plan.id,
                  ccEmails:       ["service@equipify.ai"],
                }}
              />
            )}

            {/* Reschedule */}
            <button
              onClick={(e) => { e.stopPropagation(); onReschedule(plan) }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors bg-background border-border text-foreground hover:bg-muted"
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
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors",
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
              selected === loc ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:bg-muted/30"
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
  equipment_id: string
  title: string
  status: string
  scheduled_on: string
  scheduled_time: string | null
  assigned_user_id: string | null
}

type ScheduledWorkOrderDisplay = {
  id: string
  workOrderNumber?: number
  title: string
  status: string
  scheduled_on: string
  scheduled_time: string | null
  customerName: string
  equipmentName: string
  location: string
  assigneeName: string | null
}

function formatScheduleTimeHm(t: string | null): string {
  if (!t) return ""
  const s = t.trim()
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatWoStatusLabel(status: string): string {
  return status.split("_").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : "")).join(" ")
}

function ScheduledWorkOrdersSection({
  rows,
  loading,
}: {
  rows: ScheduledWorkOrderDisplay[]
  loading: boolean
}) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          Scheduled Work Orders
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal pt-0.5">
          From Supabase: active work orders with a scheduled date in your default organization.
        </p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-3">
        {loading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading scheduled work orders…</p>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No scheduled work orders yet.</p>
        )}
        {!loading &&
          rows.map((wo) => {
            const days = daysUntil(wo.scheduled_on)
            const timeStr = formatScheduleTimeHm(wo.scheduled_time)
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
                    {new Date(wo.scheduled_on + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-2xl font-bold text-foreground leading-tight">
                    {new Date(wo.scheduled_on + "T12:00:00").getDate()}
                  </span>
                  {timeStr && (
                    <span className="text-xs mt-1 text-muted-foreground tabular-nums">{timeStr}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 px-4 py-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono text-muted-foreground">{formatWorkOrderDisplay(wo.workOrderNumber, wo.id)}</p>
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
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{wo.customerName}</span>
                    <span className="flex items-center gap-1 min-w-0">
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span className="truncate">{wo.equipmentName}</span>
                    </span>
                    {wo.location && (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{wo.location}</span>
                      </span>
                    )}
                    {wo.assigneeName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0" />
                        {wo.assigneeName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
      </CardContent>
    </Card>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function ServiceSchedulePageInner() {
  const { plans, organizationId } = useMaintenancePlans()

  const [scheduledWoRows, setScheduledWoRows] = useState<ScheduledWorkOrderDisplay[]>([])
  const [scheduledWoLoading, setScheduledWoLoading] = useState(true)
  const [scheduledWoRefresh, setScheduledWoRefresh] = useState(0)

  useEffect(() => {
    let active = true

    async function loadScheduledWorkOrders() {
      setScheduledWoLoading(true)
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setScheduledWoRows([])
          setScheduledWoLoading(false)
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.default_organization_id) {
        if (active) {
          setScheduledWoRows([])
          setScheduledWoLoading(false)
        }
        return
      }

      const orgId = profile.default_organization_id

      const schedWoSelWithNum =
        "id, work_order_number, customer_id, equipment_id, title, status, scheduled_on, scheduled_time, assigned_user_id"
      const schedWoSel = schedWoSelWithNum.replace("work_order_number, ", "")

      let woRes = await supabase
        .from("work_orders")
        .select(schedWoSelWithNum)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .not("scheduled_on", "is", null)
        .order("scheduled_on", { ascending: true })
        .order("scheduled_time", { ascending: true, nullsFirst: false })

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(schedWoSel)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .not("scheduled_on", "is", null)
          .order("scheduled_on", { ascending: true })
          .order("scheduled_time", { ascending: true, nullsFirst: false })
      }

      const { data: rows, error: woError } = woRes

      if (woError || !rows || !active) {
        if (active) {
          setScheduledWoRows([])
          setScheduledWoLoading(false)
        }
        return
      }

      const list = rows as DbScheduledWoRow[]
      const customerIds = [...new Set(list.map((r) => r.customer_id))]
      const equipmentIds = [...new Set(list.map((r) => r.equipment_id))]
      const assigneeIds = [
        ...new Set(list.map((r) => r.assigned_user_id).filter((id): id is string => Boolean(id))),
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

      const mapped: ScheduledWorkOrderDisplay[] = list.map((row) => {
        const eq = equipmentMap.get(row.equipment_id)
        const equipmentName = eq
          ? getEquipmentDisplayPrimary({
              id: row.equipment_id,
              name: eq.name,
              equipment_code: eq.equipment_code,
              serial_number: eq.serial_number,
              category: eq.category,
            })
          : "Equipment"
        return {
          id: row.id,
          workOrderNumber: row.work_order_number ?? undefined,
          title: row.title,
          status: row.status,
          scheduled_on: row.scheduled_on,
          scheduled_time: row.scheduled_time,
          customerName: customerMap.get(row.customer_id) ?? "Unknown customer",
          equipmentName,
          location: eq?.location ?? "",
          assigneeName: row.assigned_user_id ? profileMap.get(row.assigned_user_id) ?? null : null,
        }
      })

      setScheduledWoRows(mapped)
      setScheduledWoLoading(false)
    }

    loadScheduledWorkOrders()
    return () => {
      active = false
    }
  }, [scheduledWoRefresh])

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

  // Drawer / modal state
  const [createdIds, setCreatedIds]       = useState<Set<string>>(new Set())
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen]   = useState(false)
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
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Alert banners */}
      {overduePlans.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            {overduePlans.length} plan{overduePlans.length !== 1 ? "s are" : " is"} overdue: {overduePlans.map((p) => p.name).join(", ")}
          </p>
        </div>
      )}
      {criticalSoon.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
          <Clock className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            {criticalSoon.length} plan{criticalSoon.length !== 1 ? "s are" : " is"} due within 7 days: {criticalSoon.map((p) => p.name).join(", ")}
          </p>
        </div>
      )}

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
                "flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors",
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
                  "h-8 px-3 rounded-md text-sm font-medium transition-colors capitalize",
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
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          {([
            { id: "my",   label: "My Schedule",   Icon: User },
            { id: "team", label: "Team Schedule",  Icon: Users },
          ] as { id: TeamScope; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTeamScope(id)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors",
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

        {/* Schedule Service CTA */}
        <Button size="sm" className="gap-1.5 shrink-0 h-9" onClick={() => setScheduleOpen(true)}>
          <Plus className="w-4 h-4" />
          Schedule Service
        </Button>
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

        {teamScope === "team" && (
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="h-9 w-44 text-sm shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {technicians.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

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
          <ScheduledWorkOrdersSection rows={scheduledWoRows} loading={scheduledWoLoading} />

          {viewTab === "list" && (
            <>
              {monthKeys.map((key) => {
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
              {totalVisible === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No services scheduled in this window.</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting the date range or filters.</p>
                </div>
              )}
            </>
          )}

          {viewTab === "calendar" && (
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

          {viewTab === "map" && (
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
          {viewTab === "list" && (
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
          <SmartSchedulingPanel plans={filteredPlans} />

          {/* Notification timeline */}
          <NotificationTimeline plans={plans} />
        </div>
      </div>

      {/* Drawers + Modals */}
      <MaintenancePlanDrawer planId={selectedPlanId} onClose={() => setSelectedPlanId(null)} />
      <ScheduleServiceDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => setScheduledWoRefresh((n) => n + 1)}
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

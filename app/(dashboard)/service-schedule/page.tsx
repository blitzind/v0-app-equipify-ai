"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import { useWorkOrders } from "@/lib/work-order-store"
import { cn } from "@/lib/utils"
import type { MaintenancePlan, WorkOrderType, WorkOrderPriority } from "@/lib/mock-data"
import type { WorkOrder } from "@/lib/mock-data"
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
  Filter,
  ArrowRight,
  Plus,
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
import { MaintenancePlanDrawer } from "@/components/drawers/maintenance-plan-drawer"
import { AppointmentActions } from "@/components/appointments/appointment-actions"
import { ScheduleServiceDrawer } from "@/components/schedule-service-drawer"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const INTERVAL_COLORS: Record<string, string> = {
  "Annual":      "ds-badge-accent border",
  "Semi-Annual": "ds-badge-info border",
  "Quarterly":   "ds-badge-info border",
  "Monthly":     "ds-badge-success border",
  "Custom":      "ds-badge-warning border",
}

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

// ─── Month Timeline ───────────────────────────────────────────────────────────

function MonthSection({
  monthKey,
  plans,
  onCreateWo,
  createdIds,
  onOpenPlan,
  today,
}: {
  monthKey: string
  plans: MaintenancePlan[]
  onCreateWo: (plan: MaintenancePlan) => void
  createdIds: Set<string>
  onOpenPlan: (id: string) => void
  today: Date
}) {
  const [year, month] = monthKey.split("-").map(Number)
  const label = `${MONTHS[month]} ${year}`
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const isPast = new Date(year, month + 1, 0) < today && !isCurrentMonth

  return (
    <div>
      {/* Month header */}
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

      {/* Service rows */}
      <div className="flex flex-col gap-2 mb-8">
        {plans
          .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
          .map((plan) => {
            const days = daysUntil(plan.nextDueDate)
            const alreadyCreated = createdIds.has(plan.id)
            const activeRules = plan.notificationRules.filter((r) => r.enabled)
            const nextEmail  = activeRules.find((r) => r.channel === "Email")
            const nextSms    = activeRules.find((r) => r.channel === "SMS")
            const nextInternal = activeRules.find((r) => r.channel === "Internal Alert")

            return (
              <div
                key={plan.id}
                className={cn(
                  "flex items-stretch gap-0 bg-card rounded-lg border border-border overflow-hidden hover:shadow-sm transition-shadow cursor-pointer",
                  urgencyBg(days)
                )}
                onClick={() => onOpenPlan(plan.id)}
              >
                {/* Date block */}
                <div className="flex flex-col items-center justify-center px-4 py-3 border-r border-border bg-muted/30 min-w-[72px]">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide leading-none">
                    {new Date(plan.nextDueDate).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-2xl font-bold text-foreground leading-tight">
                    {new Date(plan.nextDueDate).getDate()}
                  </span>
                  <span className={cn("text-xs mt-0.5", urgencyText(days))}>
                    {formatDaysLabel(days)}
                  </span>
                </div>

                {/* Main content */}
                <div className="flex flex-1 items-center gap-4 px-4 py-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full border font-medium", INTERVAL_COLORS[plan.interval] ?? INTERVAL_COLORS.Custom)}>
                        {plan.interval === "Custom" ? `${plan.customIntervalDays}d` : plan.interval}
                      </span>
                      {plan.status === "Paused" && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Paused</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{plan.customerName} — {plan.equipmentName} — {plan.location}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Technician: <span className="text-foreground font-medium">{plan.technicianName}</span></span>

                      {plan.services.length > 0 && (
                        <span className="text-xs text-muted-foreground">{plan.services.length} service{plan.services.length !== 1 ? "s" : ""}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Est. ${plan.services.reduce((a, s) => a + s.estimatedCost, 0).toLocaleString()}
                      </span>
                    </div>
                    {plan.location && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
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
                      </div>
                    )}
                  </div>

                  {/* Notification chips */}
                  <div className="hidden md:flex items-center gap-1.5 shrink-0">
                    {nextEmail    && <span className="text-xs px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200">Email</span>}
                    {nextSms      && <span className="text-xs px-2 py-0.5 rounded border bg-green-50 text-green-600 border-green-200">SMS</span>}
                    {nextInternal && <span className="text-xs px-2 py-0.5 rounded border bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30">Alert</span>}
                  </div>

                  {/* WO creation */}
                  {plan.autoCreateWorkOrder && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCreateWo(plan) }}
                      disabled={alreadyCreated || plan.status === "Paused"}
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors",
                        alreadyCreated
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                          : plan.status === "Paused"
                          ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      )}
                    >
                      {alreadyCreated ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> WO Created</>
                      ) : (
                        <><Zap className="w-3.5 h-3.5" /> Create WO</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

// ─── Notification Timeline ────────────────────────────────────────────────────

function NotificationTimeline({ plans }: { plans: MaintenancePlan[] }) {
  const upcoming = useMemo(() => {
    const events: Array<{
      planId: string
      planName: string
      equipmentName: string
      customerName: string
      channel: string
      triggerDays: number
      fireDate: string
      recipient: string
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
              planId: plan.id,
              planName: plan.name,
              equipmentName: plan.equipmentName,
              customerName: plan.customerName,
              channel: rule.channel,
              triggerDays: rule.triggerDays,
              fireDate: fireDate.toISOString().split("T")[0],
              recipient: rec,
            })
          })
        }
      })
    })

    return events
      .sort((a, b) => new Date(a.fireDate).getTime() - new Date(b.fireDate).getTime())
      .slice(0, 18)
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

// ─── View Mode Config ─────────────────────────────────────────────────────────

type ViewMode = "1" | "3" | "4" | "6" | "12" | "year"

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

/** Returns the date-range label for the current offset + mode */
function dateRangeLabel(mode: ViewMode, offset: number, today: Date): string {
  if (mode === "year") {
    const year = today.getFullYear() + offset
    return String(year)
  }

  const start = new Date(today.getFullYear(), today.getMonth() + offset * viewModeMonths(mode), 1)
  const count = viewModeMonths(mode)

  if (count === 1) {
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const end = new Date(start.getFullYear(), start.getMonth() + count - 1, 1)
  const startStr = start.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  const endStr   = end.toLocaleDateString("en-US",   { month: "short", year: "numeric" })
  return `${startStr} – ${endStr}`
}

/** Build ordered month keys for the current window */
function buildMonthKeys(mode: ViewMode, offset: number, today: Date): string[] {
  const count = viewModeMonths(mode)

  if (mode === "year") {
    const year = today.getFullYear() + offset
    return Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i).padStart(2, "0")}`
    )
  }

  const base = new Date(today.getFullYear(), today.getMonth() + offset * count, 1)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`
  })
}

/** Summary card title reflecting mode */
function summaryTitle(mode: ViewMode): string {
  return VIEW_MODE_LABELS[mode].replace(" View", "") + " Summary"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServiceSchedulePage() {
  const { plans } = useMaintenancePlans()
  const { createWorkOrder, workOrders } = useWorkOrders()

  const [viewMode, setViewMode]         = useState<ViewMode>("4")
  const [offset, setOffset]             = useState(0)
  const [customerFilter, setCustomerFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [createdIds, setCreatedIds]     = useState<Set<string>>(new Set())
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) {
      setSelectedPlanId(openId)
      router.replace("/service-schedule", { scroll: false })
    }
  }, [searchParams, router])

  // today is captured once on the client to avoid SSR/client date mismatch.
  // During SSR we use a fixed epoch so monthKeys are stable; on mount we update
  // to the real date which triggers a single reconcile with correct data.
  const [today, setToday] = useState<Date>(() => new Date(0))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    setToday(now)
    setMounted(true)
  }, [])

  // Reset offset when mode changes so we don't land on an unexpected window
  function handleModeChange(m: ViewMode) {
    setViewMode(m)
    setOffset(0)
  }

  const monthKeys = useMemo(() => buildMonthKeys(viewMode, offset, today), [viewMode, offset, today])

  const customers = useMemo(() => {
    return ["All", ...Array.from(new Set(plans.map((p) => p.customerName))).sort()]
  }, [plans])

  const grouped = useMemo(() => {
    return monthKeys.reduce<Record<string, MaintenancePlan[]>>((acc, key) => {
      acc[key] = plans.filter((p) => {
        if (getMonthKey(p.nextDueDate) !== key) return false
        if (customerFilter !== "All" && p.customerName !== customerFilter) return false
        if (statusFilter === "Active" && p.status !== "Active") return false
        if (statusFilter === "Paused" && p.status !== "Paused") return false
        return true
      })
      return acc
    }, {})
  }, [plans, monthKeys, customerFilter, statusFilter])

  const totalVisible = Object.values(grouped).flat().length

  const overduePlans = useMemo(() =>
    plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) < 0),
    [plans]
  )

  const criticalSoon = useMemo(() =>
    plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) >= 0 && daysUntil(p.nextDueDate) <= 7),
    [plans]
  )

  function handleCreateWo(plan: MaintenancePlan) {
    const existingIds = workOrders.map((w) => parseInt(w.id.replace("WO-", ""))).filter(n => !isNaN(n))
    const maxId = Math.max(...existingIds, 2041)
    const wo: WorkOrder = {
      id: `WO-${maxId + 1}`,
      customerId: plan.customerId,
      customerName: plan.customerName,
      equipmentId: plan.equipmentId,
      equipmentName: plan.equipmentName,
      location: plan.location,
      type: plan.workOrderType,
      status: "Open",
      priority: plan.workOrderPriority,
      technicianId: plan.technicianId,
      technicianName: plan.technicianName,
      scheduledDate: plan.nextDueDate,
      scheduledTime: "08:00",
      completedDate: "",
      createdAt: new Date().toISOString(),
      createdBy: "Service Schedule",
      description: `Auto-created from plan "${plan.name}". Services: ${plan.services.map((s) => s.name).join(", ") || "See plan details"}.`,
      repairLog: {
        problemReported: `Scheduled ${plan.interval} service per maintenance plan ${plan.id}.`,
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
    createWorkOrder(wo)
    setCreatedIds((prev) => new Set([...prev, plan.id]))
  }

  return (
    <div className="flex flex-col gap-6">

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

      {/* ── Unified toolbar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="Active">Active Only</SelectItem>
            <SelectItem value="Paused">Paused Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Customer filter */}
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="h-9 w-52 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* View mode selector */}
        <Select value={viewMode} onValueChange={(v) => handleModeChange(v as ViewMode)}>
          <SelectTrigger className="h-9 w-40 text-sm shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((m) => (
              <SelectItem key={m} value={m}>{VIEW_MODE_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spacer */}
        <span className="flex-1 hidden sm:block" />

        {/* Schedule Service CTA */}
        <Button
          size="sm"
          className="gap-1.5 shrink-0 h-9"
          onClick={() => setScheduleOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Schedule Service
        </Button>

        {/* Services-in-view count */}
        <span className="text-xs text-muted-foreground shrink-0 sm:hidden">
          {totalVisible} service{totalVisible !== 1 ? "s" : ""} in view
        </span>

        {/* Date navigation group */}
        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setOffset((n) => n - 1)}
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Date range pill — suppressHydrationWarning because the label depends on
              new Date() which differs between SSR (server time) and client (browser time) */}
          <div
            className="inline-flex items-center h-9 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground min-w-[144px] justify-center select-none"
            suppressHydrationWarning
          >
            {mounted ? dateRangeLabel(viewMode, offset, today) : ""}
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setOffset((n) => n + 1)}
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {offset !== 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-9 px-2.5" onClick={() => setOffset(0)}>
              Today
            </Button>
          )}
        </div>

        {/* Services count — desktop only */}
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
          {totalVisible} service{totalVisible !== 1 ? "s" : ""} in view
        </span>
      </div>

      {/* ── Two-column layout: timeline + sidebar ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Timeline */}
        <div className="flex-1 min-w-0 w-full">
          {monthKeys.map((key) => {
            const monthPlans = grouped[key]
            if (!monthPlans) return null
            return (
              <MonthSection
                key={key}
                monthKey={key}
                plans={monthPlans}
                onCreateWo={handleCreateWo}
                createdIds={createdIds}
                onOpenPlan={setSelectedPlanId}
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
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:sticky lg:top-0">

          {/* Summary card — title reflects current view mode */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                {summaryTitle(viewMode)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-3">
              {monthKeys.map((key) => {
                const count = grouped[key]?.length ?? 0
                const estCost = (grouped[key] ?? []).reduce(
                  (a, p) => a + p.services.reduce((b, s) => b + s.estimatedCost, 0), 0
                )
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

          {/* Notification timeline */}
          <NotificationTimeline plans={plans} />
        </div>
      </div>

      <MaintenancePlanDrawer
        planId={selectedPlanId}
        onClose={() => setSelectedPlanId(null)}
      />

      <ScheduleServiceDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
    </div>
  )
}

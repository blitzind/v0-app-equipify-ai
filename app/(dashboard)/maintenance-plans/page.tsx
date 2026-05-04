"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { createWorkOrderFromMaintenancePlan } from "@/lib/maintenance-plans/create-work-order-from-plan"
import { computeNextDueDate } from "@/lib/maintenance-plans/db-map"
import { DrawerViewport } from "@/components/detail-drawer"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type {
  MaintenancePlan,
  PlanInterval,
  PlanStatus,
  NotificationChannel,
  NotificationTriggerDays,
  WorkOrderType,
  WorkOrderPriority,
  NotificationRule,
} from "@/lib/mock-data"
import {
  Search,
  Plus,
  ChevronRight,
  X,
  Bell,
  BellOff,
  Zap,
  Wrench,
  Calendar,
  Settings2,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Mail,
  MessageSquare,
  MonitorCheck,
  Clock,
  Edit3,
  Save,
  BadgeCheck,
  Loader2,
  Pencil,
  Play,
  Pause,
  MoreHorizontal,
  Archive,
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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ViewToggle } from "@/components/ui/view-toggle"
import { EditMaintenancePlanDialog } from "@/components/maintenance-plans/edit-maintenance-plan-dialog"
import { CreateMaintenancePlanDialog } from "@/components/maintenance-plans/create-maintenance-plan-dialog"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/hooks/use-toast"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PlanStatus, { label: string; className: string; Icon: React.ElementType }> = {
  Active:  { label: "Active",  className: "ds-badge-success",  Icon: CheckCircle2 },
  Paused:  { label: "Paused",  className: "ds-badge-warning",  Icon: PauseCircle },
  Expired: { label: "Expired", className: "ds-badge-danger",   Icon: AlertTriangle },
}

const INTERVAL_LABELS: Record<PlanInterval, string> = {
  Annual:       "Annual",
  "Semi-Annual": "Semi-Annual",
  Quarterly:    "Quarterly",
  Monthly:      "Monthly",
  Custom:       "Custom",
}

const CHANNEL_CONFIG: Record<NotificationChannel, { Icon: React.ElementType; color: string }> = {
  "Email":          { Icon: Mail,          color: "ds-icon-info" },
  "SMS":            { Icon: MessageSquare, color: "ds-icon-success" },
  "Internal Alert": { Icon: MonitorCheck,  color: "ds-icon-accent" },
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyClass(days: number): string {
  if (days < 0)   return "ds-text-danger font-semibold"
  if (days <= 7)  return "ds-text-danger font-medium"
  if (days <= 14) return "ds-text-warning font-medium"
  if (days <= 30) return "ds-text-warning"
  return "text-muted-foreground"
}

/** Visual accent for plan list/card when next due is in the past or today. */
function planDueAccent(days: number): "overdue" | "dueToday" | null {
  if (Number.isNaN(days)) return null
  if (days < 0) return "overdue"
  if (days === 0) return "dueToday"
  return null
}

const WO_FROM_PLAN_STATUS_CLASS: Record<string, string> = {
  open: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  scheduled: "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  in_progress: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  completed: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  invoiced: "bg-muted text-muted-foreground border-border",
}

function workOrderDbStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return status
  }
}

function formatShortDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDays(days: number): string {
  if (days < 0)  return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `Due in ${days}d`
}

// ─── Plan Detail Sheet ────────────────────────────────────────────────────────────────────

function PlanDetailSheet({ plan, onClose }: { plan: MaintenancePlan; onClose: () => void }) {
  const planHasEquipment = Boolean(plan.equipmentId?.trim())
  const {
    updatePlan,
    setStatus,
    updateRules,
    fireNotifications,
    notificationLog,
    organizationId,
    archivePlan,
    deletePlan,
    refreshPlans,
  } = useMaintenancePlans()
  const [editNotes, setEditNotes] = useState(plan.notes)
  const [saving, setSaving] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [woError, setWoError] = useState<string | null>(null)
  const [fired, setFired] = useState(false)
  const [woCreated, setWoCreated] = useState(false)
  const [detailSheetTab, setDetailSheetTab] = useState("services")
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [headerWoBusy, setHeaderWoBusy] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [planWorkOrders, setPlanWorkOrders] = useState<
    Array<{
      id: string
      work_order_number?: number | null
      title: string
      status: string
      scheduled_on: string | null
      created_at: string
    }>
  >([])
  const [planWoHistoryLoading, setPlanWoHistoryLoading] = useState(false)
  const [planWoHistoryError, setPlanWoHistoryError] = useState<string | null>(null)
  const [planWoHistoryToken, setPlanWoHistoryToken] = useState(0)

  useEffect(() => {
    console.info("[Equipify] PlanDetailSheet (maintenance-plans/page.tsx)", { planId: plan.id })
  }, [plan.id])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    setPlanWoHistoryLoading(true)
    setPlanWoHistoryError(null)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const planHistSelWithNum = "id, work_order_number, title, status, scheduled_on, created_at"
      const planHistSel = planHistSelWithNum.replace("work_order_number, ", "")

      let woRes = await supabase
        .from("work_orders")
        .select(planHistSelWithNum)
        .eq("organization_id", organizationId)
        .eq("maintenance_plan_id", plan.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(planHistSel)
          .eq("organization_id", organizationId)
          .eq("maintenance_plan_id", plan.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
      }

      const { data, error } = woRes
      if (cancelled) return
      if (error) {
        setPlanWoHistoryError(error.message)
        setPlanWorkOrders([])
      } else {
        setPlanWorkOrders(
          (data ?? []) as Array<{
            id: string
            work_order_number?: number | null
            title: string
            status: string
            scheduled_on: string | null
            created_at: string
          }>
        )
      }
      setPlanWoHistoryLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [plan.id, organizationId, planWoHistoryToken])

  const planWoStats = useMemo(() => {
    const completed = planWorkOrders.filter((w) => w.status === "completed" || w.status === "invoiced").length
    const lastGenerated =
      planWorkOrders.length === 0
        ? null
        : planWorkOrders.reduce<string | null>((acc, w) => {
            if (!acc) return w.created_at
            return new Date(w.created_at) > new Date(acc) ? w.created_at : acc
          }, null)
    return { completed, lastGenerated }
  }, [planWorkOrders])

  useEffect(() => {
    setEditNotes(plan.notes)
    setDetailError(null)
    setWoError(null)
    setDetailSheetTab("services")
  }, [plan.id, plan.notes])

  const planLogs = useMemo(
    () => notificationLog.filter((l) => l.planId === plan.id).slice(0, 20),
    [notificationLog, plan.id]
  )

  const days = daysUntil(plan.nextDueDate)

  async function handleSaveNotes() {
    setSaving(true)
    setDetailError(null)
    const res = await updatePlan(plan.id, { notes: editNotes })
    setSaving(false)
    if (res.error) setDetailError(res.error)
  }

  async function handleToggleRule(ruleId: string) {
    setDetailError(null)
    const updated = plan.notificationRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    )
    const res = await updateRules(plan.id, updated)
    if (res.error) setDetailError(res.error)
  }

  function handleFireAll() {
    fireNotifications(plan.id)
    setFired(true)
    setTimeout(() => setFired(false), 2000)
  }

  async function handleAutoCreateWo() {
    setWoError(null)
    if (!organizationId) {
      setWoError("No default organization.")
      return
    }
    if (!planHasEquipment) {
      setWoError("Attach equipment to this plan before creating a work order.")
      return
    }
    const { error } = await createWorkOrderFromMaintenancePlan({
      organizationId,
      plan,
    })
    if (error) {
      setWoError(error)
      return
    }
    toast({
      title: "Work order created",
      description: `Linked to ${plan.customerName} — ${plan.equipmentName}.`,
    })
    void refreshPlans({ silent: true })
    setPlanWoHistoryToken((n) => n + 1)
    setWoCreated(true)
    setTimeout(() => setWoCreated(false), 2500)
  }

  async function handleHeaderCreateWo() {
    console.info("[Equipify] PlanDetailSheet click → Create WO", { planId: plan.id })
    setWoError(null)
    if (!organizationId) {
      setWoError("No default organization.")
      return
    }
    if (!planHasEquipment) {
      setWoError("Attach equipment to this plan before creating a work order.")
      return
    }
    setHeaderWoBusy(true)
    const { error } = await createWorkOrderFromMaintenancePlan({ organizationId, plan })
    setHeaderWoBusy(false)
    if (error) {
      setWoError(error)
      return
    }
    toast({
      title: "Work order created",
      description: `Linked to ${plan.customerName} — ${plan.equipmentName}.`,
    })
    void refreshPlans({ silent: true })
    setPlanWoHistoryToken((n) => n + 1)
    setWoCreated(true)
    setTimeout(() => setWoCreated(false), 2500)
  }

  async function handlePauseResumeSheet() {
    console.info("[Equipify] PlanDetailSheet click → Pause/Resume", {
      planId: plan.id,
      currentStatus: plan.status,
    })
    setDetailError(null)
    const next: PlanStatus = plan.status === "Active" ? "Paused" : "Active"
    const res = await setStatus(plan.id, next)
    if (res.error) {
      setDetailError(res.error)
      return
    }
    toast({
      title: next === "Paused" ? "Plan paused" : "Plan resumed",
      description: plan.name,
    })
  }

  async function handleConfirmArchive() {
    console.info("[Equipify] PlanDetailSheet confirm → Archive", { planId: plan.id })
    setActionBusy(true)
    const res = await archivePlan(plan.id)
    setActionBusy(false)
    setArchiveOpen(false)
    if (res.error) {
      setDetailError(res.error)
      return
    }
    toast({ title: "Plan archived", description: plan.name })
    onClose()
  }

  async function handleConfirmDelete() {
    console.info("[Equipify] PlanDetailSheet confirm → Delete", { planId: plan.id })
    setActionBusy(true)
    const res = await deletePlan(plan.id)
    setActionBusy(false)
    setDeleteOpen(false)
    if (res.error) {
      setDetailError(res.error)
      return
    }
    toast({ title: "Plan removed", description: `${plan.name} was archived and expired.` })
    onClose()
  }

  const groupedRules = useMemo(() => {
    const map: Record<NotificationTriggerDays, NotificationRule[]> = { 30: [], 14: [], 7: [], 1: [] }
    plan.notificationRules.forEach((r) => {
      map[r.triggerDays] = [...(map[r.triggerDays] || []), r]
    })
    return map
  }, [plan.notificationRules])

  return (
    <>
    <DrawerViewport
      open
      onClose={onClose}
      width="xl"
      ariaLabel={plan.name}
      panelClassName="border-l border-border bg-background shadow-2xl"
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-border shrink-0 relative isolate">
          <div className="flex flex-col gap-1 min-w-0 pr-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{plan.id}</span>
              <StatusBadge status={plan.status} />
              {plan.autoCreateWorkOrder && (
                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                  <Zap className="w-3 h-3" /> Auto-WO
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground leading-tight">{plan.name}</h2>
            <p className="text-sm text-muted-foreground">
              {plan.customerName}
              {planHasEquipment ? ` — ${plan.equipmentName}` : " — No equipment attached yet"}
            </p>
          </div>
          <div
            role="toolbar"
            aria-label="Plan actions"
            className="relative z-10 flex flex-wrap items-center justify-end gap-1.5 shrink-0 pointer-events-auto"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs cursor-pointer"
              onClick={() => setEditDialogOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-8 text-xs cursor-pointer" onClick={() => void handlePauseResumeSheet()}>
              {plan.status === "Active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {plan.status === "Active" ? "Pause" : "Resume"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs cursor-pointer"
              disabled={headerWoBusy || !organizationId || !planHasEquipment}
              onClick={() => void handleHeaderCreateWo()}
            >
              {headerWoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Create WO
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 cursor-pointer"
                  aria-label="More actions"
                  onPointerDown={() =>
                    console.info("[Equipify] PlanDetailSheet pointer → More menu trigger", { planId: plan.id })
                  }
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer"
                  onSelect={() => {
                    console.info("[Equipify] PlanDetailSheet select → Archive plan", { planId: plan.id })
                    setArchiveOpen(true)
                  }}
                >
                  <Archive className="w-4 h-4" /> Archive plan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onSelect={() => {
                    console.info("[Equipify] PlanDetailSheet select → Delete plan", { planId: plan.id })
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="w-4 h-4" /> Delete plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border shrink-0">
          {[
            { label: "Interval",    value: plan.interval === "Custom" ? `Every ${plan.customIntervalDays}d` : plan.interval },
            { label: "Technician",  value: plan.technicianName },
            { label: "Last Service", value: plan.lastServiceDate },
            { label: "Next Due",    value: <span className={urgencyClass(days)}>{plan.nextDueDate} <span className="text-xs">({formatDays(days)})</span></span> },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
              <span className="text-sm font-medium text-foreground leading-snug">{value}</span>
            </div>
          ))}
        </div>

        {(detailError || woError) && (
          <div className="px-6 py-3 border-b border-border shrink-0 space-y-2 bg-muted/20">
            {detailError && (
              <Alert variant="destructive">
                <AlertTitle>Could not save</AlertTitle>
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            )}
            {woError && (
              <Alert variant="destructive">
                <AlertTitle>Work order</AlertTitle>
                <AlertDescription>{woError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Tabs — match Work Order drawer: bottom-border active indicator, no pill/outline */}
        <Tabs
          value={detailSheetTab}
          onValueChange={setDetailSheetTab}
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <TabsList className="h-auto min-h-0 w-full flex flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain justify-start gap-0 rounded-none border-0 border-b border-border bg-background p-0 shrink-0 z-[11] px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { value: "services",      label: "Services" },
              { value: "work_orders",   label: "Work Orders" },
              { value: "notifications", label: "Notifications" },
              { value: "log",           label: "Notification Log" },
              { value: "settings",      label: "Settings" },
            ].map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "grow-0 basis-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 shadow-none outline-none",
                  "text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
                  "text-muted-foreground hover:text-foreground hover:border-border",
                  "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                )}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5">
            {/* Services */}
            <TabsContent value="services" className="mt-0 flex flex-col gap-4">
              {plan.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services defined for this plan.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {plan.services.map((svc, i) => (
                    <div
                      key={`${svc.id ?? "service"}-${i}`}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{svc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-xs text-muted-foreground">{svc.estimatedHours}h est.</span>
                        <span className="text-xs font-medium text-foreground">${svc.estimatedCost}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-4 pt-1 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Total est. hours: <span className="font-medium text-foreground">{plan.services.reduce((a, s) => a + s.estimatedHours, 0).toFixed(1)}h</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Total est. cost: <span className="font-medium text-foreground">${plan.services.reduce((a, s) => a + s.estimatedCost, 0).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Notes</label>
                  <Button variant="ghost" size="sm" onClick={() => void handleSaveNotes()} className="text-xs h-7 gap-1 text-primary hover:text-primary">
                    <Save className="w-3 h-3" /> {saving ? "Saved" : "Save"}
                  </Button>
                </div>
                <textarea rows={3} className="input-base resize-none text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </TabsContent>

            {/* Work orders generated from this plan */}
            <TabsContent value="work_orders" className="mt-0 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Generated work orders</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">{planWoStats.completed}</span> completed
                    {planWoStats.lastGenerated ? (
                      <>
                        <span className="mx-1.5">·</span>
                        Last generated {formatShortDate(planWoStats.lastGenerated)}
                      </>
                    ) : (
                      <>
                        <span className="mx-1.5">·</span>
                        No work orders yet
                      </>
                    )}
                  </p>
                </div>
              </div>
              {planWoHistoryError && (
                <Alert variant="destructive">
                  <AlertTitle>Could not load work orders</AlertTitle>
                  <AlertDescription>{planWoHistoryError}</AlertDescription>
                </Alert>
              )}
              {planWoHistoryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading history…
                </div>
              ) : planWorkOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No work orders have been created from this plan yet. Use <strong>Create WO</strong> or enable auto-create to generate one.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Scheduled</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs w-[140px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planWorkOrders.map((row, i) => (
                        <TableRow key={`${row.id ?? "wo"}-${i}`}>
                          <TableCell className="text-sm font-medium max-w-[220px]">
                            <span className="block truncate" title={row.title}>
                              {row.title}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">{formatWorkOrderDisplay(row.work_order_number, row.id)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] border",
                                WO_FROM_PLAN_STATUS_CLASS[row.status] ?? "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {workOrderDbStatusLabel(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {row.scheduled_on ? formatShortDate(row.scheduled_on) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatShortDate(row.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs cursor-pointer" asChild>
                              <Link href={`/work-orders?open=${row.id}`}>
                                <ClipboardList className="w-3.5 h-3.5" />
                                Open Work Order
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Notification Rules */}
            <TabsContent value="notifications" className="mt-0 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Notification Rules</p>
                  <p className="text-xs text-muted-foreground">Rules fire at 30, 14, 7, and 1 day before the due date.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleFireAll} className="h-8 gap-1.5 text-xs cursor-pointer">
                  <Bell className="w-3.5 h-3.5" />
                  {fired ? "Fired!" : "Simulate All"}
                </Button>
              </div>
              {([30, 14, 7, 1] as NotificationTriggerDays[]).map((trigDays) => {
                const rules = groupedRules[trigDays]
                if (!rules.length) return null
                return (
                  <div key={trigDays}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{trigDays} Day{trigDays !== 1 ? "s" : ""} Before Due</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {rules.map((rule, ruleIdx) => {
                        const cfg = CHANNEL_CONFIG[rule.channel]
                        return (
                          <div
                            key={`${rule.id ?? "rule"}-${ruleIdx}`}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                              rule.enabled
                                ? "border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                                : "border-dashed border-border/60 bg-muted/25 opacity-60",
                            )}
                          >
                            <cfg.Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{rule.channel}</p>
                              <p className="text-xs text-muted-foreground truncate">{rule.recipients.join(", ")}</p>
                            </div>
                            <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule.id)} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </TabsContent>

            {/* Notification Log */}
            <TabsContent value="log" className="mt-0 flex flex-col gap-3">
              {planLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications sent yet for this plan.</p>
              ) : (
                planLogs.map((log, i) => {
                  const cfg = CHANNEL_CONFIG[log.channel]
                  return (
                    <div
                      key={`${log.id ?? "log"}-${i}`}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    >
                      <cfg.Icon className={cn("w-4 h-4 shrink-0 mt-0.5", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{log.channel}</span>
                          <span className="text-xs text-muted-foreground">→ {log.triggerDays}d warning</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full", log.status === "Sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{log.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{log.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{log.recipient}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{new Date(log.sentAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings" className="mt-0 flex flex-col gap-6">
              <div>
                <p className="text-sm font-semibold mb-3">Plan Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(["Active", "Paused", "Expired"] as PlanStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        void setStatus(plan.id, s).then((r) => {
                          if (r.error) setDetailError(r.error)
                        })
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                        plan.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-Create Work Orders</p>
                  <p className="text-xs text-muted-foreground">Automatically open a WO when this plan comes due</p>
                </div>
                <Switch
                  checked={plan.autoCreateWorkOrder}
                  disabled={!planHasEquipment}
                  onCheckedChange={(v) => {
                    void updatePlan(plan.id, { autoCreateWorkOrder: v }).then((r) => {
                      if (r.error) setDetailError(r.error)
                    })
                  }}
                />
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2">Manual Work Order Creation</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Creates a work order right now using this plan&apos;s template — type <strong>{plan.workOrderType}</strong>, priority <strong>{plan.workOrderPriority}</strong>.
                  {!planHasEquipment && (
                    <span className="block mt-2 text-[color:var(--status-warning)]">
                      Attach equipment to this plan before creating a work order.
                    </span>
                  )}
                </p>
                <Button
                  onClick={() => void handleAutoCreateWo()}
                  variant="outline"
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                  disabled={!planHasEquipment}
                >
                  <Wrench className="w-4 h-4" />
                  {woCreated ? "Work Order Created!" : "Create Work Order Now"}
                </Button>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-1">Plan Info</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Plan ID</span>          <span className="font-mono text-foreground">{plan.id}</span>
                  <span className="text-muted-foreground">Created</span>          <span className="text-foreground">{new Date(plan.createdAt).toLocaleDateString()}</span>
                  <span className="text-muted-foreground">Services Completed</span> <span className="text-foreground">{plan.totalServicesCompleted}</span>
                  <span className="text-muted-foreground">Location</span>         <span className="text-foreground">{plan.location}</span>
                  <span className="text-muted-foreground">WO Type</span>          <span className="text-foreground">{plan.workOrderType}</span>
                  <span className="text-muted-foreground">WO Priority</span>      <span className="text-foreground">{plan.workOrderPriority}</span>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DrawerViewport>

    <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this plan?</AlertDialogTitle>
          <AlertDialogDescription>
            It will disappear from maintenance schedules and plan lists. Historical records may remain in your database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={actionBusy} onClick={() => void handleConfirmArchive()} className="gap-2">
            {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Archive
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this maintenance plan?</AlertDialogTitle>
          <AlertDialogDescription>
            This archives the plan, marks it expired, and turns off automatic work order creation. It will no longer
            appear in active maintenance views.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={actionBusy} onClick={() => void handleConfirmDelete()} className="gap-2">
            {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete plan
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <EditMaintenancePlanDialog
      open={editDialogOpen}
      onClose={() => setEditDialogOpen(false)}
      plan={plan}
    />
    </>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PlanStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", cfg.className)}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onClick }: { plan: MaintenancePlan; onClick: () => void }) {
  const days = daysUntil(plan.nextDueDate)
  const accent = planDueAccent(days)
  const activeRules = plan.notificationRules.filter((r) => r.enabled).length

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all",
        accent === "overdue" && "border-destructive/45 ring-1 ring-destructive/25",
        accent === "dueToday" && "border-amber-500/45 ring-1 ring-amber-500/25",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{plan.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{plan.customerName} — {plan.equipmentName}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {accent === "overdue" && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-semibold">
              Overdue
            </Badge>
          )}
          {accent === "dueToday" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 font-semibold border-amber-500/60 text-amber-800 dark:text-amber-300 bg-amber-500/10"
            >
              Due today
            </Badge>
          )}
          <StatusBadge status={plan.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Interval</span>
          <span className="text-xs font-medium text-foreground">{plan.interval === "Custom" ? `${plan.customIntervalDays}d` : plan.interval}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Technician</span>
          <span className="text-xs font-medium text-foreground truncate">{plan.technicianName}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Services</span>
          <span className="text-xs font-medium text-foreground">{plan.services.length} items</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={cn("text-xs", urgencyClass(days))}>{formatDays(days)}</span>
        </div>
        <div className="flex items-center gap-2">
          {plan.autoCreateWorkOrder && <Zap className="w-3.5 h-3.5 text-blue-500" aria-label="Auto work order" />}
          <div className="flex items-center gap-1">
            <Bell className={cn("w-3.5 h-3.5", activeRules > 0 ? "text-amber-500" : "text-muted-foreground/40")} />
            <span className="text-xs text-muted-foreground">{activeRules}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function MaintenancePlansPageInner() {
  const { plans, loading, error } = useMaintenancePlans()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "All">("All")
  const [intervalFilter, setIntervalFilter] = useState<PlanInterval | "All">("All")
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [view, setView] = useState<"cards" | "table">("table")

  const prefillCustomerId = searchParams.get("customerId")
  const prefillEquipmentId = searchParams.get("equipmentId")

  function handleCloseCreateModal() {
    setCreateOpen(false)
    const sp = new URLSearchParams(searchParams.toString())
    if (sp.has("new")) {
      sp.delete("new")
      sp.delete("customerId")
      sp.delete("equipmentId")
      const q = sp.toString()
      router.replace(q ? `/maintenance-plans?${q}` : "/maintenance-plans", { scroll: false })
    }
  }

  // Open create modal from Customer / Equipment quick actions (?new=1&customerId=&equipmentId=)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true)
    }
  }, [searchParams])

  // Auto-open drawer from ?open= query param
  useEffect(() => {
    const openId = searchParams.get("open")
    if (!openId || loading) return
    const match = plans.find((p) => p.id === openId)
    if (match) {
      setSelectedPlan(match)
      router.replace("/maintenance-plans", { scroll: false })
    }
  }, [searchParams, plans, router, loading])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return plans.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false
      if (intervalFilter !== "All" && p.interval !== intervalFilter) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.customerName.toLowerCase().includes(q) && !p.equipmentName.toLowerCase().includes(q)) return false
      return true
    })
  }, [plans, search, statusFilter, intervalFilter])

  const stats = useMemo(() => {
    const active   = plans.filter((p) => p.status === "Active").length
    const due7     = plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) <= 7).length
    const due30    = plans.filter((p) => p.status === "Active" && daysUntil(p.nextDueDate) <= 30).length
    const autoWo   = plans.filter((p) => p.autoCreateWorkOrder).length
    return { active, due7, due30, autoWo }
  }, [plans])

  const initialLoading = loading && plans.length === 0
  const listEmpty = !loading && plans.length === 0
  const filteredEmpty = filtered.length === 0 && plans.length > 0

  if (initialLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border border-border">
              <CardContent className="pt-5 pb-4">
                <div className="h-3 w-24 bg-muted animate-pulse rounded mb-2" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading maintenance plans…
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load plans</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Active Plans",       value: stats.active,  sub: "currently running",          color: "text-emerald-600" },
          { label: "Due This Week",      value: stats.due7,    sub: "within 7 days",               color: "text-red-500" },
          { label: "Due This Month",     value: stats.due30,   sub: "within 30 days",              color: "text-amber-600" },
          { label: "Auto Work Orders",   value: stats.autoWo,  sub: "plans with auto-create on",  color: "text-blue-500" },
        ].map(({ label, value, sub, color }) => (
          <Card key={label} className="border border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 h-9 text-sm border border-border rounded-md bg-background outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
            placeholder="Search plans, customers, equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PlanStatus | "All")}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            {(["Active", "Paused", "Expired"] as PlanStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={intervalFilter} onValueChange={(v) => setIntervalFilter(v as PlanInterval | "All")}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Intervals</SelectItem>
            {(["Annual", "Semi-Annual", "Quarterly", "Monthly", "Custom"] as PlanInterval[]).map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ViewToggle
            view={view === "cards" ? "card" : "table"}
            onViewChange={(v) => setView(v === "card" ? "cards" : "table")}
          />
          <Button onClick={() => setCreateOpen(true)} className="gap-2 h-9">
            <Plus className="w-4 h-4" /> New Plan
          </Button>
        </div>
      </div>

      {/* Content */}
      {listEmpty ? (
        <Card className="border border-border border-dashed">
          <CardContent className="py-16 text-center flex flex-col gap-3 items-center">
            <p className="text-sm text-muted-foreground max-w-sm">
              No maintenance plans yet. Create a plan to schedule recurring service and reminders for customer equipment.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New Plan
            </Button>
          </CardContent>
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onClick={() => setSelectedPlan(plan)} />
          ))}
          {filteredEmpty && (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
              No plans match the current filters.
            </div>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Plan Name", "Customer", "Equipment", "Interval", "Technician", "Next Due", "Status", ""].map((h, colIdx) => (
                  <th key={`th-${colIdx}`} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((plan) => {
                const days = daysUntil(plan.nextDueDate)
                const accent = planDueAccent(days)
                return (
                  <tr
                    key={plan.id}
                    className={cn(
                      "bg-card hover:bg-muted/30 cursor-pointer transition-colors",
                      accent === "overdue" && "bg-destructive/[0.06]",
                      accent === "dueToday" && "bg-amber-500/[0.06]",
                    )}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground">{plan.name}</span>
                        {accent === "overdue" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-semibold shrink-0">
                            Overdue
                          </Badge>
                        )}
                        {accent === "dueToday" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 font-semibold shrink-0 border-amber-500/60 text-amber-800 dark:text-amber-300 bg-amber-500/10"
                          >
                            Due today
                          </Badge>
                        )}
                        {plan.autoCreateWorkOrder && <Zap className="w-3 h-3 text-blue-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{plan.equipmentName}</td>
                    <td className="px-4 py-3">{plan.interval === "Custom" ? `${plan.customIntervalDays}d` : plan.interval}</td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.technicianName}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", urgencyClass(days))}>{plan.nextDueDate}</span>
                      <span className={cn("block text-xs", urgencyClass(days))}>{formatDays(days)}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                    </td>
                  </tr>
                )
              })}
              {filteredEmpty && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No plans match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateMaintenancePlanDialog
        open={createOpen}
        onClose={handleCloseCreateModal}
        prefillCustomerId={prefillCustomerId}
        prefillEquipmentId={prefillEquipmentId}
      />
      {selectedPlan && (
        <PlanDetailSheet
          plan={plans.find((p) => p.id === selectedPlan.id) ?? selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}

      <Toaster />
    </div>
  )
}

export default function MaintenancePlansPage() {
  return <Suspense fallback={null}><MaintenancePlansPageInner /></Suspense>
}

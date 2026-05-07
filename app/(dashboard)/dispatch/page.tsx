"use client"

import { useCallback, useEffect, useMemo, useState, Suspense } from "react"
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  missingOperationalBillingColumns,
  missingWorkOrderNumberColumn,
} from "@/lib/work-orders/postgrest-fallback"
import { WO_DISPATCH_SCHEDULE_SELECT_NO_BILLING_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"
import {
  queryOrganizationMembersForRoster,
  queryProfilesForRoster,
} from "@/lib/technicians/roster-queries"
import { cn } from "@/lib/utils"
import {
  addDays,
  startOfWeekMonday,
  toYmd,
} from "@/lib/dispatch/board-utils"
import {
  DispatchBoard,
  buildSchedulePatch,
  type DispatchTech,
  type DispatchWo,
} from "@/components/dispatch/dispatch-board"
import { DispatchMobileList } from "@/components/dispatch/dispatch-mobile-list"
import { DispatchStatusFilter } from "@/components/dispatch/dispatch-status-filter"
import { DispatchWeekOverview } from "@/components/dispatch/dispatch-week-overview"
import { QuickAppointmentDialog } from "@/components/dispatch/quick-appointment-dialog"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { Button } from "@/components/ui/button"
import {
  enrichDispatchWorkOrders,
  filterDispatchRows,
  sortDispatchRows,
} from "@/lib/dispatch/build-dispatch-wos"
import { DISPATCH_FOCUS_OPTIONS, type DispatchFilterId } from "@/lib/dispatch/operational-badges"
import {
  DEFAULT_DISPATCH_STATUSES,
  DISPATCH_STATUS_ORDER,
  countByStatus,
  filterByStatuses,
  type DispatchStatusKey,
} from "@/lib/dispatch/status-filter"
import { usePersistedDispatchPref } from "@/lib/dispatch/persisted-prefs"
import {
  describeConflicts,
  describeNeighborConflicts,
  findNeighborSlotConflicts,
  findSlotConflicts,
} from "@/lib/dispatch/scheduling-conflicts"
import { useToast } from "@/hooks/use-toast"
import {
  composeConflictAcknowledgedMessage,
  composeReassignMessage,
  composeRescheduleMessage,
  composeUnassignMessage,
  emitSchedulingEvent,
  severityForConflictAck,
} from "@/lib/dispatch/scheduling-events-client"

const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const
const DISPATCH_STATUSES_BASE = ["open", "scheduled", "in_progress", "completed"] as const
const DISPATCH_STATUSES_WITH_INVOICED = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
] as const

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function isStatusKeyArray(v: unknown): v is DispatchStatusKey[] {
  if (!Array.isArray(v)) return false
  const known = new Set<string>(DISPATCH_STATUS_ORDER)
  return v.every((x) => typeof x === "string" && known.has(x))
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean"
}

function isDispatchSort(v: unknown): v is "schedule" | "priority" {
  return v === "schedule" || v === "priority"
}

function DispatchPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekMonday(new Date()))
  const [selectedYmd, setSelectedYmd] = useState(() => toYmd(new Date()))

  const [technicians, setTechnicians] = useState<DispatchTech[]>([])
  const [workOrders, setWorkOrders] = useState<DispatchWo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [persistBusy, setPersistBusy] = useState(false)
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [dispatchFilter, setDispatchFilter] = useState<DispatchFilterId>("all")
  const [dispatchSort, setDispatchSort] = usePersistedDispatchPref<"schedule" | "priority">({
    scope: "dispatch",
    key: "sort",
    organizationId: activeOrgId,
    defaultValue: "schedule",
    isValid: isDispatchSort,
  })
  const [statusFilter, setStatusFilter] = usePersistedDispatchPref<DispatchStatusKey[]>({
    scope: "dispatch",
    key: "status-filter",
    organizationId: activeOrgId,
    defaultValue: DEFAULT_DISPATCH_STATUSES,
    isValid: isStatusKeyArray,
  })
  const [includeInvoiced, setIncludeInvoiced] = usePersistedDispatchPref<boolean>({
    scope: "dispatch",
    key: "include-invoiced",
    organizationId: activeOrgId,
    defaultValue: false,
    isValid: isBoolean,
  })
  const [weekOverviewVisible, setWeekOverviewVisible] = usePersistedDispatchPref<boolean>({
    scope: "dispatch",
    key: "week-overview-visible",
    organizationId: activeOrgId,
    defaultValue: false,
    isValid: isBoolean,
  })
  const [moreFiltersOpen, setMoreFiltersOpen] = usePersistedDispatchPref<boolean>({
    scope: "dispatch",
    key: "more-filters-expanded",
    organizationId: activeOrgId,
    defaultValue: false,
    isValid: isBoolean,
  })
  const [allSignalsOpen, setAllSignalsOpen] = usePersistedDispatchPref<boolean>({
    scope: "dispatch",
    key: "all-signals-expanded",
    organizationId: activeOrgId,
    defaultValue: false,
    isValid: isBoolean,
  })
  const [quickAddSeed, setQuickAddSeed] = useState<{
    technicianId: string | null
    scheduledOn: string
    scheduledTimeHhMm: string | null
  } | null>(null)

  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const displayWorkOrders = useMemo(() => {
    const opsFiltered = filterDispatchRows(workOrders, dispatchFilter)
    const statusFiltered = filterByStatuses(opsFiltered, statusFilter)
    return sortDispatchRows(statusFiltered, dispatchSort)
  }, [workOrders, dispatchFilter, statusFilter, dispatchSort])

  const statusCounts = useMemo(
    () => countByStatus(filterDispatchRows(workOrders, dispatchFilter)),
    [workOrders, dispatchFilter],
  )

  const technicianOptionsForQuickAdd = useMemo(
    () => technicians.map((t) => ({ id: t.id, label: t.label })),
    [technicians],
  )

  // Active focus filter label for the "More filters" trigger and clear chip.
  const activeFocusLabel = useMemo(() => {
    if (dispatchFilter === "all") return null
    return DISPATCH_FOCUS_OPTIONS.find((o) => o.id === dispatchFilter)?.label ?? null
  }, [dispatchFilter])

  const handleQuickAdd = useCallback(
    (args: {
      technicianId: string | null
      scheduledOn: string
      scheduledTimeHhMm: string | null
    }) => {
      setQuickAddSeed(args)
    },
    [],
  )

  const handleStatusToggle = useCallback((key: DispatchStatusKey) => {
    setStatusFilter((prev) => {
      const set = new Set(prev)
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return [...set]
    })
  }, [])

  const dispatchKpi = useMemo(() => {
    const k = {
      dueToday: 0,
      dueTomorrow: 0,
      dueNext7: 0,
      overdue: 0,
      unbilled: 0,
      overdueInv: 0,
      pmOd: 0,
      calOd: 0,
      unassigned: 0,
      certPend: 0,
      priorityJobs: 0,
      billingReady: 0,
    }
    for (const w of workOrders) {
      const f = w.opsFlags
      if (!f) continue
      if (f.due_today) k.dueToday++
      if (f.due_tomorrow) k.dueTomorrow++
      if (f.due_next_7) k.dueNext7++
      if (f.sched_past_due) k.overdue++
      if (f.not_invoiced || f.completed_not_invoiced_aging) k.unbilled++
      if (f.overdue_invoice) k.overdueInv++
      if (f.pm_overdue) k.pmOd++
      if (f.cal_overdue) k.calOd++
      if (f.unassigned_aging) k.unassigned++
      if (f.cert_pending) k.certPend++
      if (f.emergency || f.high_priority) k.priorityJobs++
      if (f.billing_ready) k.billingReady++
    }
    return k
  }, [workOrders])

  useEffect(() => {
    const days = weekDays.map((d) => toYmd(d))
    setSelectedYmd((prev) => (days.includes(prev) ? prev : days[0] ?? prev))
  }, [weekDays])

  const loadData = useCallback(async () => {
    setLoadError(null)
    if (orgStatus !== "ready" || !activeOrgId) {
      setTechnicians([])
      setWorkOrders([])
      setLoading(false)
      return
    }

    const orgId = activeOrgId
    const supabase = createBrowserSupabaseClient()
    const ws = toYmd(weekStart)
    const we = toYmd(weekEnd)

    setLoading(true)

    const memberRes = await queryOrganizationMembersForRoster(supabase, {
      organizationId: orgId,
      statusIn: ["active"],
      roleIn: ROSTER_MEMBER_ROLES,
    })

    if (memberRes.error) {
      setLoadError(memberRes.error.message)
      setTechnicians([])
      setWorkOrders([])
      setLoading(false)
      return
    }

    const userIds = [...new Set((memberRes.data ?? []).map((m: { user_id: string }) => m.user_id))]
    const profRes = await queryProfilesForRoster(supabase, userIds)

    const techList: DispatchTech[] = (
      (profRes.data as Array<{ id: string; full_name: string | null; email: string | null; avatar_url?: string | null }> | null) ??
      []
    ).map((p) => {
      const label =
        (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Technician"
      return {
        id: p.id,
        label,
        initials: initialsFromName(label),
        avatarUrl: p.avatar_url?.trim() || null,
      }
    })
    techList.sort((a, b) => a.label.localeCompare(b.label))
    setTechnicians(techList)

    const selFull =
      "id, work_order_number, title, status, scheduled_on, scheduled_time, assigned_user_id, customer_id, equipment_id, priority, type, billing_state, maintenance_plan_id, calibration_template_id, billable_to_customer, warranty_review_required, total_parts_cents, created_at, completed_at"
    const selNoBilling = WO_DISPATCH_SCHEDULE_SELECT_NO_BILLING_WITH_NUM
    const selMini =
      "id, title, status, scheduled_on, scheduled_time, assigned_user_id, customer_id, equipment_id, priority, type, created_at"

    const dispatchStatuses = includeInvoiced
      ? [...DISPATCH_STATUSES_WITH_INVOICED]
      : [...DISPATCH_STATUSES_BASE]

    async function fetchRange(): Promise<{ data: unknown; error: { message: string } | null; mini: boolean }> {
      let mini = false
      let q = supabase
        .from("work_orders")
        .select(selFull)
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .in("status", dispatchStatuses)
        .gte("scheduled_on", ws)
        .lte("scheduled_on", we)

      let res = await q
      if (res.error && missingOperationalBillingColumns(res.error)) {
        res = await supabase
          .from("work_orders")
          .select(selNoBilling)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .in("status", dispatchStatuses)
          .gte("scheduled_on", ws)
          .lte("scheduled_on", we)
      }
      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        mini = true
        res = await supabase
          .from("work_orders")
          .select(selMini)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .in("status", dispatchStatuses)
          .gte("scheduled_on", ws)
          .lte("scheduled_on", we)
      }
      return { data: res.data, error: res.error, mini }
    }

    async function fetchUnassigned(): Promise<{ data: unknown; error: { message: string } | null; mini: boolean }> {
      let mini = false
      let q = supabase
        .from("work_orders")
        .select(selFull)
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .is("assigned_user_id", null)
        .in("status", ["open", "scheduled", "in_progress"])

      let res = await q
      if (res.error && missingOperationalBillingColumns(res.error)) {
        res = await supabase
          .from("work_orders")
          .select(selNoBilling)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .is("assigned_user_id", null)
          .in("status", ["open", "scheduled", "in_progress"])
      }
      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        mini = true
        res = await supabase
          .from("work_orders")
          .select(selMini)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .is("assigned_user_id", null)
          .in("status", ["open", "scheduled", "in_progress"])
      }
      return { data: res.data, error: res.error, mini }
    }

    const [rangeRes, unassignRes] = await Promise.all([fetchRange(), fetchUnassigned()])

    if (rangeRes.error) {
      setLoadError(rangeRes.error.message)
      setWorkOrders([])
      setLoading(false)
      return
    }
    if (unassignRes.error) {
      setLoadError(unassignRes.error.message)
      setWorkOrders([])
      setLoading(false)
      return
    }

    type RawWo = {
      id: string
      work_order_number?: number | null
      title: string
      status: string
      scheduled_on: string | null
      scheduled_time: string | null
      assigned_user_id: string | null
      customer_id: string
      equipment_id: string
      priority?: string | null
      type?: string | null
      billing_state?: string | null
      maintenance_plan_id?: string | null
      calibration_template_id?: string | null
      billable_to_customer?: boolean | null
      warranty_review_required?: boolean | null
      total_parts_cents?: number | null
      created_at?: string | null
      completed_at?: string | null
    }

    const rowMap = new Map<string, RawWo>()
    const ingest = (rows: unknown, mini: boolean) => {
      for (const r of (rows as Partial<RawWo>[]) ?? []) {
        if (!r.id || !r.title || !r.customer_id) continue
        rowMap.set(r.id, {
          id: r.id,
          work_order_number: r.work_order_number ?? null,
          title: r.title,
          status: r.status ?? "open",
          scheduled_on: r.scheduled_on ?? null,
          scheduled_time: r.scheduled_time ?? null,
          assigned_user_id: r.assigned_user_id ?? null,
          customer_id: r.customer_id,
          equipment_id: r.equipment_id ?? "",
          priority: r.priority ?? "normal",
          type: r.type ?? "repair",
          billing_state: mini ? null : (r.billing_state ?? null),
          maintenance_plan_id: mini ? null : (r.maintenance_plan_id ?? null),
          calibration_template_id: mini ? null : (r.calibration_template_id ?? null),
          billable_to_customer: mini ? true : (r.billable_to_customer ?? true),
          warranty_review_required: mini ? false : Boolean(r.warranty_review_required),
          total_parts_cents: mini ? 0 : (r.total_parts_cents ?? 0),
          created_at: r.created_at ?? new Date(0).toISOString(),
          completed_at: mini ? null : (r.completed_at ?? null),
        })
      }
    }
    ingest(rangeRes.data, rangeRes.mini)
    ingest(unassignRes.data, unassignRes.mini)

    const mergedRaw = [...rowMap.values()]
    const custIds = [...new Set(mergedRaw.map((w) => w.customer_id).filter(Boolean))] as string[]

    const customerMap = new Map<string, string>()
    if (custIds.length > 0) {
      const { data: custRows } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .in("id", custIds)

      ;((custRows as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
        customerMap.set(c.id, c.company_name)
      })
    }

    const techByUserId = new Map(techList.map((t) => [t.id, t] as const))
    const enriched = await enrichDispatchWorkOrders(supabase, orgId, mergedRaw, techByUserId, customerMap)

    setWorkOrders(enriched)
    setLoading(false)
  }, [activeOrgId, orgStatus, weekStart, weekEnd, refresh, includeInvoiced])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleMoveWo(args: {
    woId: string
    assignedUserId: string | null
    scheduledOn: string
    scheduledTimeHhMm: string | null
  }) {
    if (!activeOrgId || orgStatus !== "ready") return
    const wo = workOrders.find((w) => w.id === args.woId)
    if (!wo) return

    const conflicts = findSlotConflicts(
      workOrders,
      {
        technicianId: args.assignedUserId,
        scheduledOn: args.scheduledOn,
        scheduledTimeHhMm: args.scheduledTimeHhMm,
      },
      { excludeWoId: args.woId },
    )
    const neighborConflicts = findNeighborSlotConflicts(
      workOrders,
      {
        technicianId: args.assignedUserId,
        scheduledOn: args.scheduledOn,
        scheduledTimeHhMm: args.scheduledTimeHhMm,
      },
      { excludeWoId: args.woId },
    )
    const techLabel = args.assignedUserId
      ? technicians.find((t) => t.id === args.assignedUserId)?.label ?? null
      : null
    const previousTechLabel = wo.assigned_user_id
      ? technicians.find((t) => t.id === wo.assigned_user_id)?.label ?? wo.technicianLabel ?? null
      : wo.technicianLabel ?? null

    setPersistBusy(true)
    const supabase = createBrowserSupabaseClient()
    const assign = await workOrderAssignmentColumns(supabase, activeOrgId, args.assignedUserId)
    const patch = buildSchedulePatch({
      scheduledOn: args.scheduledOn,
      scheduledTimeHhMm: args.scheduledTimeHhMm,
      assignment: assign,
      previousStatus: wo.status,
    })

    const { error } = await supabase
      .from("work_orders")
      .update(patch)
      .eq("id", args.woId)
      .eq("organization_id", activeOrgId)

    setPersistBusy(false)

    if (error) {
      setLoadError(error.message)
      return
    }
    setLoadError(null)
    setRefresh((n) => n + 1)

    // Phase 4: emit scheduling events. Always non-blocking — silently dropped on failure.
    const orgId = activeOrgId
    const techChanged = wo.assigned_user_id !== args.assignedUserId
    const scheduleChanged =
      wo.scheduled_on !== args.scheduledOn || (wo.scheduled_time ?? null) !== (args.scheduledTimeHhMm ?? null)

    if (techChanged) {
      void emitSchedulingEvent({
        organizationId: orgId,
        workOrderId: args.woId,
        eventType: args.assignedUserId ? "reassign" : "unassign",
        severity: "info",
        message: args.assignedUserId
          ? composeReassignMessage({ fromTechLabel: previousTechLabel, toTechLabel: techLabel })
          : composeUnassignMessage({ fromTechLabel: previousTechLabel }),
        metadata: {
          source: "dispatch_board.drag_drop",
          previousTechnicianId: wo.assigned_user_id ?? null,
          nextTechnicianId: args.assignedUserId,
        },
      })
    }
    if (scheduleChanged && args.assignedUserId) {
      void emitSchedulingEvent({
        organizationId: orgId,
        workOrderId: args.woId,
        eventType: "reschedule",
        severity: "info",
        message: composeRescheduleMessage({
          scheduledOn: args.scheduledOn,
          scheduledTimeHhMm: args.scheduledTimeHhMm,
        }),
        metadata: {
          source: "dispatch_board.drag_drop",
          previousScheduledOn: wo.scheduled_on,
          previousScheduledTime: wo.scheduled_time,
          nextScheduledOn: args.scheduledOn,
          nextScheduledTime: args.scheduledTimeHhMm,
          technicianId: args.assignedUserId,
        },
      })
    }

    const conflictMsg = describeConflicts(conflicts, techLabel)
    if (conflictMsg) {
      toast({
        variant: "destructive",
        title: "Scheduling conflict",
        description: `${conflictMsg} The move was saved — review the slot before dispatching.`,
      })
      void emitSchedulingEvent({
        organizationId: orgId,
        workOrderId: args.woId,
        eventType: "conflict_acknowledged",
        severity: severityForConflictAck("exact"),
        message: composeConflictAcknowledgedMessage({
          conflictCount: conflicts.length,
          techLabel,
          proximity: "exact",
        }),
        metadata: {
          source: "dispatch_board.drag_drop",
          proximity: "exact",
          conflictCount: conflicts.length,
          // Keep DB-only IDs in metadata; never rendered in the timeline message.
          conflictWorkOrderIds: conflicts.map((c) => c.id),
        },
      })
    } else {
      const neighborMsg = describeNeighborConflicts(neighborConflicts, techLabel)
      if (neighborMsg) {
        toast({
          variant: "default",
          title: "Tight schedule",
          description: `${neighborMsg} The move was saved.`,
        })
        void emitSchedulingEvent({
          organizationId: orgId,
          workOrderId: args.woId,
          eventType: "conflict_acknowledged",
          severity: severityForConflictAck("neighbor"),
          message: composeConflictAcknowledgedMessage({
            conflictCount: neighborConflicts.length,
            techLabel,
            proximity: "neighbor",
          }),
          metadata: {
            source: "dispatch_board.drag_drop",
            proximity: "neighbor",
            conflictCount: neighborConflicts.length,
            conflictWorkOrderIds: neighborConflicts.map((c) => c.id),
          },
        })
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {/* Week + day picker */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekAnchor((d) => addDays(d, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-sm font-medium text-foreground">
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
            {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekAnchor((d) => addDays(d, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {weekDays.map((d) => {
            const ymd = toYmd(d)
            const isSel = ymd === selectedYmd
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setSelectedYmd(ymd)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isSel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })}
              </button>
            )
          })}
        </div>
      </div>

      {/* Compact operational snapshot — 5 primary signals + collapsible advanced */}
      <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Operational signals
          </p>
          <button
            type="button"
            onClick={() => setAllSignalsOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
            aria-expanded={allSignalsOpen}
          >
            {allSignalsOpen ? "Hide signals" : "View all signals"}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", allSignalsOpen && "rotate-180")}
            />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["Due today", dispatchKpi.dueToday, "due_today"],
              ["Overdue", dispatchKpi.overdue, "sched_past_due"],
              ["Unassigned 48h+", dispatchKpi.unassigned, "unassigned_aging"],
              ["Ready to bill", dispatchKpi.billingReady, "billing_ready"],
              ["Cert pending", dispatchKpi.certPend, "cert_pending"],
            ] as const
          ).map(([label, n, focus]) => (
            <button
              type="button"
              key={label}
              onClick={() =>
                setDispatchFilter((cur) => (cur === focus ? "all" : (focus as DispatchFilterId)))
              }
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                dispatchFilter === focus
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/40",
              )}
              aria-pressed={dispatchFilter === focus}
            >
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="text-base font-semibold tabular-nums text-foreground">{n}</span>
            </button>
          ))}
        </div>
        {allSignalsOpen ? (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Tomorrow", dispatchKpi.dueTomorrow, "due_tomorrow"],
                ["Next 7 days", dispatchKpi.dueNext7, "due_next_7"],
                ["Unbilled / CNI", dispatchKpi.unbilled, "invoice_pending"],
                ["Overdue invoice", dispatchKpi.overdueInv, "overdue_invoice"],
                ["PM overdue", dispatchKpi.pmOd, "pm_overdue"],
                ["Cal overdue", dispatchKpi.calOd, "cal_overdue"],
                ["Priority / urgent", dispatchKpi.priorityJobs, "high_priority"],
              ] as const
            ).map(([label, n, focus]) => (
              <button
                type="button"
                key={label}
                onClick={() =>
                  setDispatchFilter((cur) => (cur === focus ? "all" : (focus as DispatchFilterId)))
                }
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                  dispatchFilter === focus
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/40",
                )}
                aria-pressed={dispatchFilter === focus}
              >
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <span className="text-base font-semibold tabular-nums text-foreground">{n}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Primary filter row: status chips + sort + quick add + more-filters trigger */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <DispatchStatusFilter
          selected={statusFilter}
          onToggle={handleStatusToggle}
          counts={statusCounts}
          includeInvoiced={includeInvoiced}
          onIncludeInvoicedChange={setIncludeInvoiced}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 gap-1.5 text-xs",
              // Active = blue tint, not CTA orange.
              (moreFiltersOpen || activeFocusLabel) &&
                "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
            onClick={() => setMoreFiltersOpen((v) => !v)}
            aria-expanded={moreFiltersOpen}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            More filters
            {activeFocusLabel ? (
              <span className="ml-0.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium text-primary">
                1
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "h-8 gap-1.5 text-xs",
              weekOverviewVisible &&
                "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
            onClick={() => setWeekOverviewVisible((v) => !v)}
            aria-expanded={weekOverviewVisible}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {weekOverviewVisible ? "Hide week overview" : "Show week overview"}
          </Button>
          {/* Quick add — primary CTA (orange). Same variant as Add Customer / New Work Order. */}
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() =>
              handleQuickAdd({
                technicianId: null,
                scheduledOn: selectedYmd,
                scheduledTimeHhMm: null,
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Quick add
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">Sort</span>
            <select
              value={dispatchSort}
              onChange={(e) => setDispatchSort(e.target.value as "schedule" | "priority")}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
              aria-label="Sort dispatch list"
            >
              <option value="schedule">By time</option>
              <option value="priority">By priority</option>
            </select>
          </label>
        </div>
      </div>

      {/* Active focus chip — shows current advanced filter outside the panel */}
      {activeFocusLabel ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Focus
          </span>
          <button
            type="button"
            onClick={() => setDispatchFilter("all")}
            className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
            aria-label={`Clear focus filter: ${activeFocusLabel}`}
          >
            {activeFocusLabel}
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      {/* Advanced focus filters (collapsed) */}
      {moreFiltersOpen ? (
        <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Advanced filters
            </p>
            {activeFocusLabel ? (
              <button
                type="button"
                onClick={() => setDispatchFilter("all")}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Operational focus"
          >
            {DISPATCH_FOCUS_OPTIONS.map(({ id, label }) => {
              const active = dispatchFilter === id
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 shrink-0 text-[11px]",
                    active &&
                      "border-primary bg-primary/10 text-primary shadow-sm hover:bg-primary/15 hover:text-primary",
                  )}
                  onClick={() => setDispatchFilter(id)}
                  aria-pressed={active}
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Week overview (collapsed by default; persisted) */}
      {weekOverviewVisible && !loading && technicians.length > 0 ? (
        <DispatchWeekOverview
          technicians={technicians}
          workOrders={displayWorkOrders}
          weekAnchor={weekAnchor}
          selectedYmd={selectedYmd}
          onSelectYmd={setSelectedYmd}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading dispatch…</p>
      ) : (
        <>
          <div className="hidden md:block">
            <DispatchBoard
              technicians={technicians}
              workOrders={displayWorkOrders}
              selectedYmd={selectedYmd}
              onOpenWo={setSelectedWoId}
              onMoveWo={handleMoveWo}
              busy={persistBusy}
              onQuickAdd={handleQuickAdd}
            />
          </div>
          <div className="md:hidden">
            <DispatchMobileList
              technicians={technicians}
              workOrders={displayWorkOrders}
              selectedYmd={selectedYmd}
              onOpenWo={setSelectedWoId}
              onQuickAdd={handleQuickAdd}
            />
          </div>
        </>
      )}

      <WorkOrderDrawer
        workOrderId={selectedWoId}
        onClose={() => setSelectedWoId(null)}
        onUpdated={() => setRefresh((n) => n + 1)}
      />

      <QuickAppointmentDialog
        open={quickAddSeed !== null}
        onClose={() => setQuickAddSeed(null)}
        defaultDate={quickAddSeed?.scheduledOn ?? selectedYmd}
        defaultTimeHhMm={quickAddSeed?.scheduledTimeHhMm ?? null}
        defaultTechnicianId={quickAddSeed?.technicianId ?? null}
        technicians={technicianOptionsForQuickAdd}
        existingWorkOrders={workOrders}
        onCreated={() => {
          setQuickAddSeed(null)
          setRefresh((n) => n + 1)
        }}
      />
    </div>
  )
}

export default function DispatchPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <DispatchPageInner />
    </Suspense>
  )
}

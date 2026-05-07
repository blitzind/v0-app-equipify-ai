"use client"

import { useCallback, useEffect, useMemo, useState, Suspense } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
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
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { Button } from "@/components/ui/button"
import {
  enrichDispatchWorkOrders,
  filterDispatchRows,
  sortDispatchRows,
} from "@/lib/dispatch/build-dispatch-wos"
import type { DispatchFilterId } from "@/lib/dispatch/operational-badges"

const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const
const DISPATCH_STATUSES = ["open", "scheduled", "in_progress", "completed"] as const

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function DispatchPageInner() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()

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
  const [dispatchSort, setDispatchSort] = useState<"schedule" | "priority">("schedule")

  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const displayWorkOrders = useMemo(() => {
    const filtered = filterDispatchRows(workOrders, dispatchFilter)
    return sortDispatchRows(filtered, dispatchSort)
  }, [workOrders, dispatchFilter, dispatchSort])

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
      "id, work_order_number, title, status, scheduled_on, scheduled_time, assigned_user_id, customer_id, equipment_id, priority, type, billing_state, maintenance_plan_id, calibration_template_id, billable_to_customer, warranty_review_required, total_parts_cents, created_at"
    const selMini =
      "id, title, status, scheduled_on, scheduled_time, assigned_user_id, customer_id, equipment_id, priority, type, created_at"

    async function fetchRange(): Promise<{ data: unknown; error: { message: string } | null; mini: boolean }> {
      let mini = false
      let q = supabase
        .from("work_orders")
        .select(selFull)
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .in("status", [...DISPATCH_STATUSES])
        .gte("scheduled_on", ws)
        .lte("scheduled_on", we)

      let res = await q
      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        mini = true
        res = await supabase
          .from("work_orders")
          .select(selMini)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .in("status", [...DISPATCH_STATUSES])
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
  }, [activeOrgId, orgStatus, weekStart, weekEnd, refresh])

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Operational focus">
          {(
            [
              ["all", "All"],
              ["billing_ready", "Ready to bill"],
              ["cert_pending", "Cert / compliance"],
              ["pm_risk", "PM & calibration"],
              ["unassigned_aging", "Unassigned aging"],
              ["warranty_review", "Warranty review"],
            ] as const
          ).map(([id, label]) => {
            const active = dispatchFilter === id
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setDispatchFilter(id)}
              >
                {label}
              </Button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Sort</span>
          <select
            value={dispatchSort}
            onChange={(e) => setDispatchSort(e.target.value as "schedule" | "priority")}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          >
            <option value="schedule">By time</option>
            <option value="priority">By priority</option>
          </select>
        </label>
      </div>

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
            />
          </div>
          <div className="md:hidden">
            <DispatchMobileList
              technicians={technicians}
              workOrders={displayWorkOrders}
              selectedYmd={selectedYmd}
              onOpenWo={setSelectedWoId}
            />
          </div>
        </>
      )}

      <WorkOrderDrawer
        workOrderId={selectedWoId}
        onClose={() => setSelectedWoId(null)}
        onUpdated={() => setRefresh((n) => n + 1)}
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

"use client"

import { useCallback, useEffect, useMemo, useState, Suspense } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
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

  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

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
      "id, work_order_number, title, status, scheduled_on, scheduled_time, assigned_user_id, customer_id"
    const selMini =
      "id, title, status, scheduled_on, scheduled_time, assigned_user_id, customer_id"

    async function fetchRange() {
      let q = supabase
        .from("work_orders")
        .select(selFull)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .in("status", [...DISPATCH_STATUSES])
        .gte("scheduled_on", ws)
        .lte("scheduled_on", we)

      let res = await q
      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        res = await supabase
          .from("work_orders")
          .select(selMini)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .in("status", [...DISPATCH_STATUSES])
          .gte("scheduled_on", ws)
          .lte("scheduled_on", we)
      }
      return res
    }

    async function fetchUnassigned() {
      let q = supabase
        .from("work_orders")
        .select(selFull)
        .eq("organization_id", orgId)
        .eq("is_archived", false)
        .is("assigned_user_id", null)
        .in("status", ["open", "scheduled", "in_progress"])

      let res = await q
      if (res.error && missingWorkOrderNumberColumn(res.error)) {
        res = await supabase
          .from("work_orders")
          .select(selMini)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .is("assigned_user_id", null)
          .in("status", ["open", "scheduled", "in_progress"])
      }
      return res
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

    const rowMap = new Map<string, DispatchWo>()
    const ingest = (rows: unknown) => {
      for (const r of (rows as DispatchWo[]) ?? []) {
        rowMap.set(r.id, {
          id: r.id,
          title: r.title,
          status: r.status,
          scheduled_on: r.scheduled_on,
          scheduled_time: r.scheduled_time,
          assigned_user_id: r.assigned_user_id,
          customer_id: r.customer_id,
          customerName: "",
          work_order_number: "work_order_number" in r ? (r as { work_order_number?: number | null }).work_order_number : null,
        })
      }
    }
    ingest(rangeRes.data)
    ingest(unassignRes.data)

    const merged = [...rowMap.values()]
    const custIds = [...new Set(merged.map((w) => w.customer_id).filter(Boolean))] as string[]

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

    for (const wo of merged) {
      wo.customerName = customerMap.get(wo.customer_id) ?? "Customer"
    }

    setWorkOrders(merged)
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
    const patch = buildSchedulePatch({
      scheduledOn: args.scheduledOn,
      scheduledTimeHhMm: args.scheduledTimeHhMm,
      assignedUserId: args.assignedUserId,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading dispatch…</p>
      ) : (
        <>
          <div className="hidden md:block">
            <DispatchBoard
              technicians={technicians}
              workOrders={workOrders}
              selectedYmd={selectedYmd}
              onOpenWo={setSelectedWoId}
              onMoveWo={handleMoveWo}
              busy={persistBusy}
            />
          </div>
          <div className="md:hidden">
            <DispatchMobileList
              technicians={technicians}
              workOrders={workOrders}
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

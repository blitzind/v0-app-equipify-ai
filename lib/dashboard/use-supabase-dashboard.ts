"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import type { AiInsight } from "@/lib/mock-data"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"

// ─── Types ───────────────────────────────────────────────────────────────────

export type DashboardStats = {
  equipmentDueThisMonth: number
  overdueService: number
  openWorkOrders: number
  monthlyRevenueCents: number
  expiringWarrantiesCount: number
  repeatRepairAlertsCount: number
}

export type RecentWorkOrderRow = {
  id: string
  workOrderNumber?: number
  customer: string
  equipment: string
  technician: string
  priority: string
  status: string
  due: string
}

export type EquipmentDueRow = {
  id: string
  name: string
  customer: string
  type: string
  nextService: string
}

export type WarrantyRow = {
  equipmentId: string
  equipmentName: string
  customerName: string
  expires: string
  daysLeft: number
}

export type RepeatRepairRow = {
  equipmentId: string
  equipmentName: string
  customerName: string
  repairs: number
  lastRepair: string
  issue: string
}

export type RevenueMonthPoint = { month: string; revenue: number }

export type WorkOrderStatusSlice = { status: string; count: number }

function monthKey(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" })
}

function boundsThisMonth(): { monthStart: string; monthEnd: string; today: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    monthStart: start.toISOString().slice(0, 10),
    monthEnd: end.toISOString().slice(0, 10),
    today: now.toISOString().slice(0, 10),
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function woDbStatusToUi(s: string): string {
  const m: Record<string, string> = {
    open: "Open",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    invoiced: "Invoiced",
  }
  return m[s] ?? s
}

function woDbPriorityToUi(p: string): string {
  const m: Record<string, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    critical: "Critical",
  }
  return m[p] ?? p
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Rule-based operational insights from live dashboard metrics (no LLM / demo copy). */
export function buildOperationalInsights(input: {
  overdueService: number
  equipmentDueThisMonth: number
  openWorkOrders: number
  expiringWarrantiesCount: number
  repeatRepairAlertsCount: number
  monthlyRevenueCents: number
  topRepeat?: RepeatRepairRow | null
}): AiInsight[] {
  const insights: AiInsight[] = []
  let n = 0
  const id = (s: string) => `op-${s}-${++n}`

  if (input.overdueService > 0) {
    insights.push({
      id: id("overdue"),
      category: "overdue_client",
      severity: "critical",
      title: `${input.overdueService} asset${input.overdueService === 1 ? "" : "s"} past service due date`,
      description:
        "Equipment with a next service date before today still needs scheduling or completion. Review the equipment list and open or complete work orders.",
      meta: "Next service date vs. today",
      value: String(input.overdueService),
      actionLabel: "View equipment",
      actionHref: "/equipment",
    })
  }

  if (input.equipmentDueThisMonth > 0) {
    insights.push({
      id: id("due-month"),
      category: "revenue_opportunity",
      severity: input.overdueService > 0 ? "medium" : "high",
      title: `${input.equipmentDueThisMonth} service visit${input.equipmentDueThisMonth === 1 ? "" : "s"} due this month`,
      description:
        "These assets have a next service date in the current calendar month. Planning now helps avoid backlog.",
      meta: "Current month window",
      value: String(input.equipmentDueThisMonth),
      actionLabel: "View work orders",
      actionHref: "/work-orders",
    })
  }

  if (input.openWorkOrders > 0) {
    insights.push({
      id: id("open-wo"),
      category: "upsell",
      severity: "medium",
      title: `${input.openWorkOrders} open work order${input.openWorkOrders === 1 ? "" : "s"}`,
      description:
        "Work orders in Open, Scheduled, or In Progress status. Clear the queue to improve response time and billing.",
      meta: "Open, scheduled, and in progress",
      value: String(input.openWorkOrders),
      actionLabel: "Open queue",
      actionHref: "/work-orders",
    })
  }

  if (input.expiringWarrantiesCount > 0) {
    insights.push({
      id: id("warranty"),
      category: "expiring_warranty",
      severity: "high",
      title: `${input.expiringWarrantiesCount} warrant${input.expiringWarrantiesCount === 1 ? "y" : "ies"} expiring within 30 days`,
      description:
        "Equipment with a recorded warranty end date in the next 30 days. Confirm coverage and renewal with customers.",
      meta: "Recorded warranty end date",
      value: String(input.expiringWarrantiesCount),
      actionLabel: "View equipment",
      actionHref: "/equipment",
    })
  }

  if (input.repeatRepairAlertsCount > 0 && input.topRepeat) {
    insights.push({
      id: id("repeat"),
      category: "repeat_failure",
      severity: "high",
      title: `Repeat work on ${input.topRepeat.equipmentName}`,
      description: `${input.topRepeat.repairs} work orders in the last 90 days for this asset (${input.topRepeat.customerName}). ${input.topRepeat.issue}`,
      meta: "90-day window",
      value: `${input.topRepeat.repairs}×`,
      actionLabel: "View equipment",
      actionHref: `/equipment?open=${encodeURIComponent(input.topRepeat.equipmentId)}`,
    })
  } else if (input.repeatRepairAlertsCount > 0) {
    insights.push({
      id: id("repeat-generic"),
      category: "repeat_failure",
      severity: "high",
      title: `${input.repeatRepairAlertsCount} asset${input.repeatRepairAlertsCount === 1 ? "" : "s"} with repeat work orders`,
      description:
        "Multiple work orders on the same equipment in the last 90 days may indicate recurring faults or incomplete fixes.",
      meta: "90-day window",
      value: String(input.repeatRepairAlertsCount),
      actionLabel: "View work orders",
      actionHref: "/work-orders",
    })
  }

  if (input.monthlyRevenueCents > 0) {
    const dollars = Math.round(input.monthlyRevenueCents / 100)
    insights.push({
      id: id("revenue"),
      category: "revenue_opportunity",
      severity: "low",
      title: `Completed work revenue this month: $${dollars.toLocaleString()}`,
      description:
        "Sum of labor and parts on work orders marked completed or invoiced with activity this month (from your ledger fields).",
      meta: "Completed and invoiced work",
      value: `$${dollars.toLocaleString()}`,
      actionLabel: "View reports",
      actionHref: "/reports",
    })
  }

  return insights
}

export function useSupabaseDashboard() {
  const activeOrg = useActiveOrganization()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    equipmentDueThisMonth: 0,
    overdueService: 0,
    openWorkOrders: 0,
    monthlyRevenueCents: 0,
    expiringWarrantiesCount: 0,
    repeatRepairAlertsCount: 0,
  })
  const [recentWorkOrders, setRecentWorkOrders] = useState<RecentWorkOrderRow[]>([])
  const [equipmentDueSoon, setEquipmentDueSoon] = useState<EquipmentDueRow[]>([])
  const [expiringWarranties, setExpiringWarranties] = useState<WarrantyRow[]>([])
  const [repeatRepairs, setRepeatRepairs] = useState<RepeatRepairRow[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueMonthPoint[]>([])
  const [workOrdersByStatus, setWorkOrdersByStatus] = useState<WorkOrderStatusSlice[]>([])
  const [operationalInsights, setOperationalInsights] = useState<AiInsight[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setStats({
        equipmentDueThisMonth: 0,
        overdueService: 0,
        openWorkOrders: 0,
        monthlyRevenueCents: 0,
        expiringWarrantiesCount: 0,
        repeatRepairAlertsCount: 0,
      })
      setRecentWorkOrders([])
      setEquipmentDueSoon([])
      setExpiringWarranties([])
      setRepeatRepairs([])
      setRevenueByMonth([])
      setWorkOrdersByStatus([])
      setOperationalInsights([])
      setLoading(false)
      setError("Sign in to load dashboard data.")
      return
    }

    if (activeOrg.status !== "ready") {
      return
    }

    if (!activeOrg.organizationId) {
      setRecentWorkOrders([])
      setEquipmentDueSoon([])
      setExpiringWarranties([])
      setRepeatRepairs([])
      setRevenueByMonth([])
      setWorkOrdersByStatus([])
      setOperationalInsights([])
      setStats({
        equipmentDueThisMonth: 0,
        overdueService: 0,
        openWorkOrders: 0,
        monthlyRevenueCents: 0,
        expiringWarrantiesCount: 0,
        repeatRepairAlertsCount: 0,
      })
      setError(
        activeOrg.organizations.length === 0
          ? "No organizations found for this account."
          : "Select an organization.",
      )
      setLoading(false)
      return
    }

    const orgId = activeOrg.organizationId

    const { monthStart, monthEnd, today } = boundsThisMonth()
    const warrantyBefore = addDays(today, 30)
    const ninetyDaysAgo = addDays(today, -90)

    const chartWindowStart = new Date()
    chartWindowStart.setMonth(chartWindowStart.getMonth() - 11)
    chartWindowStart.setDate(1)
    chartWindowStart.setHours(0, 0, 0, 0)
    const chartWindowStartIso = chartWindowStart.toISOString()

    const recentWoSelectWithNum =
      "id, work_order_number, title, status, priority, scheduled_on, created_at, customer_id, equipment_id, assigned_user_id"
    const recentWoSelect = recentWoSelectWithNum.replace("work_order_number, ", "")

    try {
      let [
        dueMonthCountRes,
        dueMonthListRes,
        overdueCountRes,
        openWoCountRes,
        woStatusRes,
        revenueAggRes,
        warrantyCountRes,
        warrantyListRes,
        recentWoRes,
        woForRepeatRes,
        woForChartRes,
      ] = await Promise.all([
        supabase
          .from("equipment")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .eq("status", "active")
          .not("next_due_at", "is", null)
          .gte("next_due_at", monthStart)
          .lte("next_due_at", monthEnd),
        supabase
          .from("equipment")
          .select("id, name, category, next_due_at, customer_id")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .eq("status", "active")
          .not("next_due_at", "is", null)
          .gte("next_due_at", monthStart)
          .lte("next_due_at", monthEnd)
          .order("next_due_at", { ascending: true })
          .limit(12),
        supabase
          .from("equipment")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .eq("status", "active")
          .not("next_due_at", "is", null)
          .lt("next_due_at", today),
        supabase
          .from("work_orders")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .in("status", ["open", "scheduled", "in_progress"]),
        supabase
          .from("work_orders")
          .select("status")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .in("status", ["open", "scheduled", "in_progress"]),
        supabase
          .from("work_orders")
          .select("total_labor_cents, total_parts_cents, completed_at, updated_at, status")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .in("status", ["completed", "invoiced"])
          .gte("updated_at", `${monthStart}T00:00:00.000Z`),
        supabase
          .from("equipment")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .not("warranty_expires_at", "is", null)
          .gte("warranty_expires_at", today)
          .lte("warranty_expires_at", warrantyBefore),
        supabase
          .from("equipment")
          .select("id, name, warranty_expires_at, customer_id")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .not("warranty_expires_at", "is", null)
          .gte("warranty_expires_at", today)
          .lte("warranty_expires_at", warrantyBefore)
          .order("warranty_expires_at", { ascending: true })
          .limit(12),
        supabase
          .from("work_orders")
          .select(recentWoSelectWithNum)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("work_orders")
          .select("equipment_id, created_at, title")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .gte("created_at", `${ninetyDaysAgo}T00:00:00.000Z`)
          .not("equipment_id", "is", null),
        supabase
          .from("work_orders")
          .select("total_labor_cents, total_parts_cents, updated_at, status")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .in("status", ["completed", "invoiced"])
          .gte("updated_at", chartWindowStartIso),
      ])

      if (recentWoRes.error && missingWorkOrderNumberColumn(recentWoRes.error)) {
        recentWoRes = await supabase
          .from("work_orders")
          .select(recentWoSelect)
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(10)
      }

      const equipmentDueThisMonth = dueMonthCountRes.count ?? 0
      const overdueService = overdueCountRes.count ?? 0
      const openWorkOrders = openWoCountRes.count ?? 0
      const expiringWarrantiesCount = warrantyCountRes.count ?? 0

      const statusRows = (woStatusRes.data ?? []) as { status: string }[]
      const statusAgg: Record<string, number> = {}
      for (const r of statusRows) {
        statusAgg[r.status] = (statusAgg[r.status] ?? 0) + 1
      }
      const pie: WorkOrderStatusSlice[] = ["open", "scheduled", "in_progress"].map((s) => ({
        status: woDbStatusToUi(s),
        count: statusAgg[s] ?? 0,
      }))

      let monthlyRevenueCents = 0
      const revRows = (revenueAggRes.data ?? []) as Array<{
        total_labor_cents: number
        total_parts_cents: number
        updated_at: string
        status: string
      }>
      const monthPrefix = today.slice(0, 7)
      for (const r of revRows) {
        if (r.updated_at.slice(0, 7) === monthPrefix) {
          monthlyRevenueCents += (r.total_labor_cents ?? 0) + (r.total_parts_cents ?? 0)
        }
      }

      const chartRows = (woForChartRes.data ?? []) as Array<{
        total_labor_cents: number
        total_parts_cents: number
        updated_at: string
      }>
      const monthTotals = new Map<string, number>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        monthTotals.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0)
      }
      for (const r of chartRows) {
        const key = r.updated_at.slice(0, 7)
        if (monthTotals.has(key)) {
          monthTotals.set(key, (monthTotals.get(key) ?? 0) + (r.total_labor_cents ?? 0) + (r.total_parts_cents ?? 0))
        }
      }
      const revenuePoints: RevenueMonthPoint[] = [...monthTotals.entries()].map(([ym, cents]) => {
        const [y, m] = ym.split("-").map(Number)
        const label = new Date(y, m - 1, 1)
        return { month: monthKey(label), revenue: Math.round(cents / 100) }
      })

      const eqList = (dueMonthListRes.data ?? []) as Array<{
        id: string
        name: string
        category: string | null
        next_due_at: string
        customer_id: string
      }>
      const custIds = [...new Set(eqList.map((e) => e.customer_id))]
      const customerMap = new Map<string, string>()
      if (custIds.length > 0) {
        const { data: custs } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .in("id", custIds)
        ;((custs as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
          customerMap.set(c.id, c.company_name)
        })
      }
      const dueRows: EquipmentDueRow[] = eqList.map((e) => ({
        id: e.id,
        name: e.name,
        customer: customerMap.get(e.customer_id) ?? "Customer",
        type: e.category?.trim() || "Equipment",
        nextService: fmtShortDate(e.next_due_at),
      }))
      setEquipmentDueSoon(dueRows)

      const wRows = (warrantyListRes.data ?? []) as Array<{
        id: string
        name: string
        warranty_expires_at: string
        customer_id: string
      }>
      const wCustIds = [...new Set(wRows.map((w) => w.customer_id))]
      const wCustomerMap = new Map<string, string>()
      if (wCustIds.length > 0) {
        const { data: wc } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("organization_id", orgId)
          .in("id", wCustIds)
        ;((wc as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
          wCustomerMap.set(c.id, c.company_name)
        })
      }
      const warrantyRows: WarrantyRow[] = wRows.map((w) => {
        const exp = w.warranty_expires_at
        const daysLeft = Math.ceil(
          (new Date(exp + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / (86400000),
        )
        return {
          equipmentId: w.id,
          equipmentName: w.name,
          customerName: wCustomerMap.get(w.customer_id) ?? "Customer",
          expires: fmtShortDate(exp),
          daysLeft,
        }
      })
      setExpiringWarranties(warrantyRows)

      const repeatRaw = (woForRepeatRes.data ?? []) as Array<{
        equipment_id: string
        created_at: string
        title: string | null
      }>
      const byEq = new Map<string, { dates: string[]; titles: string[] }>()
      for (const r of repeatRaw) {
        const cur = byEq.get(r.equipment_id) ?? { dates: [], titles: [] }
        cur.dates.push(r.created_at)
        if (r.title) cur.titles.push(r.title)
        byEq.set(r.equipment_id, cur)
      }
      const repeatIds = [...byEq.entries()].filter(([, v]) => v.dates.length >= 2).map(([id]) => id)
      const repeatRepairAlertsCount = repeatIds.length

      let repeatRows: RepeatRepairRow[] = []
      if (repeatIds.length > 0) {
        const { data: eqMeta } = await supabase
          .from("equipment")
          .select("id, name, customer_id")
          .eq("organization_id", orgId)
          .in("id", repeatIds)
        const eqById = new Map(
          ((eqMeta ?? []) as Array<{ id: string; name: string; customer_id: string }>).map((e) => [e.id, e]),
        )
        const rCust = [...new Set([...eqById.values()].map((e) => e.customer_id))]
        const rMap = new Map<string, string>()
        if (rCust.length > 0) {
          const { data: rc } = await supabase
            .from("customers")
            .select("id, company_name")
            .eq("organization_id", orgId)
            .in("id", rCust)
          ;((rc as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
            rMap.set(c.id, c.company_name)
          })
        }
        repeatRows = repeatIds.map((eqId) => {
          const meta = eqById.get(eqId)
          const pack = byEq.get(eqId)!
          const sorted = [...pack.dates].sort()
          const last = sorted[sorted.length - 1]!
          return {
            equipmentId: eqId,
            equipmentName: meta?.name ?? "Equipment",
            customerName: meta ? rMap.get(meta.customer_id) ?? "Customer" : "Customer",
            repairs: pack.dates.length,
            lastRepair: fmtShortDate(last.slice(0, 10)),
            issue: "Multiple work orders on this asset in the last 90 days.",
          }
        }).sort((a, b) => b.repairs - a.repairs)
      }
      setRepeatRepairs(repeatRows.slice(0, 12))

      const recent = (recentWoRes.data ?? []) as Array<{
        id: string
        work_order_number?: number | null
        title: string
        status: string
        priority: string
        scheduled_on: string | null
        created_at: string
        customer_id: string
        equipment_id: string
        assigned_user_id: string | null
      }>
      const rcIds = [...new Set(recent.map((r) => r.customer_id))]
      const reIds = [...new Set(recent.map((r) => r.equipment_id))]
      const rtIds = [...new Set(recent.map((r) => r.assigned_user_id).filter(Boolean))] as string[]
      const [rcData, reData, rtData] = await Promise.all([
        rcIds.length
          ? supabase.from("customers").select("id, company_name").eq("organization_id", orgId).in("id", rcIds)
          : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
        reIds.length
          ? supabase
              .from("equipment")
              .select("id, name, equipment_code, serial_number, category")
              .eq("organization_id", orgId)
              .in("id", reIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        rtIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", rtIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
      ])
      const cm = new Map(((rcData.data ?? []) as { id: string; company_name: string }[]).map((c) => [c.id, c.company_name]))
      const em = new Map(
        ((reData.data ?? []) as Array<{
          id: string
          name: string
          equipment_code: string | null
          serial_number: string | null
          category: string | null
        }>).map((e) => [e.id, e]),
      )
      const tm = new Map(
        ((rtData.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
          p.id,
          (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Technician",
        ]),
      )
      const recentRows: RecentWorkOrderRow[] = recent.map((r) => ({
        id: r.id,
        workOrderNumber: r.work_order_number ?? undefined,
        customer: cm.get(r.customer_id) ?? "—",
        equipment: (() => {
          const e = em.get(r.equipment_id)
          return e
            ? getEquipmentDisplayPrimary({
                id: r.equipment_id,
                name: e.name,
                equipment_code: e.equipment_code,
                serial_number: e.serial_number,
                category: e.category,
              })
            : "—"
        })(),
        technician: r.assigned_user_id ? tm.get(r.assigned_user_id) ?? "—" : "Unassigned",
        priority: woDbPriorityToUi(r.priority),
        status: woDbStatusToUi(r.status),
        due: r.scheduled_on ? fmtShortDate(r.scheduled_on) : fmtShortDate(r.created_at.slice(0, 10)),
      }))
      setRecentWorkOrders(recentRows)

      setStats({
        equipmentDueThisMonth,
        overdueService,
        openWorkOrders,
        monthlyRevenueCents,
        expiringWarrantiesCount,
        repeatRepairAlertsCount,
      })
      setRevenueByMonth(revenuePoints)
      setWorkOrdersByStatus(pie)

      const topRepeat = repeatRows[0] ?? null
      setOperationalInsights(
        buildOperationalInsights({
          overdueService,
          equipmentDueThisMonth,
          openWorkOrders,
          expiringWarrantiesCount,
          repeatRepairAlertsCount,
          monthlyRevenueCents,
          topRepeat,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.")
    } finally {
      setLoading(false)
    }
  }, [activeOrg.status, activeOrg.organizationId, activeOrg.organizations.length])

  useEffect(() => {
    void load()
  }, [load])

  return {
    loading,
    error,
    organizationId: activeOrg.organizationId,
    stats,
    recentWorkOrders,
    equipmentDueSoon,
    expiringWarranties,
    repeatRepairs,
    revenueByMonth,
    workOrdersByStatus,
    operationalInsights,
    refetch: load,
  }
}

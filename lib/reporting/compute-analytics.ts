import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import type {
  CustomerRevenueRow,
  EquipmentCategoryRow,
  EquipmentDueMonthPoint,
  MaintenanceComplianceSlice,
  OverdueInvoiceRow,
  RepeatRepairAnalyticRow,
  ReportAnalyticsResponse,
  RevenueMonthPoint,
  TechnicianPerfRow,
  TrendWeekPoint,
  WarrantyExpiryRow,
  WorkOrderTypeSlice,
} from "./types"

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function monthLabelFromKey(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

function woTypeDbToLabel(t: string): string {
  const m: Record<string, string> = {
    repair: "Repair",
    pm: "Preventive Maint.",
    inspection: "Inspection",
    install: "Install",
    emergency: "Emergency",
  }
  return m[t] ?? t
}

function weekMondayStart(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00")
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

function weekLabel(startIso: string): string {
  const d = new Date(startIso + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

type WoRow = {
  id: string
  created_at: string
  updated_at: string
  completed_at: string | null
  status: string
  type: string | null
  customer_id: string
  equipment_id: string | null
  assigned_user_id: string | null
  maintenance_plan_id: string | null
  total_labor_cents: number | null
  total_parts_cents: number | null
}

function applyWorkOrderScope(
  supabase: SupabaseClient,
  organizationId: string,
  params: {
    customerId: string | null
    technicianId: string | null
    equipmentFilterIds: string[] | null
  },
) {
  let q = supabase.from("work_orders").eq("organization_id", organizationId).is("archived_at", null)
  if (params.customerId) q = q.eq("customer_id", params.customerId)
  if (params.technicianId) q = q.eq("assigned_user_id", params.technicianId)
  if (params.equipmentFilterIds) q = q.in("equipment_id", params.equipmentFilterIds)
  return q
}

export async function computeReportAnalytics(
  supabase: SupabaseClient,
  organizationId: string,
  params: {
    from: string
    to: string
    customerId: string | null
    technicianId: string | null
    equipmentCategory: string | null
  },
): Promise<ReportAnalyticsResponse> {
  const { from, to } = params
  const toEnd = `${to}T23:59:59.999Z`
  const fromStart = `${from}T00:00:00.000Z`
  const today = new Date().toISOString().slice(0, 10)

  let equipmentFilterIds: string[] | null = null
  if (params.equipmentCategory && params.equipmentCategory.trim() && params.equipmentCategory !== "all") {
    const { data: eqCat } = await supabase
      .from("equipment")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("category", params.equipmentCategory.trim())

    equipmentFilterIds = (eqCat ?? []).map((r: { id: string }) => r.id)
    if (equipmentFilterIds.length === 0) {
      return emptyResponse(from, to)
    }
  }

  const scope = {
    customerId: params.customerId,
    technicianId: params.technicianId,
    equipmentFilterIds,
  }

  const ninetyLookbackFrom = addDays(to, -90)

  const [
    woCreatedRes,
    woRevRes,
    woCycleRes,
    openPipelineRes,
    woRepeatRes,
    eqWarrantyRes,
    eqDueRes,
    invOverdueRes,
    plansRes,
    pmWoRes,
    custAllRes,
  ] = await Promise.all([
    applyWorkOrderScope(supabase, organizationId, scope)
      .select(
        "id, created_at, updated_at, completed_at, status, type, customer_id, equipment_id, assigned_user_id, maintenance_plan_id, total_labor_cents, total_parts_cents",
      )
      .gte("created_at", fromStart)
      .lte("created_at", toEnd),
    applyWorkOrderScope(supabase, organizationId, scope)
      .select(
        "id, created_at, updated_at, completed_at, status, type, customer_id, equipment_id, assigned_user_id, maintenance_plan_id, total_labor_cents, total_parts_cents",
      )
      .in("status", ["completed", "invoiced"])
      .gte("updated_at", fromStart)
      .lte("updated_at", toEnd),
    applyWorkOrderScope(supabase, organizationId, scope)
      .select("id, created_at, updated_at, completed_at, status")
      .in("status", ["completed", "invoiced", "completed_pending_signature"])
      .gte("updated_at", fromStart)
      .lte("updated_at", toEnd),
    applyWorkOrderScope(supabase, organizationId, scope)
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "scheduled", "in_progress"]),
    applyWorkOrderScope(supabase, organizationId, scope)
      .select("equipment_id, created_at, title")
      .gte("created_at", `${ninetyLookbackFrom}T00:00:00.000Z`)
      .lte("created_at", toEnd)
      .not("equipment_id", "is", null),
    (async () => {
      let q = supabase
        .from("equipment")
        .select("id, name, warranty_expires_at, customer_id, category")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .not("warranty_expires_at", "is", null)
        .gte("warranty_expires_at", from)
        .lte("warranty_expires_at", to)
      if (params.customerId) q = q.eq("customer_id", params.customerId)
      if (equipmentFilterIds) q = q.in("id", equipmentFilterIds)
      return await q
    })(),
    (async () => {
      let q = supabase
        .from("equipment")
        .select("id, next_due_at, category")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .eq("status", "active")
        .not("next_due_at", "is", null)
        .gte("next_due_at", from)
        .lte("next_due_at", to)
      if (params.customerId) q = q.eq("customer_id", params.customerId)
      if (equipmentFilterIds) q = q.in("id", equipmentFilterIds)
      return await q
    })(),
    (async () => {
      let q = supabase
        .from("org_invoices")
        .select("id, invoice_number, title, amount_cents, status, due_date, customer_id")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .in("status", ["sent", "unpaid", "overdue"])
      if (params.customerId) q = q.eq("customer_id", params.customerId)
      const { data, error } = await q
      if (error) return { data: [], error }
      const rows = (data ?? []) as Array<{
        id: string
        invoice_number: string
        title: string
        amount_cents: number
        status: string
        due_date: string | null
        customer_id: string
      }>
      const overdue = rows.filter((r) => {
        if (!r.due_date) return r.status === "overdue"
        return r.due_date < today
      })
      return { data: overdue, error: null }
    })(),
    supabase
      .from("maintenance_plans")
      .select("id, status, next_due_date, customer_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    applyWorkOrderScope(supabase, organizationId, scope)
      .select("id")
      .not("maintenance_plan_id", "is", null)
      .in("status", ["completed", "invoiced"])
      .gte("updated_at", fromStart)
      .lte("updated_at", toEnd),
    supabase.from("customers").select("id, company_name").eq("organization_id", organizationId),
  ])

  const woCreated = (woCreatedRes.data ?? []) as WoRow[]
  const woRev = (woRevRes.data ?? []) as WoRow[]
  const woCycle = (woCycleRes.data ?? []) as Array<{
    id: string
    created_at: string
    updated_at: string
    completed_at: string | null
    status: string
  }>
  const openPipelineCount = openPipelineRes.count ?? 0

  /** Completed / closed jobs with activity in the selected window (updated_at). */
  const workOrdersCompletedCount = woCycle.length

  let periodRevenueCents = 0
  for (const w of woRev) {
    periodRevenueCents += (w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)
  }

  let completionDaysSum = 0
  let completionDaysN = 0
  for (const w of woCycle) {
    const start = new Date(w.created_at).getTime()
    const endIso = w.completed_at ?? w.updated_at
    const end = new Date(endIso).getTime()
    if (end >= start) {
      completionDaysSum += (end - start) / 86400000
      completionDaysN += 1
    }
  }
  const avgCompletionDays = completionDaysN > 0 ? completionDaysSum / completionDaysN : null

  const typeCount = new Map<string, number>()
  for (const w of woCreated) {
    const key = woTypeDbToLabel(w.type ?? "repair")
    typeCount.set(key, (typeCount.get(key) ?? 0) + 1)
  }
  const workOrdersByType: WorkOrderTypeSlice[] = [...typeCount.entries()].map(([type, count]) => ({
    type,
    count,
  }))

  const weekCount = new Map<string, number>()
  for (const w of woCreated) {
    const day = w.created_at.slice(0, 10)
    const wk = weekMondayStart(day)
    weekCount.set(wk, (weekCount.get(wk) ?? 0) + 1)
  }
  const workOrdersByWeek: TrendWeekPoint[] = [...weekCount.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, count]) => ({
      weekStart,
      weekLabel: weekLabel(weekStart),
      count,
    }))

  const monthRev = new Map<string, number>()
  for (const w of woRev) {
    const key = w.updated_at.slice(0, 7)
    const cents = (w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)
    monthRev.set(key, (monthRev.get(key) ?? 0) + cents)
  }
  const revenueByMonth: RevenueMonthPoint[] = [...monthRev.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, revenueCents]) => ({
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      revenueCents,
    }))

  const techMap = new Map<string, { completed: number; cents: number }>()
  for (const w of woRev) {
    const uid = w.assigned_user_id
    if (!uid) continue
    const cur = techMap.get(uid) ?? { completed: 0, cents: 0 }
    cur.completed += 1
    cur.cents += (w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)
    techMap.set(uid, cur)
  }
  const techIds = [...techMap.keys()]
  const techNameMap = new Map<string, string>()
  if (techIds.length > 0) {
    const { data: prof } = await supabase.from("profiles").select("id, full_name, email").in("id", techIds)
    for (const p of (prof ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      techNameMap.set(
        p.id,
        (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Technician",
      )
    }
  }
  const technicians: TechnicianPerfRow[] = techIds
    .map((userId) => {
      const t = techMap.get(userId)!
      return {
        userId,
        name: techNameMap.get(userId) ?? "Technician",
        completedCount: t.completed,
        laborPartsCents: t.cents,
      }
    })
    .sort((a, b) => b.laborPartsCents - a.laborPartsCents)

  const customerMap = new Map(
    ((custAllRes.data ?? []) as Array<{ id: string; company_name: string }>).map((c) => [c.id, c.company_name]),
  )

  const custRev = new Map<string, { cents: number; n: number }>()
  for (const w of woRev) {
    const cur = custRev.get(w.customer_id) ?? { cents: 0, n: 0 }
    cur.cents += (w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)
    cur.n += 1
    custRev.set(w.customer_id, cur)
  }
  const topCustomers: CustomerRevenueRow[] = [...custRev.entries()]
    .map(([customerId, v]) => ({
      customerId,
      name: customerMap.get(customerId) ?? "Customer",
      revenueCents: v.cents,
      workOrderCount: v.n,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 12)

  const woIds = [...woCreated.map((w) => w.equipment_id).filter(Boolean)] as string[]
  const eqMetaMap = new Map<string, string>()
  if (woIds.length > 0) {
    const { data: eqRows } = await supabase
      .from("equipment")
      .select("id, category")
      .eq("organization_id", organizationId)
      .in("id", [...new Set(woIds)])
    for (const e of (eqRows ?? []) as Array<{ id: string; category: string | null }>) {
      eqMetaMap.set(e.id, (e.category ?? "").trim() || "Uncategorized")
    }
  }

  const catAgg = new Map<string, { wo: number; eq: Set<string> }>()
  for (const w of woCreated) {
    if (!w.equipment_id) continue
    const cat = eqMetaMap.get(w.equipment_id) ?? "Uncategorized"
    const cur = catAgg.get(cat) ?? { wo: 0, eq: new Set<string>() }
    cur.wo += 1
    cur.eq.add(w.equipment_id)
    catAgg.set(cat, cur)
  }
  const equipmentByCategory: EquipmentCategoryRow[] = [...catAgg.entries()]
    .map(([category, v]) => ({
      category,
      workOrderCount: v.wo,
      distinctEquipment: v.eq.size,
      touchesPerAsset: v.eq.size > 0 ? v.wo / v.eq.size : null,
    }))
    .sort((a, b) => b.workOrderCount - a.workOrderCount)

  const pmCreated = woCreated.filter((w) => (w.type ?? "") === "pm").length
  const repairCreated = woCreated.filter((w) => (w.type ?? "") === "repair").length
  const otherCreated = woCreated.length - pmCreated - repairCreated
  const maintenanceMix: MaintenanceComplianceSlice[] = [
    { label: "Preventive", count: pmCreated },
    { label: "Repair", count: repairCreated },
    { label: "Other", count: Math.max(0, otherCreated) },
  ]

  const planRows = (plansRes.data ?? []) as Array<{
    id: string
    status: string
    next_due_date: string | null
    customer_id: string
  }>
  let activeMaintenancePlans = 0
  let maintenancePlansOverdue = 0
  let dueOk = 0
  for (const p of planRows) {
    if (p.status !== "active") continue
    if (params.customerId && p.customer_id !== params.customerId) continue
    activeMaintenancePlans += 1
    if (p.next_due_date && p.next_due_date < today) maintenancePlansOverdue += 1
    if (p.next_due_date && p.next_due_date >= today) dueOk += 1
  }
  const maintenanceScheduleHealthPct =
    activeMaintenancePlans > 0 ? Math.round((dueOk / activeMaintenancePlans) * 1000) / 10 : null

  const pmCompleted = (pmWoRes.data ?? []) as Array<{ id: string }>
  const pmWorkOrdersCompletedInPeriod = pmCompleted.length

  const repeatRaw = (woRepeatRes.data ?? []) as Array<{
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

  let repeatRepairs: RepeatRepairAnalyticRow[] = []
  if (repeatIds.length > 0) {
    let eqQ = supabase
      .from("equipment")
      .select("id, name, customer_id")
      .eq("organization_id", organizationId)
      .in("id", repeatIds)
    if (params.customerId) eqQ = eqQ.eq("customer_id", params.customerId)
    if (equipmentFilterIds) eqQ = eqQ.in("id", equipmentFilterIds)
    const { data: eqMeta } = await eqQ
    const eqById = new Map(
      ((eqMeta ?? []) as Array<{ id: string; name: string; customer_id: string }>).map((e) => [e.id, e]),
    )
    const rCust = [...new Set([...eqById.values()].map((e) => e.customer_id))]
    const rMap = new Map<string, string>()
    if (rCust.length > 0) {
      const { data: rc } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .in("id", rCust)
      for (const c of (rc ?? []) as Array<{ id: string; company_name: string }>) {
        rMap.set(c.id, c.company_name)
      }
    }
    repeatRepairs = repeatIds
      .map((eqId) => {
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
          issue: "Multiple work orders on this asset in the trailing 90-day window.",
        }
      })
      .sort((a, b) => b.repairs - a.repairs)
  }

  const wRows = (eqWarrantyRes.data ?? []) as Array<{
    id: string
    name: string
    warranty_expires_at: string
    customer_id: string
    category: string | null
  }>
  const wCustIds = [...new Set(wRows.map((w) => w.customer_id))]
  const wCustomerMap = new Map<string, string>()
  if (wCustIds.length > 0) {
    const { data: wc } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", wCustIds)
    for (const c of (wc ?? []) as Array<{ id: string; company_name: string }>) {
      wCustomerMap.set(c.id, c.company_name)
    }
  }
  const warrantiesExpiring: WarrantyExpiryRow[] = wRows.map((w) => {
    const exp = w.warranty_expires_at
    const daysLeft = Math.ceil(
      (new Date(exp + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000,
    )
    return {
      equipmentId: w.id,
      equipmentName: getEquipmentDisplayPrimary({
        id: w.id,
        name: w.name,
        equipment_code: null,
        serial_number: null,
        category: w.category,
      }),
      customerName: wCustomerMap.get(w.customer_id) ?? "Customer",
      expires: fmtShortDate(exp),
      daysLeft,
    }
  })

  const dueRows = (eqDueRes.data ?? []) as Array<{ id: string; next_due_at: string }>
  const dueMonth = new Map<string, number>()
  for (const e of dueRows) {
    const key = e.next_due_at.slice(0, 7)
    dueMonth.set(key, (dueMonth.get(key) ?? 0) + 1)
  }
  const equipmentPmDueByMonth: EquipmentDueMonthPoint[] = [...dueMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, count]) => ({ monthLabel: monthLabelFromKey(ym), count }))

  const overdueRows = (invOverdueRes.data ?? []) as Array<{
    id: string
    invoice_number: string
    title: string
    amount_cents: number
    status: string
    due_date: string | null
    customer_id: string
  }>
  let overdueAmount = 0
  const overdueInvoices: OverdueInvoiceRow[] = overdueRows.map((r) => {
    overdueAmount += r.amount_cents ?? 0
    const due = r.due_date
    const daysOverdue = due
      ? Math.max(
          0,
          Math.ceil(
            (new Date(today + "T12:00:00").getTime() - new Date(due + "T12:00:00").getTime()) / 86400000,
          ),
        )
      : 0
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: customerMap.get(r.customer_id) ?? "Customer",
      amountCents: r.amount_cents ?? 0,
      dueDate: r.due_date,
      status: r.status,
      daysOverdue,
    }
  })

  const summary = {
    periodRevenueCents,
    workOrdersCreated: woCreated.length,
    workOrdersCompleted: workOrdersCompletedCount,
    workOrdersInProgress: openPipelineCount,
    avgCompletionDays,
    overdueInvoicesCount: overdueInvoices.length,
    overdueInvoicesAmountCents: overdueAmount,
    activeMaintenancePlans,
    maintenancePlansOverdue,
    pmWorkOrdersCompletedInPeriod,
    maintenanceScheduleHealthPct,
    warrantyExpiringInPeriod: warrantiesExpiring.length,
    repeatRepairEquipmentCount: repeatRepairs.length,
  }

  return {
    from,
    to,
    summary,
    revenueByMonth,
    workOrdersByWeek,
    workOrdersByType,
    technicians,
    topCustomers,
    equipmentByCategory,
    maintenanceMix,
    warrantiesExpiring,
    overdueInvoices,
    repeatRepairs,
    equipmentPmDueByMonth,
  }
}

function emptyResponse(from: string, to: string): ReportAnalyticsResponse {
  const emptySummary = {
    periodRevenueCents: 0,
    workOrdersCreated: 0,
    workOrdersCompleted: 0,
    workOrdersInProgress: 0,
    avgCompletionDays: null,
    overdueInvoicesCount: 0,
    overdueInvoicesAmountCents: 0,
    activeMaintenancePlans: 0,
    maintenancePlansOverdue: 0,
    pmWorkOrdersCompletedInPeriod: 0,
    maintenanceScheduleHealthPct: null,
    warrantyExpiringInPeriod: 0,
    repeatRepairEquipmentCount: 0,
  }
  return {
    from,
    to,
    summary: emptySummary,
    revenueByMonth: [],
    workOrdersByWeek: [],
    workOrdersByType: [],
    technicians: [],
    topCustomers: [],
    equipmentByCategory: [],
    maintenanceMix: [],
    warrantiesExpiring: [],
    overdueInvoices: [],
    repeatRepairs: [],
    equipmentPmDueByMonth: [],
  }
}

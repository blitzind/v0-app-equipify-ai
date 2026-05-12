import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"
import type {
  CustomerRevenueRow,
  EquipmentCategoryRow,
  EquipmentDueMonthPoint,
  EquipmentTypePerformanceRow,
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
import {
  INVOICE_AGING_QUERY_DB,
  REPEAT_REPAIR_LOOKBACK_DAYS,
  WORK_ORDER_ANALYTICS_EXTENDED_COMPLETION_DB,
  WORK_ORDER_ANALYTICS_PM_LINKED_DB,
  WORK_ORDER_ANALYTICS_REVENUE_PERIOD_DB,
  WORK_ORDER_OPEN_PIPELINE_DB,
} from "@/lib/kpi/definitions"

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

type EquipmentReportRow = {
  id: string
  customer_id: string
  category: string | null
  subcategory?: string | null
  next_due_at: string | null
  next_calibration_due_at?: string | null
  last_service_at: string | null
}

function resolveEquipmentTypeLabel(row: Pick<EquipmentReportRow, "category" | "subcategory">): string {
  const category = row.category?.trim()
  if (category) return category
  const subcategory = row.subcategory?.trim()
  if (subcategory) return subcategory
  return "Uncategorized"
}

/** Default columns for analytics work-order pulls (must be listed before `.eq` in Supabase v2). */
const WORK_ORDER_ANALYTICS_COLUMNS =
  "id, created_at, updated_at, completed_at, status, type, customer_id, equipment_id, assigned_user_id, maintenance_plan_id, total_labor_cents, total_parts_cents"

function applyWorkOrderScope(
  supabase: SupabaseClient,
  organizationId: string,
  params: {
    customerId: string | null
    technicianId: string | null
    equipmentFilterIds: string[] | null
  },
  select: string,
  selectOptions?: { count: "exact" | "planned" | "estimated"; head?: boolean },
) {
  let q = supabase
    .from("work_orders")
    .select(select, selectOptions)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
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
    workOrderStatus?: string | null
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
      .select("id, category, subcategory")
      .eq("organization_id", organizationId)
      .is("archived_at", null)

    const wanted = params.equipmentCategory.trim()
    equipmentFilterIds = ((eqCat ?? []) as Array<{ id: string; category: string | null; subcategory: string | null }>)
      .filter((r) => resolveEquipmentTypeLabel(r).toLowerCase() === wanted.toLowerCase())
      .map((r) => r.id)
    if (equipmentFilterIds.length === 0) {
      return emptyResponse(from, to)
    }
  }

  const scope = {
    customerId: params.customerId,
    technicianId: params.technicianId,
    equipmentFilterIds,
  }
  const statusFilter = params.workOrderStatus && params.workOrderStatus !== "all" ? params.workOrderStatus : null

  const ninetyLookbackFrom = addDays(to, -REPEAT_REPAIR_LOOKBACK_DAYS)

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
    (async () => {
      let q = applyWorkOrderScope(supabase, organizationId, scope, WORK_ORDER_ANALYTICS_COLUMNS)
      if (statusFilter) q = q.eq("status", statusFilter)
      return await q.gte("created_at", fromStart).lte("created_at", toEnd)
    })(),
    applyWorkOrderScope(supabase, organizationId, scope, WORK_ORDER_ANALYTICS_COLUMNS)
      .in("status", [...WORK_ORDER_ANALYTICS_REVENUE_PERIOD_DB])
      .gte("updated_at", fromStart)
      .lte("updated_at", toEnd),
    applyWorkOrderScope(supabase, organizationId, scope, "id, created_at, updated_at, completed_at, status")
      .in("status", [...WORK_ORDER_ANALYTICS_EXTENDED_COMPLETION_DB])
      .gte("updated_at", fromStart)
      .lte("updated_at", toEnd),
    applyWorkOrderScope(supabase, organizationId, scope, "*", { count: "exact", head: true }).in(
      "status",
      [...WORK_ORDER_OPEN_PIPELINE_DB],
    ),
    applyWorkOrderScope(supabase, organizationId, scope, "equipment_id, created_at, title")
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
        .in("status", [...INVOICE_AGING_QUERY_DB])
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
    applyWorkOrderScope(supabase, organizationId, scope, "id")
      .not("maintenance_plan_id", "is", null)
      .in("status", [...WORK_ORDER_ANALYTICS_PM_LINKED_DB])
      .gte("updated_at", fromStart)
      .lte("updated_at", toEnd),
    supabase.from("customers").select("id, company_name").eq("organization_id", organizationId),
  ])

  let woCreated = (woCreatedRes.data ?? []) as WoRow[]
  const woRev = (woRevRes.data ?? []) as WoRow[]
  const woCycle = (woCycleRes.data ?? []) as Array<{
    id: string
    created_at: string
    updated_at: string
    completed_at: string | null
    status: string
  }>
  const openPipelineCount = openPipelineRes.count ?? 0

  if (equipmentFilterIds?.length) {
    const { data: joinScopeRows } = await supabase
      .from("work_order_equipment")
      .select("work_order_id")
      .eq("organization_id", organizationId)
      .in("equipment_id", equipmentFilterIds)
    const joinedWoIds = [
      ...new Set(((joinScopeRows ?? []) as Array<{ work_order_id: string }>).map((row) => row.work_order_id)),
    ].filter((workOrderId) => !woCreated.some((wo) => wo.id === workOrderId))
    if (joinedWoIds.length > 0) {
      let extraWoQuery = supabase
        .from("work_orders")
        .select(
          "id, created_at, updated_at, completed_at, status, type, customer_id, equipment_id, assigned_user_id, maintenance_plan_id, total_labor_cents, total_parts_cents",
        )
        .eq("organization_id", organizationId)
        .in("id", joinedWoIds)
        .is("archived_at", null)
        .gte("created_at", fromStart)
        .lte("created_at", toEnd)
      if (params.customerId) extraWoQuery = extraWoQuery.eq("customer_id", params.customerId)
      if (params.technicianId) extraWoQuery = extraWoQuery.eq("assigned_user_id", params.technicianId)
      if (statusFilter) extraWoQuery = extraWoQuery.eq("status", statusFilter)
      const { data: extraWoRows } = await extraWoQuery
      woCreated = [...woCreated, ...((extraWoRows ?? []) as WoRow[])]
    }
  }

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

  let equipmentScopeQ = supabase
    .from("equipment")
    .select("id, customer_id, category, subcategory, next_due_at, next_calibration_due_at, last_service_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
  if (params.customerId) equipmentScopeQ = equipmentScopeQ.eq("customer_id", params.customerId)
  if (equipmentFilterIds) equipmentScopeQ = equipmentScopeQ.in("id", equipmentFilterIds)
  const { data: equipmentScopeData } = await equipmentScopeQ
  const equipmentRows = (equipmentScopeData ?? []) as EquipmentReportRow[]
  const equipmentById = new Map(equipmentRows.map((row) => [row.id, row]))
  const equipmentTypeById = new Map(equipmentRows.map((row) => [row.id, resolveEquipmentTypeLabel(row)]))

  type TypeAgg = {
    equipmentIds: Set<string>
    workOrderIds: Set<string>
    completedWorkOrderIds: Set<string>
    openWorkOrderIds: Set<string>
    calibrationIds: Set<string>
    invoiceIds: Set<string>
    linkedRevenueCents: number
    lastServiceDate: string | null
    nextDueEquipmentIds: Set<string>
    customers: Map<string, { equipmentIds: Set<string>; workOrderIds: Set<string>; revenueCents: number }>
  }
  const typeAgg = new Map<string, TypeAgg>()
  const ensureTypeAgg = (equipmentType: string): TypeAgg => {
    const existing = typeAgg.get(equipmentType)
    if (existing) return existing
    const next: TypeAgg = {
      equipmentIds: new Set(),
      workOrderIds: new Set(),
      completedWorkOrderIds: new Set(),
      openWorkOrderIds: new Set(),
      calibrationIds: new Set(),
      invoiceIds: new Set(),
      linkedRevenueCents: 0,
      lastServiceDate: null,
      nextDueEquipmentIds: new Set(),
      customers: new Map(),
    }
    typeAgg.set(equipmentType, next)
    return next
  }
  const bumpCustomerForType = (equipmentType: string, customerId: string, patch: { equipmentId?: string; workOrderId?: string; revenueCents?: number }) => {
    const agg = ensureTypeAgg(equipmentType)
    const cur = agg.customers.get(customerId) ?? {
      equipmentIds: new Set<string>(),
      workOrderIds: new Set<string>(),
      revenueCents: 0,
    }
    if (patch.equipmentId) cur.equipmentIds.add(patch.equipmentId)
    if (patch.workOrderId) cur.workOrderIds.add(patch.workOrderId)
    cur.revenueCents += patch.revenueCents ?? 0
    agg.customers.set(customerId, cur)
  }

  for (const eq of equipmentRows) {
    const equipmentType = resolveEquipmentTypeLabel(eq)
    const agg = ensureTypeAgg(equipmentType)
    agg.equipmentIds.add(eq.id)
    if (eq.last_service_at && (!agg.lastServiceDate || eq.last_service_at > agg.lastServiceDate)) {
      agg.lastServiceDate = eq.last_service_at
    }
    const nextDates = [eq.next_due_at, eq.next_calibration_due_at].filter((date): date is string => Boolean(date))
    if (nextDates.some((date) => date >= from && date <= to)) agg.nextDueEquipmentIds.add(eq.id)
    bumpCustomerForType(equipmentType, eq.customer_id, { equipmentId: eq.id })
  }

  const woCreatedIds = woCreated.map((w) => w.id)
  const assetsByWorkOrder = new Map<string, Set<string>>()
  for (const wo of woCreated) {
    if (wo.equipment_id) assetsByWorkOrder.set(wo.id, new Set([wo.equipment_id]))
  }
  if (woCreatedIds.length > 0) {
    const { data: joinRows } = await supabase
      .from("work_order_equipment")
      .select("work_order_id, equipment_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", woCreatedIds)
    for (const row of (joinRows ?? []) as Array<{ work_order_id: string; equipment_id: string }>) {
      const set = assetsByWorkOrder.get(row.work_order_id) ?? new Set<string>()
      set.add(row.equipment_id)
      assetsByWorkOrder.set(row.work_order_id, set)
    }
  }

  const openStatuses = new Set(WORK_ORDER_OPEN_PIPELINE_DB)
  const completedStatuses = new Set(WORK_ORDER_ANALYTICS_EXTENDED_COMPLETION_DB)
  for (const wo of woCreated) {
    const equipmentTypesForWo = new Set<string>()
    for (const equipmentId of assetsByWorkOrder.get(wo.id) ?? []) {
      const equipmentType = equipmentTypeById.get(equipmentId)
      const eq = equipmentById.get(equipmentId)
      if (!equipmentType || !eq) continue
      equipmentTypesForWo.add(equipmentType)
      bumpCustomerForType(equipmentType, eq.customer_id, { equipmentId, workOrderId: wo.id })
    }
    for (const equipmentType of equipmentTypesForWo) {
      const agg = ensureTypeAgg(equipmentType)
      agg.workOrderIds.add(wo.id)
      if (completedStatuses.has(wo.status)) agg.completedWorkOrderIds.add(wo.id)
      if (openStatuses.has(wo.status)) agg.openWorkOrderIds.add(wo.id)
      if (wo.completed_at && (!agg.lastServiceDate || wo.completed_at > agg.lastServiceDate)) {
        agg.lastServiceDate = wo.completed_at
      }
    }
  }

  if (equipmentRows.length > 0) {
    const equipmentIds = equipmentRows.map((eq) => eq.id)
    const { data: calibrationRows } = await supabase
      .from("calibration_records")
      .select("id, equipment_id, created_at")
      .eq("organization_id", organizationId)
      .in("equipment_id", equipmentIds)
      .gte("created_at", fromStart)
      .lte("created_at", toEnd)
    for (const row of (calibrationRows ?? []) as Array<{ id: string; equipment_id: string; created_at: string }>) {
      const equipmentType = equipmentTypeById.get(row.equipment_id)
      if (!equipmentType) continue
      const agg = ensureTypeAgg(equipmentType)
      agg.calibrationIds.add(row.id)
      if (!agg.lastServiceDate || row.created_at > agg.lastServiceDate) agg.lastServiceDate = row.created_at
    }
  }

  const { data: invoiceRowsForTypes } = await supabase
    .from("org_invoices")
    .select("id, amount_cents, issued_at, equipment_id, work_order_id, customer_id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .gte("issued_at", from)
    .lte("issued_at", to)

  const invoicesForTypes = (invoiceRowsForTypes ?? []) as Array<{
    id: string
    amount_cents: number | null
    issued_at: string | null
    equipment_id: string | null
    work_order_id: string | null
    customer_id: string
  }>
  const invoiceIds = invoicesForTypes.map((invoice) => invoice.id)
  const linkedWorkOrderIdsByInvoice = new Map<string, Set<string>>()
  for (const invoice of invoicesForTypes) {
    if (invoice.work_order_id) linkedWorkOrderIdsByInvoice.set(invoice.id, new Set([invoice.work_order_id]))
  }
  if (invoiceIds.length > 0) {
    const { data: invoiceLinks } = await supabase
      .from("invoice_work_order_links")
      .select("invoice_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("invoice_id", invoiceIds)
    for (const link of (invoiceLinks ?? []) as Array<{ invoice_id: string; work_order_id: string }>) {
      const set = linkedWorkOrderIdsByInvoice.get(link.invoice_id) ?? new Set<string>()
      set.add(link.work_order_id)
      linkedWorkOrderIdsByInvoice.set(link.invoice_id, set)
    }
  }

  const invoiceWorkOrderIds = [...new Set([...linkedWorkOrderIdsByInvoice.values()].flatMap((set) => [...set]))]
  const invoiceWoAssets = new Map<string, Set<string>>()
  if (invoiceWorkOrderIds.length > 0) {
    const [{ data: invoiceWoRows }, { data: invoiceWoJoinRows }] = await Promise.all([
      supabase
        .from("work_orders")
        .select("id, equipment_id, customer_id, assigned_user_id")
        .eq("organization_id", organizationId)
        .in("id", invoiceWorkOrderIds)
        .is("archived_at", null),
      supabase
        .from("work_order_equipment")
        .select("work_order_id, equipment_id")
        .eq("organization_id", organizationId)
        .in("work_order_id", invoiceWorkOrderIds),
    ])
    for (const wo of (invoiceWoRows ?? []) as Array<{ id: string; equipment_id: string | null; customer_id: string; assigned_user_id: string | null }>) {
      if (params.customerId && wo.customer_id !== params.customerId) continue
      if (params.technicianId && wo.assigned_user_id !== params.technicianId) continue
      if (wo.equipment_id) invoiceWoAssets.set(wo.id, new Set([wo.equipment_id]))
    }
    for (const link of (invoiceWoJoinRows ?? []) as Array<{ work_order_id: string; equipment_id: string }>) {
      const set = invoiceWoAssets.get(link.work_order_id) ?? new Set<string>()
      set.add(link.equipment_id)
      invoiceWoAssets.set(link.work_order_id, set)
    }
  }

  for (const invoice of invoicesForTypes) {
    if (params.customerId && invoice.customer_id !== params.customerId) continue
    const invoiceEquipmentTypes = new Set<string>()
    const invoiceEquipmentCustomers = new Map<string, string>()
    if (invoice.equipment_id && equipmentTypeById.has(invoice.equipment_id)) {
      invoiceEquipmentTypes.add(equipmentTypeById.get(invoice.equipment_id)!)
      const eq = equipmentById.get(invoice.equipment_id)
      if (eq) invoiceEquipmentCustomers.set(equipmentTypeById.get(invoice.equipment_id)!, eq.customer_id)
    } else {
      for (const workOrderId of linkedWorkOrderIdsByInvoice.get(invoice.id) ?? []) {
        for (const equipmentId of invoiceWoAssets.get(workOrderId) ?? []) {
          const equipmentType = equipmentTypeById.get(equipmentId)
          const eq = equipmentById.get(equipmentId)
          if (!equipmentType || !eq) continue
          invoiceEquipmentTypes.add(equipmentType)
          invoiceEquipmentCustomers.set(equipmentType, eq.customer_id)
        }
      }
    }
    if (invoiceEquipmentTypes.size === 0) continue
    const allocatedCents = Math.round((invoice.amount_cents ?? 0) / invoiceEquipmentTypes.size)
    for (const equipmentType of invoiceEquipmentTypes) {
      const agg = ensureTypeAgg(equipmentType)
      agg.invoiceIds.add(invoice.id)
      agg.linkedRevenueCents += allocatedCents
      const customerForType = invoiceEquipmentCustomers.get(equipmentType) ?? invoice.customer_id
      bumpCustomerForType(equipmentType, customerForType, { revenueCents: allocatedCents })
    }
  }

  const equipmentTypePerformance: EquipmentTypePerformanceRow[] = [...typeAgg.entries()]
    .map(([equipmentType, agg]) => ({
      equipmentType,
      equipmentCount: agg.equipmentIds.size,
      workOrderCount: agg.workOrderIds.size,
      completedWorkOrderCount: agg.completedWorkOrderIds.size,
      openWorkOrderCount: agg.openWorkOrderIds.size,
      calibrationCount: agg.calibrationIds.size,
      invoiceCount: agg.invoiceIds.size,
      linkedRevenueCents: agg.linkedRevenueCents,
      unlinkedRevenueCents: 0,
      averageRevenuePerWorkOrderCents:
        agg.workOrderIds.size > 0 ? Math.round(agg.linkedRevenueCents / agg.workOrderIds.size) : null,
      lastServiceDate: agg.lastServiceDate,
      nextDueCount: agg.nextDueEquipmentIds.size,
      topCustomers: [...agg.customers.entries()]
        .map(([customerId, c]) => ({
          customerId,
          customerName: customerMap.get(customerId) ?? "Customer",
          equipmentCount: c.equipmentIds.size,
          workOrderCount: c.workOrderIds.size,
          revenueCents: c.revenueCents,
        }))
        .sort((a, b) => b.revenueCents - a.revenueCents || b.workOrderCount - a.workOrderCount || b.equipmentCount - a.equipmentCount)
        .slice(0, 5),
    }))
    .sort((a, b) => b.linkedRevenueCents - a.linkedRevenueCents || b.workOrderCount - a.workOrderCount || b.equipmentCount - a.equipmentCount)

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
    equipmentTypePerformance,
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
    equipmentTypePerformance: [],
    maintenanceMix: [],
    warrantiesExpiring: [],
    overdueInvoices: [],
    repeatRepairs: [],
    equipmentPmDueByMonth: [],
  }
}

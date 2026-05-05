import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getEquipmentDisplayPrimary } from "@/lib/equipment/display"

/** Compact org snapshot for AI insights (no PII-heavy dumps). */
export type OrgInsightsContext = {
  generatedAtIso: string
  customers: { activeCount: number }
  equipment: {
    activeCount: number
    overdueNextServiceCount: number
    dueThisCalendarMonthCount: number
    warrantyExpiringNext30DaysCount: number
  }
  workOrders: {
    totalNonArchived: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
    openPipelineCount: number
    overdueScheduledCount: number
  }
  maintenancePlans: {
    activeCount: number
    dueOrOverdueCount: number
  }
  repeatRepairs90d: {
    distinctEquipmentCount: number
    examples: Array<{ equipmentLabel: string; customerName: string; workOrderCount: number }>
  }
  revenue: {
    monthToDateCompletedInvoicedCents: number
    currency: "USD"
  }
  documents: {
    quotesTotal: number
    invoicesTotal: number
    purchaseOrdersTotal: number
  }
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

/**
 * Aggregates org-scoped metrics for the insights LLM. Uses the caller’s Supabase client
 * (user session + RLS); `organizationId` must already be authorized.
 */
export async function gatherOrgInsightsContext(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrgInsightsContext> {
  const { monthStart, monthEnd, today } = boundsThisMonth()
  const monthPrefix = today.slice(0, 7)
  const warrantyBefore = addDays(today, 30)
  const ninetyDaysAgo = addDays(today, -90)

  const [
    customersCountRes,
    equipmentActiveRes,
    overdueServiceRes,
    dueMonthRes,
    warranty30Res,
    woListRes,
    openPipelineRes,
    overdueWoRes,
    plansActiveRes,
    plansDueRes,
    repeatWoRes,
    revenueRes,
    quotesCountRes,
    invoicesCountRes,
    poCountRes,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false),
    supabase
      .from("equipment")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("status", "active"),
    supabase
      .from("equipment")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("status", "active")
      .not("next_due_at", "is", null)
      .lt("next_due_at", today),
    supabase
      .from("equipment")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .eq("status", "active")
      .not("next_due_at", "is", null)
      .gte("next_due_at", monthStart)
      .lte("next_due_at", monthEnd),
    supabase
      .from("equipment")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .not("warranty_expires_at", "is", null)
      .gte("warranty_expires_at", today)
      .lte("warranty_expires_at", warrantyBefore),
    supabase
      .from("work_orders")
      .select("status, priority")
      .eq("organization_id", organizationId)
      .eq("is_archived", false),
    supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .in("status", ["open", "scheduled", "in_progress"]),
    supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .not("scheduled_on", "is", null)
      .lt("scheduled_on", today)
      .in("status", ["open", "scheduled", "in_progress", "completed_pending_signature"]),
    supabase
      .from("maintenance_plans")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false),
    supabase
      .from("maintenance_plans")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .not("next_due_date", "is", null)
      .lte("next_due_date", today),
    supabase
      .from("work_orders")
      .select("equipment_id, created_at")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .gte("created_at", `${ninetyDaysAgo}T00:00:00.000Z`)
      .not("equipment_id", "is", null),
    supabase
      .from("work_orders")
      .select("total_labor_cents, total_parts_cents, updated_at, status")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .in("status", ["completed", "invoiced"])
      .gte("updated_at", `${monthStart}T00:00:00.000Z`),
    supabase
      .from("org_quotes")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("org_invoices")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("org_purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false),
  ])

  const woRows = (woListRes.data ?? []) as Array<{ status: string; priority: string }>
  const byStatus: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  for (const r of woRows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1
  }

  let monthlyRevenueCents = 0
  const revRows = (revenueRes.data ?? []) as Array<{
    total_labor_cents: number
    total_parts_cents: number
    updated_at: string
  }>
  for (const r of revRows) {
    if (r.updated_at.slice(0, 7) === monthPrefix) {
      monthlyRevenueCents += (r.total_labor_cents ?? 0) + (r.total_parts_cents ?? 0)
    }
  }

  const repeatRaw = (repeatWoRes.data ?? []) as Array<{ equipment_id: string }>
  const byEq = new Map<string, number>()
  for (const r of repeatRaw) {
    byEq.set(r.equipment_id, (byEq.get(r.equipment_id) ?? 0) + 1)
  }
  const repeatCandidates = [...byEq.entries()].filter(([, n]) => n >= 2)
  const distinctRepeatEquipmentCount = repeatCandidates.length
  const repeatIds = repeatCandidates.sort((a, b) => b[1] - a[1]).slice(0, 8)

  let examples: Array<{ equipmentLabel: string; customerName: string; workOrderCount: number }> = []
  if (repeatIds.length > 0) {
    const ids = repeatIds.map(([id]) => id)
    const { data: eqMeta } = await supabase
      .from("equipment")
      .select("id, name, equipment_code, serial_number, category, customer_id")
      .eq("organization_id", organizationId)
      .in("id", ids)
    const eqById = new Map(
      ((eqMeta ?? []) as Array<{
        id: string
        name: string
        equipment_code: string | null
        serial_number: string | null
        category: string | null
        customer_id: string
      }>).map((e) => [e.id, e]),
    )
    const custIds = [...new Set([...eqById.values()].map((e) => e.customer_id))]
    const cm = new Map<string, string>()
    if (custIds.length > 0) {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .in("id", custIds)
      ;((custs as Array<{ id: string; company_name: string }> | null) ?? []).forEach((c) => {
        cm.set(c.id, c.company_name)
      })
    }
    examples = repeatIds.map(([eqId, count]) => {
      const e = eqById.get(eqId)
      const label = e
        ? getEquipmentDisplayPrimary({
            id: eqId,
            name: e.name,
            equipment_code: e.equipment_code,
            serial_number: e.serial_number,
            category: e.category,
          })
        : "Equipment"
      return {
        equipmentLabel: label,
        customerName: e ? cm.get(e.customer_id) ?? "Customer" : "Customer",
        workOrderCount: count,
      }
    })
  }

  // Quotes / invoices errors — table may not exist in older DB; treat as 0
  const quotesTotal = quotesCountRes.error ? 0 : quotesCountRes.count ?? 0
  const invoicesTotal = invoicesCountRes.error ? 0 : invoicesCountRes.count ?? 0
  const purchaseOrdersTotal = poCountRes.error ? 0 : poCountRes.count ?? 0

  return {
    generatedAtIso: new Date().toISOString(),
    customers: { activeCount: customersCountRes.count ?? 0 },
    equipment: {
      activeCount: equipmentActiveRes.count ?? 0,
      overdueNextServiceCount: overdueServiceRes.count ?? 0,
      dueThisCalendarMonthCount: dueMonthRes.count ?? 0,
      warrantyExpiringNext30DaysCount: warranty30Res.count ?? 0,
    },
    workOrders: {
      totalNonArchived: woRows.length,
      byStatus,
      byPriority,
      openPipelineCount: openPipelineRes.count ?? 0,
      overdueScheduledCount: overdueWoRes.count ?? 0,
    },
    maintenancePlans: {
      activeCount: plansActiveRes.count ?? 0,
      dueOrOverdueCount: plansDueRes.count ?? 0,
    },
    repeatRepairs90d: {
      distinctEquipmentCount: distinctRepeatEquipmentCount,
      examples,
    },
    revenue: {
      monthToDateCompletedInvoicedCents: monthlyRevenueCents,
      currency: "USD",
    },
    documents: {
      quotesTotal,
      invoicesTotal,
      purchaseOrdersTotal,
    },
  }
}

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeOpsFlags,
  deriveOperationalBadges,
  type DispatchFilterId,
  type DispatchOpsContext,
  type DispatchOpsInput,
  type OpsFlags,
} from "@/lib/dispatch/operational-badges"
import { fetchWorkOrderInvoiceOpsBatch } from "@/lib/dispatch/work-order-invoice-agg"
import { resolveEffectiveCertificateReleaseMode } from "@/lib/portal/certificate-release"
import { allLinkedInvoicesPaid } from "@/lib/portal/work-order-invoices"
import { timeToSlotIndex } from "@/lib/dispatch/board-utils"
import type { DispatchTech, DispatchWo } from "@/components/dispatch/dispatch-board"

export type DispatchWoRow = {
  id: string
  work_order_number?: number | null
  title: string
  status: string
  scheduled_on: string | null
  scheduled_time: string | null
  assigned_user_id: string | null
  customer_id: string
  equipment_id: string
  priority: string | null
  type: string
  billing_state: string | null
  maintenance_plan_id: string | null
  calibration_template_id: string | null
  billable_to_customer: boolean | null
  warranty_review_required: boolean | null
  total_parts_cents: number | null
  created_at: string
  completed_at: string | null
}

function ymdFromDateCol(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  return s.length >= 10 ? s.slice(0, 10) : s
}

function minYmd(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

export async function enrichDispatchWorkOrders(
  supabase: SupabaseClient,
  organizationId: string,
  rows: DispatchWoRow[],
  techByUserId: Map<string, DispatchTech>,
  customerNameById: Map<string, string>,
): Promise<DispatchWo[]> {
  const woIds = rows.map((r) => r.id)
  if (woIds.length === 0) return []

  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))]

  const [{ data: woeRows }, { data: calRows }, invOps, orgRes, custRes] = await Promise.all([
    woIds.length
      ? supabase
          .from("work_order_equipment")
          .select("work_order_id, equipment_id")
          .eq("organization_id", organizationId)
          .in("work_order_id", woIds)
      : Promise.resolve({ data: [] as { work_order_id: string; equipment_id: string }[] }),
    woIds.length
      ? supabase.from("calibration_records").select("work_order_id").eq("organization_id", organizationId).in("work_order_id", woIds)
      : Promise.resolve({ data: [] as { work_order_id: string }[] }),
    fetchWorkOrderInvoiceOpsBatch(supabase, organizationId, woIds),
    supabase.from("organizations").select("portal_certificate_release_mode").eq("id", organizationId).maybeSingle(),
    custIds.length
      ? supabase
          .from("customers")
          .select("id, portal_certificate_release_mode")
          .eq("organization_id", organizationId)
          .in("id", custIds)
      : Promise.resolve({ data: [] as { id: string; portal_certificate_release_mode: string | null }[] }),
  ])

  const orgCertMode =
    (orgRes.data as { portal_certificate_release_mode?: string | null } | null)?.portal_certificate_release_mode ?? null
  const customerCertMap = new Map<string, string | null>()
  for (const c of (custRes.data ?? []) as { id: string; portal_certificate_release_mode: string | null }[]) {
    customerCertMap.set(c.id, c.portal_certificate_release_mode)
  }

  const equipmentIdsByWo = new Map<string, string[]>()
  const rowList = (woeRows ?? []) as { work_order_id: string; equipment_id: string }[]
  for (const r of rowList) {
    const list = equipmentIdsByWo.get(r.work_order_id) ?? []
    list.push(r.equipment_id)
    equipmentIdsByWo.set(r.work_order_id, list)
  }

  const calWoIds = new Set((calRows ?? []).map((c) => c.work_order_id))

  const allEqIds = new Set<string>()
  for (const wo of rows) {
    const fromJoin = equipmentIdsByWo.get(wo.id)
    if (fromJoin && fromJoin.length > 0) {
      for (const eid of fromJoin) allEqIds.add(eid)
    } else if (wo.equipment_id) {
      allEqIds.add(wo.equipment_id)
    }
  }

  let eqMeta = new Map<
    string,
    { next_due: string | null; next_cal: string | null; category: string | null; location_label: string | null }
  >()

  if (allEqIds.size > 0) {
    const { data: eqRows } = await supabase
      .from("equipment")
      .select("id, next_due_at, next_calibration_due_at, category, location_label")
      .eq("organization_id", organizationId)
      .in("id", [...allEqIds])

    eqMeta = new Map(
      ((eqRows ?? []) as Array<{
        id: string
        next_due_at: string | null
        next_calibration_due_at: string | null
        category: string | null
        location_label: string | null
      }>).map((e) => [
        e.id,
        {
          next_due: ymdFromDateCol(e.next_due_at),
          next_cal: ymdFromDateCol(e.next_calibration_due_at),
          category: e.category?.trim() || null,
          location_label: e.location_label?.trim() || null,
        },
      ]),
    )
  }

  function ctxForWo(wo: DispatchWoRow): DispatchOpsContext {
    const eqIds =
      equipmentIdsByWo.get(wo.id)?.length ? equipmentIdsByWo.get(wo.id)! : wo.equipment_id ? [wo.equipment_id] : []

    let equipmentNextServiceDueYmd: string | null = null
    let equipmentNextCalibrationYmd: string | null = null
    let equipmentCategory: string | null = null

    const uniq = [...new Set(eqIds)]
    if (wo.equipment_id) {
      equipmentCategory = eqMeta.get(wo.equipment_id)?.category ?? null
    }
    for (const eid of uniq) {
      const m = eqMeta.get(eid)
      if (!m) continue
      equipmentNextServiceDueYmd = minYmd(equipmentNextServiceDueYmd, m.next_due)
      equipmentNextCalibrationYmd = minYmd(equipmentNextCalibrationYmd, m.next_cal)
      if (!equipmentCategory && m.category) equipmentCategory = m.category
    }

    const equipmentCount = uniq.length > 0 ? uniq.length : wo.equipment_id ? 1 : 0

    const linked = invOps.linkedByWo.get(wo.id) ?? []
    const overrides = linked.map((i) => i.portal_certificate_release_override)
    const eff = resolveEffectiveCertificateReleaseMode({
      organizationMode: orgCertMode,
      customerMode: customerCertMap.get(wo.customer_id) ?? null,
      invoiceOverrides: overrides,
    })
    const certPaymentBlocked =
      Boolean(wo.calibration_template_id) &&
      eff === "release_on_payment" &&
      linked.length > 0 &&
      !allLinkedInvoicesPaid(linked)

    return {
      equipmentNextServiceDueYmd,
      equipmentNextCalibrationYmd,
      hasCalibrationRecord: calWoIds.has(wo.id),
      equipmentCount,
      equipmentCategory,
      invoiceAgg: invOps.aggregates.get(wo.id) ?? null,
      linkedInvoiceCount: linked.length,
      organizationCertificateReleaseMode: orgCertMode,
      customerCertificateReleaseMode: customerCertMap.get(wo.customer_id) ?? null,
      certPaymentBlocked,
    }
  }

  function inputForWo(wo: DispatchWoRow): DispatchOpsInput {
    const sched = wo.scheduled_on?.trim() ? wo.scheduled_on.trim().slice(0, 10) : null
    const completed = wo.completed_at?.trim() ? wo.completed_at.trim().slice(0, 10) : null
    return {
      id: wo.id,
      status: wo.status,
      type: wo.type,
      priority: wo.priority ?? "normal",
      billingState: wo.billing_state,
      maintenancePlanId: wo.maintenance_plan_id,
      calibrationTemplateId: wo.calibration_template_id,
      warrantyReviewRequired: Boolean(wo.warranty_review_required),
      billableToCustomer: wo.billable_to_customer !== false,
      assignedUserId: wo.assigned_user_id,
      createdAt: wo.created_at ?? "",
      totalPartsCents: wo.total_parts_cents ?? 0,
      completedAt: completed,
      scheduledOnYmd: sched,
    }
  }

  const out: DispatchWo[] = []

  for (const wo of rows) {
    const ctx = ctxForWo(wo)
    const input = inputForWo(wo)
    const opsBadges = deriveOperationalBadges(input, ctx)
    const flags: OpsFlags = computeOpsFlags(input, ctx)

    const tech = wo.assigned_user_id ? techByUserId.get(wo.assigned_user_id) : null
    const eqIdsForLoc =
      equipmentIdsByWo.get(wo.id)?.length ? equipmentIdsByWo.get(wo.id)! : wo.equipment_id ? [wo.equipment_id] : []
    let loc: string | null = null
    if (wo.equipment_id) loc = eqMeta.get(wo.equipment_id)?.location_label ?? null
    if (!loc) {
      for (const id of eqIdsForLoc) {
        const L = eqMeta.get(id)?.location_label
        if (L) {
          loc = L
          break
        }
      }
    }

    out.push({
      id: wo.id,
      title: wo.title,
      status: wo.status,
      scheduled_on: wo.scheduled_on,
      scheduled_time: wo.scheduled_time,
      assigned_user_id: wo.assigned_user_id,
      customer_id: wo.customer_id,
      customerName: customerNameById.get(wo.customer_id) ?? "Customer",
      work_order_number: wo.work_order_number ?? null,
      priority: wo.priority ?? null,
      type: wo.type ?? null,
      opsBadges,
      opsFlags: flags,
      technicianLabel: tech?.label ?? null,
      serviceLocationLabel: loc,
      equipmentCount: ctx.equipmentCount,
    })
  }

  return out
}

export function filterDispatchRows(rows: DispatchWo[], filterId: DispatchFilterId): DispatchWo[] {
  if (filterId === "all") return rows
  return rows.filter((w) => {
    const f = w.opsFlags
    if (!f) return true
    switch (filterId) {
      case "billing_ready":
        return f.billing_ready
      case "cert_pending":
        return f.cert_pending
      case "cert_payment_hold":
        return f.cert_payment_hold
      case "pm_risk":
        return f.pm_risk
      case "pm_overdue":
        return f.pm_overdue
      case "cal_overdue":
        return f.cal_overdue
      case "unassigned_aging":
        return f.unassigned_aging
      case "warranty_review":
        return f.warranty_review
      case "not_invoiced":
        return f.not_invoiced
      case "overdue_invoice":
        return f.overdue_invoice
      case "invoice_due_soon":
        return f.invoice_due_soon
      case "completed_not_invoiced_aging":
        return f.completed_not_invoiced_aging
      case "emergency":
        return f.emergency
      case "high_priority":
        return f.high_priority
      case "revenue_at_risk":
        return f.revenue_at_risk
      case "sched_past_due":
        return f.sched_past_due
      case "due_today":
        return f.due_today
      case "waiting_on_parts":
        return f.waiting_on_parts
      case "invoice_pending":
        return f.invoice_pending
      default:
        return true
    }
  })
}

export function sortDispatchRows(rows: DispatchWo[], mode: "schedule" | "priority"): DispatchWo[] {
  const copy = [...rows]
  function pr(p: string | null | undefined): number {
    switch (p) {
      case "critical":
        return 0
      case "high":
        return 1
      case "normal":
        return 2
      case "low":
        return 3
      default:
        return 2
    }
  }
  function timeKey(w: DispatchWo): number {
    return timeToSlotIndex(w.scheduled_time)
  }
  copy.sort((a, b) => {
    if (mode === "priority") {
      const d = pr(a.priority) - pr(b.priority)
      if (d !== 0) return d
    }
    const ta = timeKey(a)
    const tb = timeKey(b)
    if (ta !== tb) return ta - tb
    return a.title.localeCompare(b.title)
  })
  return copy
}

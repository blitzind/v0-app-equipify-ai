import { NextResponse } from "next/server"
import {
  mapInvoiceStatus,
  mapMaintenancePlanStatus,
  mapWorkOrderStatus,
  mapWorkOrderType,
} from "@/lib/portal/display-mappers"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { buildPortalCertificateItems } from "@/lib/portal/portal-certificate-items"

export const runtime = "nodejs"

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id
  const custId = portalUser.customer_id

  const [
    eqCountRes,
    equipDueRes,
    woOpenRes,
    woRecent,
    invAll,
    invRecent,
    quotesPendingCount,
    pendingQuoteRow,
    plans,
  ] = await Promise.all([
    svc
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("is_archived", false),
    svc
      .from("equipment")
      .select("id, next_due_at")
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .not("next_due_at", "is", null)
      .limit(500),
    svc
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .in("status", ["open", "scheduled", "in_progress"]),
    svc
      .from("work_orders")
      .select("id, work_order_number, title, status, type, scheduled_on, assigned_user_id, equipment_id")
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(5),
    svc
      .from("org_invoices")
      .select("id, amount_cents, status")
      .eq("organization_id", orgId)
      .eq("customer_id", custId),
    svc
      .from("org_invoices")
      .select("id, invoice_number, title, amount_cents, status, issued_at")
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .order("issued_at", { ascending: false })
      .limit(5),
    svc
      .from("org_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("status", "sent"),
    svc
      .from("org_quotes")
      .select("id, quote_number, title, amount_cents, status")
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("status", "sent")
      .limit(1)
      .maybeSingle(),
    svc
      .from("maintenance_plans")
      .select("id, name, status, next_due_date, interval_value, interval_unit, equipment_id")
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("is_archived", false)
      .eq("status", "active")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .limit(4),
  ])

  const now = Date.now()
  const thirtyDays = 30 * 86_400_000
  const equipDue =
    equipDueRes.data?.filter((r) => {
      if (!r.next_due_at) return false
      const t = new Date(r.next_due_at).getTime()
      return t - now <= thirtyDays
    }).length ?? 0

  const unpaidCents =
    invAll.data?.reduce((s, r) => {
      if (r.status === "paid") return s
      return s + (r.amount_cents ?? 0)
    }, 0) ?? 0

  const techIds = [...new Set((woRecent.data ?? []).map((w) => w.assigned_user_id).filter(Boolean))] as string[]
  const equipIds = [...new Set((woRecent.data ?? []).map((w) => w.equipment_id).filter(Boolean))] as string[]
  let techMap = new Map<string, string>()
  let equipMap = new Map<string, string>()
  if (techIds.length > 0) {
    const { data: profs } = await svc.from("profiles").select("id, full_name").in("id", techIds)
    techMap = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""]))
  }
  if (equipIds.length > 0) {
    const { data: eqs } = await svc
      .from("equipment")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", equipIds)
    equipMap = new Map((eqs ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
  }

  const workOrdersPreview = (woRecent.data ?? []).map((w) => {
    return {
      id: w.id as string,
      display: getWorkOrderDisplay({
        id: w.id as string,
        workOrderNumber: w.work_order_number as number | null,
      }),
      title: w.title as string,
      statusLabel: mapWorkOrderStatus(w.status as string),
      typeLabel: mapWorkOrderType(w.type as string),
      scheduledOn: w.scheduled_on as string | null,
      equipmentName: equipMap.get(w.equipment_id as string) ?? "Equipment",
      technicianName: w.assigned_user_id ? (techMap.get(w.assigned_user_id as string) ?? null) : null,
    }
  })

  const invoicesPreview = (invRecent.data ?? []).map((i) => ({
    id: i.id as string,
    number: i.invoice_number as string,
    title: i.title as string,
    amountCents: i.amount_cents as number,
    statusLabel: mapInvoiceStatus(i.status as string),
    issuedAt: i.issued_at as string,
  }))

  const pendingQuotesCount = quotesPendingCount.count ?? 0

  const overdueInvoice =
    (invAll.data ?? []).find((i) => i.status === "overdue") ?? undefined

  const nextPlan = plans.data?.[0]
  let nextPlanEquipName: string | null = null
  if (nextPlan?.equipment_id) {
    const { data: ne } = await svc
      .from("equipment")
      .select("name")
      .eq("organization_id", orgId)
      .eq("id", nextPlan.equipment_id as string)
      .maybeSingle()
    nextPlanEquipName = (ne as { name?: string } | null)?.name ?? null
  }

  const pq = pendingQuoteRow.data as
    | { id?: string; amount_cents?: number; title?: string }
    | null

  let certificateSummary = { total: 0, unlocked: 0, locked: 0 }
  try {
    const pack = await buildPortalCertificateItems(svc, orgId, custId)
    certificateSummary = pack.summary
  } catch {
    certificateSummary = { total: 0, unlocked: 0, locked: 0 }
  }

  const planRows = plans.data ?? []
  const planEquipIds = [...new Set(planRows.map((r) => r.equipment_id).filter(Boolean))] as string[]
  let planEquipMap = new Map<string, string>()
  if (planEquipIds.length > 0) {
    const { data: peq } = await svc
      .from("equipment")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", planEquipIds)
    planEquipMap = new Map((peq ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
  }

  const maintenancePlansOut = planRows.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    statusLabel: mapMaintenancePlanStatus(p.status as string),
    nextDueDate: p.next_due_date as string | null,
    equipmentName: planEquipMap.get(p.equipment_id as string) ?? "Equipment",
    intervalLabel: `${p.interval_value} ${p.interval_unit}`,
  }))

  return NextResponse.json({
    stats: {
      equipmentTotal: eqCountRes.count ?? 0,
      equipmentDueSoon: equipDue,
      openWorkOrders: woOpenRes.count ?? 0,
      outstandingCents: unpaidCents,
      pendingQuotes: pendingQuotesCount,
    },
    alerts: {
      overdueInvoice: overdueInvoice
        ? {
            id: overdueInvoice.id as string,
            amountCents: overdueInvoice.amount_cents as number,
            statusLabel: mapInvoiceStatus(overdueInvoice.status as string),
          }
        : null,
      pendingQuote:
        pq?.id ?
          {
            id: pq.id,
            amountCents: pq.amount_cents ?? 0,
            title: pq.title ?? "",
          }
        : null,
    },
    recentWorkOrders: workOrdersPreview,
    recentInvoices: invoicesPreview,
    maintenancePlans: maintenancePlansOut,
    nextScheduledService:
      nextPlan ?
        {
          planName: nextPlan.name as string,
          equipmentName: nextPlanEquipName ?? "Equipment",
          nextDueDate: nextPlan.next_due_date as string | null,
        }
      : null,
    formatters: {
      currency: { outstandingLabel: fmtCurrency(unpaidCents) },
    },
    certificateSummary,
  })
}

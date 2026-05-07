import { NextResponse } from "next/server"
import { mapInvoiceStatus, mapWorkOrderStatus, mapWorkOrderType } from "@/lib/portal/display-mappers"
import { buildPortalCertificateItems } from "@/lib/portal/portal-certificate-items"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import type { ServiceTimelineEvent } from "@/lib/lifecycle/service-timeline"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isoFromDate(d: string) {
  const t = new Date(d + "T12:00:00").getTime()
  return Number.isNaN(t) ? d : new Date(t).toISOString()
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { invoiceId } = await context.params
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "Invalid invoice id." }, { status: 400 })
  }

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id
  const custId = portalUser.customer_id

  const selFull =
    "id, invoice_number, title, amount_cents, status, issued_at, paid_at, due_date, equipment_id, work_order_id, calibration_record_id, portal_certificate_release_override, terms_code, terms_custom_days, created_at"

  let invRes = await svc
    .from("org_invoices")
    .select(selFull)
    .eq("organization_id", orgId)
    .eq("customer_id", custId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invRes.error) {
    invRes = await svc
      .from("org_invoices")
      .select(
        "id, invoice_number, title, amount_cents, status, issued_at, paid_at, equipment_id, work_order_id, created_at",
      )
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .eq("id", invoiceId)
      .maybeSingle()
  }

  if (invRes.error) {
    return NextResponse.json({ error: "Could not load invoice." }, { status: 500 })
  }

  const inv = invRes.data as Record<string, unknown> | null
  if (!inv) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 })
  }

  const linkRes = await svc
    .from("invoice_work_order_links")
    .select("work_order_id, sort_order")
    .eq("organization_id", orgId)
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true })

  const woIds = new Set<string>()
  const woFromInv = inv.work_order_id as string | null | undefined
  if (woFromInv) woIds.add(woFromInv)
  for (const row of (linkRes.data ?? []) as Array<{ work_order_id: string }>) {
    woIds.add(row.work_order_id)
  }

  let workOrdersOut: Array<{
    id: string
    display: string
    title: string
    statusLabel: string
    typeLabel: string
    scheduledOn: string | null
    completedAt: string | null
    equipmentName: string
    technicianName: string | null
  }> = []

  if (woIds.size > 0) {
    const { data: wos } = await svc
      .from("work_orders")
      .select(
        "id, work_order_number, title, status, type, scheduled_on, completed_at, equipment_id, assigned_user_id, assigned_technician_id",
      )
      .eq("organization_id", orgId)
      .eq("customer_id", custId)
      .in("id", [...woIds])

    const eqIds = [...new Set((wos ?? []).map((w) => w.equipment_id).filter(Boolean))] as string[]
    const techUserIds = [...new Set((wos ?? []).map((w) => w.assigned_user_id).filter(Boolean))] as string[]
    const techRowIds = [...new Set((wos ?? []).map((w) => w.assigned_technician_id).filter(Boolean))] as string[]

    let eqMap = new Map<string, string>()
    let profMap = new Map<string, string>()
    let techMap = new Map<string, string>()

    if (eqIds.length > 0) {
      const { data: eqs } = await svc.from("equipment").select("id, name").eq("organization_id", orgId).in("id", eqIds)
      eqMap = new Map((eqs ?? []).map((e) => [e.id as string, (e.name as string) ?? ""]))
    }
    if (techUserIds.length > 0) {
      const { data: profs } = await svc.from("profiles").select("id, full_name").in("id", techUserIds)
      profMap = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""]))
    }
    if (techRowIds.length > 0) {
      const { data: tr } = await svc
        .from("technicians")
        .select("id, full_name")
        .eq("organization_id", orgId)
        .in("id", techRowIds)
      techMap = new Map((tr ?? []).map((t) => [t.id as string, (t.full_name as string) ?? ""]))
    }

    workOrdersOut =
      (wos ?? []).map((w) => {
        const tid = w.assigned_technician_id as string | null
        const uid = w.assigned_user_id as string | null
        const techName =
          tid ? techMap.get(tid)?.trim() || null : uid ? profMap.get(uid)?.trim() || null : null
        return {
          id: w.id as string,
          display: getWorkOrderDisplay({
            id: w.id as string,
            workOrderNumber: w.work_order_number as number | null,
          }),
          title: w.title as string,
          statusLabel: mapWorkOrderStatus(w.status as string),
          typeLabel: mapWorkOrderType(w.type as string),
          scheduledOn: (w.scheduled_on as string | null) ?? null,
          completedAt: (w.completed_at as string | null) ?? null,
          equipmentName: eqMap.get(w.equipment_id as string) ?? "Equipment",
          technicianName: techName,
        }
      }) ?? []
  }

  let equipmentName: string | null = null
  const eqId = inv.equipment_id as string | null | undefined
  if (eqId) {
    const { data: eqOne } = await svc
      .from("equipment")
      .select("name")
      .eq("organization_id", orgId)
      .eq("id", eqId)
      .maybeSingle()
    equipmentName = (eqOne as { name?: string } | null)?.name ?? null
  }

  let certificates: Awaited<ReturnType<typeof buildPortalCertificateItems>>["items"] = []
  try {
    const woList = [...woIds]
    const crId = inv.calibration_record_id as string | null | undefined
    if (woList.length > 0) {
      const pack = await buildPortalCertificateItems(svc, orgId, custId, {
        workOrderIds: woList,
      })
      certificates = pack.items
    } else if (crId) {
      const pack = await buildPortalCertificateItems(svc, orgId, custId, {
        recordIds: [crId],
      })
      certificates = pack.items
    }
  } catch {
    certificates = []
  }

  const timeline: ServiceTimelineEvent[] = []
  const issued = inv.issued_at as string
  if (issued) {
    timeline.push({
      id: "inv-issued",
      at: isoFromDate(String(issued).slice(0, 10)),
      label: "Invoice issued",
      detail: String(inv.invoice_number ?? ""),
      tone: "info",
    })
  }
  const due = inv.due_date as string | null | undefined
  if (due) {
    timeline.push({
      id: "inv-due",
      at: isoFromDate(String(due).slice(0, 10)),
      label: "Payment due",
      tone: inv.status === "overdue" ? "danger" : "warning",
    })
  }
  for (const wo of workOrdersOut) {
    if (wo.completedAt) {
      timeline.push({
        id: `wo-done-${wo.id}`,
        at: isoFromDate(wo.completedAt.slice(0, 10)),
        label: "Work completed",
        detail: wo.display,
        tone: "success",
      })
    }
  }
  const paidAt = inv.paid_at as string | null | undefined
  if (paidAt) {
    timeline.push({
      id: "inv-paid",
      at: isoFromDate(String(paidAt).slice(0, 10)),
      label: "Invoice paid",
      tone: "success",
    })
  }

  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const releaseOverride = inv.portal_certificate_release_override as string | null | undefined

  return NextResponse.json({
    invoice: {
      id: inv.id as string,
      invoiceNumber: inv.invoice_number as string,
      title: inv.title as string,
      amountCents: inv.amount_cents as number,
      statusLabel: mapInvoiceStatus(inv.status as string),
      status: inv.status as string,
      issuedAt: inv.issued_at as string,
      paidAt: (inv.paid_at as string | null) ?? null,
      dueDate: (inv.due_date as string | null) ?? null,
      equipmentId: (inv.equipment_id as string | null) ?? null,
      equipmentName,
      portalCertificateReleaseOverride: releaseOverride ?? null,
      termsCode: (inv.terms_code as string | null) ?? null,
      termsCustomDays: (inv.terms_custom_days as number | null) ?? null,
    },
    workOrders: workOrdersOut,
    certificates,
    timeline,
  })
}

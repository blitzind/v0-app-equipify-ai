import { NextResponse } from "next/server"
import { getPortalBlitzpayHostedCheckoutEligibility } from "@/lib/blitzpay/portal-blitzpay-checkout-eligibility"
import {
  mapBlitzpayRefundToPortalHistory,
  mapOrgInvoicePaymentRowToPortalHistory,
} from "@/lib/portal/portal-invoice-payment-history"
import { mapCustomerWorkOrderStatus, mapInvoiceStatus, mapWorkOrderType } from "@/lib/portal/display-mappers"
import { buildPortalCertificateItems } from "@/lib/portal/portal-certificate-items"
import { buildPortalInvoicePaymentSummary } from "@/lib/portal/invoice-payment-summary"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import type { ServiceTimelineEvent } from "@/lib/lifecycle/service-timeline"
import { parseLineItems } from "@/lib/org-quotes-invoices/map"
import {
  formatInvoiceBillingAddressLines,
  grandTotalCentsFromInvoiceRow,
  invoiceTaxRowLabel,
} from "@/lib/billing/invoice-financial-display"

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
    "id, invoice_number, title, amount_cents, tax_amount_cents, tax_rate_percent, status, issued_at, paid_at, due_date, equipment_id, work_order_id, calibration_record_id, portal_certificate_release_override, terms_code, terms_custom_days, created_at, line_items, billing_name, billing_contact_email, billing_contact_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country"

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
        "id, invoice_number, title, amount_cents, tax_amount_cents, status, issued_at, paid_at, equipment_id, work_order_id, created_at, line_items",
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

  const [payRes, refundRes, orgMetaRes, custMetaRes] = await Promise.all([
    svc
      .from("org_invoice_payments")
      .select("id, amount_cents, paid_on, payment_method, reference")
      .eq("organization_id", orgId)
      .eq("invoice_id", invoiceId)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false }),
    svc
      .from("blitzpay_invoice_refunds")
      .select("amount_cents, applied_on")
      .eq("organization_id", orgId)
      .eq("org_invoice_id", invoiceId)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false }),
    svc.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    svc.from("customers").select("company_name").eq("organization_id", orgId).eq("id", custId).maybeSingle(),
  ])

  let paySum = 0
  const paymentRows = !payRes.error ? (payRes.data ?? []) : []
  const grossPay = paymentRows.reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
  const refundRows = !refundRes.error ? (refundRes.data ?? []) : []
  const refundSum = refundRows.reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
  paySum = Math.max(0, grossPay - refundSum)
  const paymentParts = paymentRows.map((r) =>
    mapOrgInvoicePaymentRowToPortalHistory(r as { paid_on: string; amount_cents: number; payment_method: string; reference?: string | null }),
  )
  const refundParts = refundRows.map((r) =>
    mapBlitzpayRefundToPortalHistory(r as { amount_cents: number; applied_on: string | null }),
  )
  const paymentHistory = [...paymentParts, ...refundParts].sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : 0))

  const workspaceDisplayName =
    ((orgMetaRes.data as { name?: string } | null)?.name ?? "").trim() || "Organization"
  const customerDisplayName =
    ((custMetaRes.data as { company_name?: string } | null)?.company_name ?? "").trim() || "Customer"

  const paymentSummary = buildPortalInvoicePaymentSummary(
    {
      amount_cents: inv.amount_cents as number,
      tax_amount_cents: inv.tax_amount_cents as number | null | undefined,
      status: inv.status as string,
    },
    paySum,
  )

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
          statusLabel: mapCustomerWorkOrderStatus(w.status as string, w.scheduled_on as string | null),
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

  const rawLines = inv.line_items
  const parsedItems = parseLineItems(rawLines)
  const lineItemsOut = parsedItems.map((row) => {
    const qty = row.qty
    const unit = row.unit
    const lineTotalCents = Math.round(qty * unit * 100)
    return {
      description: row.description?.trim() ? row.description.trim() : "Line item",
      qty,
      unitCents: Math.round(unit * 100),
      lineTotalCents,
      sku: row.sku?.trim() || null,
      itemType: row.item_type?.trim() || null,
    }
  })

  const subtotalCents = Math.round(Number(inv.amount_cents) || 0)
  const taxCentsRaw = inv.tax_amount_cents as number | null | undefined
  const taxCents = taxCentsRaw == null ? null : Math.round(Number(taxCentsRaw))
  const taxLabel =
    taxCents != null && taxCents !== 0 ?
      invoiceTaxRowLabel({
        taxRatePercent:
          inv.tax_rate_percent == null ? null : Number(inv.tax_rate_percent as number | string),
      })
    : null

  const billingName = (inv.billing_name as string | null | undefined)?.trim() || null
  const billingEmail = (inv.billing_contact_email as string | null | undefined)?.trim() || null
  const billingPhone = (inv.billing_contact_phone as string | null | undefined)?.trim() || null
  const billingAddressFormatted = formatInvoiceBillingAddressLines({
    billing_address_line1: inv.billing_address_line1 as string | null | undefined,
    billing_address_line2: inv.billing_address_line2 as string | null | undefined,
    billing_city: inv.billing_city as string | null | undefined,
    billing_state: inv.billing_state as string | null | undefined,
    billing_postal_code: inv.billing_postal_code as string | null | undefined,
    billing_country: inv.billing_country as string | null | undefined,
  })

  const blitzpayHostedCheckout = await getPortalBlitzpayHostedCheckoutEligibility(svc, orgId)

  return NextResponse.json({
    workspaceDisplayName,
    customerDisplayName,
    paymentHistory,
    invoice: {
      id: inv.id as string,
      invoiceNumber: inv.invoice_number as string,
      title: inv.title as string,
      amountCents: inv.amount_cents as number,
      subtotalCents,
      taxCents,
      taxLabel,
      grandTotalCents: grandTotalCentsFromInvoiceRow({
        amount_cents: inv.amount_cents as number,
        tax_amount_cents: inv.tax_amount_cents as number | null | undefined,
      }),
      totalDueCents: paymentSummary.totalDueCents,
      totalPaidCents: paymentSummary.totalPaidCents,
      balanceDueCents: paymentSummary.balanceDueCents,
      paymentStatusLabel: paymentSummary.paymentStatusLabel,
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
      lineItems: lineItemsOut,
      billingName,
      billingEmail,
      billingPhone,
      billingAddressFormatted: billingAddressFormatted.trim() ? billingAddressFormatted : null,
    },
    workOrders: workOrdersOut,
    certificates,
    timeline,
    blitzpayHostedCheckout,
  })
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
  type InvoicePaymentAllocationState,
} from "@/lib/billing/invoice-payment-allocation"
import { formatInvoiceBillingAddressLines } from "@/lib/billing/invoice-financial-display"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { invoiceStatusDbToUi, parseLineItems } from "@/lib/org-quotes-invoices/map"
import type { InvoiceDocumentContext, InvoiceDocumentLineItem } from "@/lib/invoices/invoice-document-context"

function formatDateLabel(isoDate: string | null | undefined, fallback: string): string {
  if (!isoDate) return fallback
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function ymdTodayUtc(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function buildStatusDisplay(dbStatus: string, balanceDueCents: number, dueYmd: string | null): string {
  const st = String(dbStatus || "").toLowerCase()
  const ui = invoiceStatusDbToUi(st)
  if (st === "paid" || st === "void" || balanceDueCents <= 0) return ui
  if (dueYmd) {
    const today = ymdTodayUtc()
    if (dueYmd < today) return "Overdue"
  }
  return ui
}

export type LoadInvoiceDocumentContextOptions = {
  /**
   * When true, void and archived invoices still load (internal PDF, print, download).
   * Customer-facing sends should omit this so void/archived invoices are not exposed.
   */
  staffDocumentExport?: boolean
}

export async function loadInvoiceDocumentContext(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  opts?: LoadInvoiceDocumentContextOptions,
): Promise<InvoiceDocumentContext | null> {
  const { data: invRow, error: invErr } = await supabase
    .from("org_invoices")
    .select(
      [
        "id",
        "organization_id",
        "customer_id",
        "equipment_id",
        "work_order_id",
        "calibration_record_id",
        "invoice_number",
        "title",
        "amount_cents",
        "tax_amount_cents",
        "tax_rate_percent",
        "status",
        "due_date",
        "issued_at",
        "paid_at",
        "archived_at",
        "line_items",
        "notes",
        "invoice_instructions",
        "billing_name",
        "billing_address_line1",
        "billing_address_line2",
        "billing_city",
        "billing_state",
        "billing_postal_code",
        "billing_country",
        "po_number",
        "payment_terms_label",
        "terms_code",
      ].join(", "),
    )
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (invErr || !invRow) return null

  const inv = invRow as unknown as {
    id: string
    customer_id: string
    equipment_id: string | null
    work_order_id: string | null
    calibration_record_id?: string | null
    invoice_number?: string | null
    title?: string | null
    amount_cents?: number | null
    tax_amount_cents?: number | null
    tax_rate_percent?: number | string | null
    status?: string | null
    due_date?: string | null
    issued_at?: string | null
    paid_at?: string | null
    archived_at?: string | null
    line_items?: unknown
    notes?: string | null
    invoice_instructions?: string | null
    billing_name?: string | null
    billing_address_line1?: string | null
    billing_address_line2?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_postal_code?: string | null
    billing_country?: string | null
    po_number?: string | null
    payment_terms_label?: string | null
    terms_code?: string | null
  }

  const dbStatusLower = String(inv.status || "").toLowerCase()
  if (!opts?.staffDocumentExport) {
    if (inv.archived_at) return null
    if (dbStatusLower === "void") return null
  }

  const [{ data: org }, { data: cust }, equipRes, payRes, refundRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, logo_url, document_logo_url")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("company_name")
      .eq("organization_id", organizationId)
      .eq("id", inv.customer_id)
      .maybeSingle(),
    inv.equipment_id ?
      supabase
        .from("equipment")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", inv.equipment_id)
        .maybeSingle()
    : Promise.resolve({ data: null }),
    supabase
      .from("org_invoice_payments")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("invoice_id", invoiceId),
    supabase
      .from("blitzpay_invoice_refunds")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("org_invoice_id", invoiceId)
      .eq("status", "succeeded"),
  ])

  let workOrderLabel: string | null = null
  let serviceDateLabel: string | null = null
  if (inv.work_order_id) {
    let woSel = await supabase
      .from("work_orders")
      .select("id, work_order_number, scheduled_on, completed_at")
      .eq("id", inv.work_order_id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (woSel.error && missingWorkOrderNumberColumn(woSel.error)) {
      woSel = await supabase
        .from("work_orders")
        .select("id, scheduled_on, completed_at")
        .eq("id", inv.work_order_id)
        .eq("organization_id", organizationId)
        .maybeSingle()
    }

    const wo = woSel.data as {
      id: string
      work_order_number?: number | null
      scheduled_on?: string | null
      completed_at?: string | null
    } | null

    if (!woSel.error && wo) {
      workOrderLabel = getWorkOrderDisplay({
        id: wo.id,
        workOrderNumber: wo.work_order_number ?? undefined,
      })
      const completedRaw = wo.completed_at
      const scheduledRaw = wo.scheduled_on
      if (completedRaw) {
        serviceDateLabel = formatDateLabel(completedRaw, "—")
      } else if (scheduledRaw) {
        serviceDateLabel = formatDateLabel(
          scheduledRaw.includes("T") ? scheduledRaw.slice(0, 10) : scheduledRaw,
          "—",
        )
      }
    }
  }

  const organizationName = (org as { name?: string; logo_url?: string | null; document_logo_url?: string | null } | null)?.name?.trim() || "Your service team"
  const documentLogoUrl =
    typeof (org as { document_logo_url?: string | null } | null)?.document_logo_url === "string"
      ? (org as { document_logo_url: string }).document_logo_url.trim() || null
    : null
  const logoUrl =
    typeof (org as { logo_url?: string | null } | null)?.logo_url === "string"
      ? (org as { logo_url: string }).logo_url.trim() || null
    : null

  const customerCompanyName =
    (cust as { company_name?: string } | null)?.company_name?.trim() || "Customer"

  const equipmentName =
    equipRes.data && typeof equipRes.data === "object" && "name" in equipRes.data
      ? String((equipRes.data as { name: string }).name).trim() || null
    : null

  const grossPay = (payRes.data ?? []).reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
  const refunded = (refundRes.data ?? []).reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
  const paymentsNet = Math.max(0, grossPay - refunded)

  const amountCents = Math.round(Number(inv.amount_cents ?? 0))
  const taxCents = inv.tax_amount_cents == null ? 0 : Math.round(Number(inv.tax_amount_cents))
  const grandTotalCents = invoiceGrandTotalCents({
    amount_cents: amountCents,
    tax_amount_cents: inv.tax_amount_cents,
  })

  const alloc = computeInvoicePaymentAllocation({
    invoiceTotalCents: grandTotalCents,
    paymentsTotalCents: paymentsNet,
    dbInvoiceStatus: dbStatusLower,
  })

  const dueYmd = inv.due_date ? String(inv.due_date).slice(0, 10) : null
  const statusDisplay = buildStatusDisplay(dbStatusLower, alloc.balanceDueCents, dueYmd)

  const parsed = parseLineItems(inv.line_items)
  const lineItems: InvoiceDocumentLineItem[] = parsed.map((li) => {
    const qty = Number(li.qty) || 0
    const unit = Number(li.unit) || 0
    const lineTotalUsd = qty * unit
    const row: InvoiceDocumentLineItem = {
      description: li.description?.trim() ? li.description.trim() : "Line item",
      qty,
      unitUsd: unit,
      lineTotalUsd,
    }
    if (li.sku?.trim()) row.sku = li.sku.trim()
    return row
  })

  const billToAddressBlock = formatInvoiceBillingAddressLines({
    billing_address_line1: inv.billing_address_line1,
    billing_address_line2: inv.billing_address_line2,
    billing_city: inv.billing_city,
    billing_state: inv.billing_state,
    billing_postal_code: inv.billing_postal_code,
    billing_country: inv.billing_country,
  }).trim()

  const billToName = inv.billing_name?.trim() || null

  const taxRateNum = inv.tax_rate_percent == null ? null : Number(inv.tax_rate_percent)

  const paymentTermsLabelRaw = inv.payment_terms_label
  const termsCodeRaw = inv.terms_code
  let paymentTermsLabel: string | null = null
  if (typeof paymentTermsLabelRaw === "string" && paymentTermsLabelRaw.trim()) {
    paymentTermsLabel = paymentTermsLabelRaw.trim()
  } else if (typeof termsCodeRaw === "string" && termsCodeRaw.trim()) {
    paymentTermsLabel = termsCodeRaw.trim().replace(/_/g, " ")
  }

  return {
    organizationId,
    invoiceId: inv.id,
    customerId: inv.customer_id,
    organizationName,
    documentLogoUrl,
    logoUrl,
    invoiceNumberLabel: String(inv.invoice_number ?? "").trim() || "Invoice",
    invoiceTitle: inv.title?.trim() ? inv.title.trim() : null,
    customerCompanyName,
    billToName,
    billToAddressBlock,
    equipmentName,
    workOrderLabel,
    serviceDateLabel,
    issuedDateLabel: formatDateLabel(inv.issued_at, "—"),
    dueDateLabel: inv.due_date ? formatDateLabel(inv.due_date + "T12:00:00", "—") : "—",
    statusDisplay,
    dbStatusLower,
    lineItems,
    customerNotes: inv.notes?.trim() ? inv.notes.trim() : null,
    invoiceInstructions: inv.invoice_instructions?.trim() ? inv.invoice_instructions.trim() : null,
    poNumber: inv.po_number?.trim() ? inv.po_number.trim() : null,
    subtotalCents: amountCents,
    taxCents,
    taxRatePercent: taxRateNum != null && Number.isFinite(taxRateNum) ? taxRateNum : null,
    grandTotalCents,
    totalPaidCents: alloc.totalPaidCents,
    balanceDueCents: alloc.balanceDueCents,
    allocationState: alloc.allocationState as InvoicePaymentAllocationState,
    workOrderId: inv.work_order_id ?? null,
    calibrationRecordId: inv.calibration_record_id ?? null,
    paymentTermsLabel,
  }
}

import type { AdminInvoice, AdminQuote, InvoiceStatus, QuoteStatus } from "@/lib/mock-data"
import { rowIsArchived } from "@/lib/archive-scope"
import { quoteRemainingAfterDepositCents } from "@/lib/blitzpay/blitzpay-estimate-deposit-math"
import type { InvoicePaymentAllocationState } from "@/lib/billing/invoice-payment-allocation"

export type OrgQuoteRow = {
  id: string
  organization_id: string
  customer_id: string
  seed_key: string
  quote_number: string
  title: string
  amount_cents: number
  status: string
  created_at: string
  created_by: string | null
  equipment_id: string | null
  work_order_id: string | null
  expires_at: string | null
  line_items: unknown
  notes: string | null
  internal_notes: string | null
  sent_at: string | null
  archived_at: string | null
  portal_customer_note?: string | null
  customer_portal_decision_at?: string | null
  archived_by?: string | null
  archive_reason?: string | null
  blitzpay_deposit_mode?: string | null
  blitzpay_deposit_fixed_cents?: number | null
  blitzpay_deposit_percentage_bps?: number | null
  blitzpay_deposit_collected_cents?: number | null
  blitzpay_deposit_target_cents?: number | null
  blitzpay_converted_invoice_id?: string | null
  blitzpay_financing_ready?: boolean | null
  blitzpay_financing_metadata?: unknown
}

export type OrgInvoiceRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_id: string | null
  seed_key: string
  invoice_number: string
  title: string
  amount_cents: number
  status: string
  issued_at: string
  paid_at: string | null
  created_at: string
  created_by: string | null
  work_order_id: string | null
  calibration_record_id: string | null
  line_items: unknown
  notes: string | null
  internal_notes: string | null
  due_date: string | null
  quote_id: string | null
  archived_at: string | null
  sent_at: string | null
  terms_code?: string | null
  terms_custom_days?: number | null
  payment_terms_key?: string | null
  payment_terms_days?: number | null
  payment_terms_label?: string | null
  due_date_overridden?: boolean | null
  archived_by?: string | null
  archive_reason?: string | null
  portal_certificate_release_override?: string | null
  billing_customer_id?: string | null
  billing_name?: string | null
  billing_contact_name?: string | null
  billing_contact_email?: string | null
  billing_contact_phone?: string | null
  billing_address_line1?: string | null
  billing_address_line2?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_postal_code?: string | null
  billing_country?: string | null
  po_number?: string | null
  invoice_instructions?: string | null
  tax_calculation_mode?: string | null
  tax_basis?: string | null
  tax_jurisdiction_label?: string | null
  tax_rate_percent?: number | string | null
  tax_amount_cents?: number | null
  taxable_subtotal_cents?: number | null
  non_taxable_subtotal_cents?: number | null
  tax_exemption_applied?: boolean | null
  tax_exemption_reason?: string | null
  tax_provider?: string | null
  tax_provider_reference?: string | null
  tax_snapshot_json?: unknown
}

export type LineItemJson = {
  description: string
  qty: number
  unit: number
  /** Optional internal trace for generated lines, e.g. work_order:labor. */
  source_ref?: string
  taxable?: boolean
  tax_category?: string
  tax_rate_percent?: number
  tax_amount?: number
  tax_snapshot_json?: unknown
  /** When present, ties the line back to a reusable catalog template for usage reporting. */
  catalog_item_id?: string
  /** Snapshot fields copied from catalog at line creation; later catalog edits do not change stored quotes/invoices. */
  sku?: string
  item_type?: string
  unit_label?: string
}

export type QuoteInvoiceLineItem = LineItemJson

/** Notes / instructions when structured `line_items` JSON is empty or legacy. */
export function buildInvoiceTextualDetailFallback(inv: {
  notes?: string | null
  internalNotes?: string | null
  invoiceInstructions?: string | null
}): string | null {
  const parts: string[] = []
  const n = inv.notes?.trim()
  if (n) parts.push(n)
  const ins = inv.invoiceInstructions?.trim()
  if (ins) parts.push(`Customer instructions:\n${ins}`)
  const intn = inv.internalNotes?.trim()
  if (intn) parts.push(`Internal notes:\n${intn}`)
  if (parts.length === 0) return null
  return parts.join("\n\n")
}

function coerceLineItemsArray(raw: unknown): unknown[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    const t = raw.trim()
    if (!t) return null
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === "object") {
        const o = parsed as Record<string, unknown>
        if (Array.isArray(o.lines)) return o.lines
        if (Array.isArray(o.items)) return o.items
        if (Array.isArray(o.line_items)) return o.line_items
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.lines)) return o.lines
    if (Array.isArray(o.items)) return o.items
    if (Array.isArray(o.line_items)) return o.line_items
  }
  return null
}

function pickTrimmedString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function pickLineItemDescription(o: Record<string, unknown>): string {
  const itemRef = o.ItemRef
  let refName = ""
  if (itemRef && typeof itemRef === "object") {
    const nm = (itemRef as Record<string, unknown>).name
    if (typeof nm === "string" && nm.trim()) refName = nm.trim()
  }
  return pickTrimmedString(
    o.description,
    o.name,
    o.memo,
    o.line_description,
    o.title,
    o.service_description,
    refName,
  )
}

function pickNumeric(...vals: unknown[]): number | null {
  for (const c of vals) {
    if (typeof c === "number" && Number.isFinite(c)) return c
    if (typeof c === "string" && c.trim()) {
      const n = Number(c)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function pickLineItemQty(o: Record<string, unknown>): number {
  const q = pickNumeric(o.qty, o.quantity, o.Qty, o.count, o.quantity_ordered)
  if (q == null || q <= 0) return 1
  return q
}

function pickLineItemUnitDollars(o: Record<string, unknown>, qty: number): number {
  const direct = pickNumeric(o.unit, o.unit_price, o.unitPrice, o.rate, o.UnitPrice, o.price, o.unit_amount)
  if (direct != null && direct !== 0) return direct

  const totalD = pickNumeric(o.amount, o.line_total, o.total, o.lineTotal, o.Amount, o.subtotal, o.line_amount)
  if (totalD != null && qty > 0) return totalD / qty

  const cents = pickNumeric(
    o.line_total_cents,
    o.amount_cents,
    o.total_cents,
    o.line_amount_cents,
    o.extended_price_cents,
  )
  if (cents != null && qty > 0) return cents / 100 / qty

  return 0
}

export function parseLineItems(raw: unknown): LineItemJson[] {
  const arr = coerceLineItemsArray(raw)
  if (!arr) return []
  const out: LineItemJson[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const cid = o.catalog_item_id
    const qty = pickLineItemQty(o)
    let unit = pickLineItemUnitDollars(o, qty)
    let description = pickLineItemDescription(o)

    const lineTotal = qty * unit
    if (!description && lineTotal !== 0) {
      description = "Line item"
    }

    const row: LineItemJson = {
      description,
      qty,
      unit,
    }

    const sourceRef = o.source_ref
    if (typeof sourceRef === "string" && sourceRef.trim()) row.source_ref = sourceRef.trim()
    if (typeof o.taxable === "boolean") row.taxable = o.taxable
    if (typeof o.tax_category === "string" && o.tax_category.trim()) row.tax_category = o.tax_category.trim()
    if (typeof o.tax_rate_percent === "number") row.tax_rate_percent = o.tax_rate_percent
    if (typeof o.tax_amount === "number") row.tax_amount = o.tax_amount
    if (o.tax_snapshot_json !== undefined) row.tax_snapshot_json = o.tax_snapshot_json
    if (typeof cid === "string" && cid.trim()) row.catalog_item_id = cid.trim()
    const sku = o.sku
    const itemType = o.item_type
    const unitLabel = o.unit_label
    if (typeof sku === "string" && sku.trim()) row.sku = sku.trim()
    if (typeof itemType === "string" && itemType.trim()) row.item_type = itemType.trim()
    if (typeof unitLabel === "string" && unitLabel.trim()) row.unit_label = unitLabel.trim()

    const hasMoney = Math.abs(row.qty * row.unit) > 1e-9
    const hasMeta = Boolean(row.catalog_item_id) || Boolean(row.sku?.trim())
    const hasType = Boolean(row.item_type?.trim())
    if (!row.description.trim() && !hasMoney && !hasMeta && !hasType) continue

    out.push(row)
  }
  return out
}

export function quoteStatusDbToUi(s: string): QuoteStatus {
  switch (s) {
    case "draft":
      return "Draft"
    case "sent":
      return "Sent"
    case "pending_approval":
      return "Pending Approval"
    case "approved":
      return "Approved"
    case "declined":
      return "Declined"
    case "expired":
      return "Expired"
    default:
      return "Draft"
  }
}

export function quoteStatusUiToDb(s: QuoteStatus): string {
  const m: Record<QuoteStatus, string> = {
    Draft: "draft",
    Sent: "sent",
    "Pending Approval": "pending_approval",
    Approved: "approved",
    Declined: "declined",
    Expired: "expired",
  }
  return m[s] ?? "draft"
}

export function invoiceStatusDbToUi(s: string): InvoiceStatus {
  switch (s) {
    case "draft":
      return "Draft"
    case "sent":
      return "Sent"
    case "unpaid":
      return "Unpaid"
    case "paid":
      return "Paid"
    case "overdue":
      return "Overdue"
    case "void":
      return "Void"
    default:
      return "Draft"
  }
}

export function invoiceStatusUiToDb(s: InvoiceStatus): string {
  const m: Record<InvoiceStatus, string> = {
    Draft: "draft",
    Sent: "sent",
    Unpaid: "unpaid",
    Paid: "paid",
    Overdue: "overdue",
    Void: "void",
  }
  return m[s] ?? "draft"
}

export function mapOrgQuoteToAdmin(
  row: OrgQuoteRow,
  names: {
    customerName: string
    equipmentName: string
    createdByLabel: string
    workOrderNumber?: number
  },
): AdminQuote {
  const lineItems = parseLineItems(row.line_items)
  const createdDate = row.created_at ? row.created_at.slice(0, 10) : ""
  const expiresDate = row.expires_at ?? ""
  const sentDate = row.sent_at ?? ""
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id,
    customerName: names.customerName,
    equipmentId: row.equipment_id ?? "",
    equipmentName: names.equipmentName,
    createdDate,
    expiresDate,
    sentDate,
    amount: Math.round(row.amount_cents) / 100,
    status: quoteStatusDbToUi(row.status),
    description: row.title,
    createdBy: names.createdByLabel,
    workOrderId: row.work_order_id ?? "",
    workOrderNumber: names.workOrderNumber,
    lineItems,
    notes: row.notes ?? "",
    internalNotes: row.internal_notes?.trim() ? row.internal_notes : undefined,
    isArchived: rowIsArchived(row.archived_at),
    customerPortalDecisionAt: row.customer_portal_decision_at ?? null,
    portalCustomerNote: row.portal_customer_note?.trim() ? row.portal_customer_note.trim() : null,
    blitzpayDepositMode: normalizeBlitzpayQuoteDepositMode(row.blitzpay_deposit_mode),
    blitzpayDepositFixedCents:
      row.blitzpay_deposit_fixed_cents == null ? null : Math.round(Number(row.blitzpay_deposit_fixed_cents)),
    blitzpayDepositPercentageBps:
      row.blitzpay_deposit_percentage_bps == null ? null : Math.round(Number(row.blitzpay_deposit_percentage_bps)),
    blitzpayDepositCollectedCents: Math.max(
      0,
      Math.round(Number(row.blitzpay_deposit_collected_cents ?? 0)),
    ),
    blitzpayConvertedInvoiceId: row.blitzpay_converted_invoice_id ? String(row.blitzpay_converted_invoice_id) : null,
    blitzpayFinancingReady: Boolean(row.blitzpay_financing_ready),
    blitzpayRemainingQuoteCents: quoteRemainingAfterDepositCents(
      Math.round(row.amount_cents),
      Math.max(0, Math.round(Number(row.blitzpay_deposit_collected_cents ?? 0))),
    ),
  }
}

function normalizeBlitzpayQuoteDepositMode(
  raw: string | null | undefined,
): "none" | "acceptance" | "fixed" | "percentage" | "full_prepay" {
  const s = String(raw ?? "none").toLowerCase()
  if (s === "acceptance" || s === "fixed" || s === "percentage" || s === "full_prepay") return s
  return "none"
}

export function mapOrgInvoiceToAdmin(
  row: OrgInvoiceRow,
  names: {
    customerName: string
    equipmentName: string
    createdByLabel: string
    /** From invoice_work_order_links; must include work_order_id when present. */
    linkedWorkOrderIds?: string[]
    paymentAllocation?: {
      invoiceTotalCents: number
      totalPaidCents: number
      balanceDueCents: number
      allocationState: InvoicePaymentAllocationState
    }
  },
): AdminInvoice {
  const lineItems = parseLineItems(row.line_items)
  const issueDate = row.issued_at ? row.issued_at.slice(0, 10) : ""
  const dueDate = row.due_date ? row.due_date.slice(0, 10) : issueDate
  const paidDate = row.paid_at ? row.paid_at.slice(0, 10) : ""
  const linked = names.linkedWorkOrderIds?.length
    ? [...new Set(names.linkedWorkOrderIds)]
    : row.work_order_id
      ? [row.work_order_id]
      : []
  const primaryWo = linked[0] ?? row.work_order_id ?? ""
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: names.customerName,
    workOrderId: primaryWo,
    linkedWorkOrderIds: linked.length ? linked : undefined,
    equipmentId: row.equipment_id ?? "",
    equipmentName: names.equipmentName,
    issueDate,
    dueDate,
    paidDate,
    amount: Math.round(row.amount_cents) / 100,
    status: invoiceStatusDbToUi(row.status),
    createdBy: names.createdByLabel,
    title: row.title?.trim() ? row.title.trim() : undefined,
    lineItems,
    notes: row.notes ?? "",
    quoteId: row.quote_id ?? undefined,
    internalNotes: row.internal_notes?.trim() ? row.internal_notes : undefined,
    sentAt: row.sent_at ?? undefined,
    calibrationRecordId: row.calibration_record_id ?? undefined,
    isArchived: rowIsArchived(row.archived_at),
    termsCode: row.terms_code ?? null,
    termsCustomDays: row.terms_custom_days ?? null,
    paymentTermsKey: row.payment_terms_key ?? row.terms_code ?? null,
    paymentTermsDays: row.payment_terms_days ?? row.terms_custom_days ?? null,
    paymentTermsLabel: row.payment_terms_label ?? null,
    dueDateOverridden: Boolean(row.due_date_overridden),
    portalCertificateReleaseOverride: row.portal_certificate_release_override ?? null,
    billingCustomerId: row.billing_customer_id ?? null,
    billingName: row.billing_name ?? null,
    billingContactName: row.billing_contact_name ?? null,
    billingContactEmail: row.billing_contact_email ?? null,
    billingContactPhone: row.billing_contact_phone ?? null,
    billingAddressLine1: row.billing_address_line1 ?? null,
    billingAddressLine2: row.billing_address_line2 ?? null,
    billingCity: row.billing_city ?? null,
    billingState: row.billing_state ?? null,
    billingPostalCode: row.billing_postal_code ?? null,
    billingCountry: row.billing_country ?? null,
    poNumber: row.po_number ?? null,
    invoiceInstructions: row.invoice_instructions ?? null,
    taxCalculationMode: row.tax_calculation_mode ?? null,
    taxBasis: row.tax_basis ?? null,
    taxJurisdictionLabel: row.tax_jurisdiction_label ?? null,
    taxRatePercent: row.tax_rate_percent == null ? null : Number(row.tax_rate_percent),
    taxAmount: row.tax_amount_cents == null ? null : row.tax_amount_cents / 100,
    taxableSubtotal: row.taxable_subtotal_cents == null ? null : row.taxable_subtotal_cents / 100,
    nonTaxableSubtotal: row.non_taxable_subtotal_cents == null ? null : row.non_taxable_subtotal_cents / 100,
    taxExemptionApplied: row.tax_exemption_applied ?? null,
    taxExemptionReason: row.tax_exemption_reason ?? null,
    taxProvider: row.tax_provider ?? null,
    taxProviderReference: row.tax_provider_reference ?? null,
    taxSnapshotJson: row.tax_snapshot_json,
    ...(names.paymentAllocation
      ? {
          invoiceTotalCents: names.paymentAllocation.invoiceTotalCents,
          totalPaidCents: names.paymentAllocation.totalPaidCents,
          balanceDueCents: names.paymentAllocation.balanceDueCents,
          paymentAllocationState: names.paymentAllocation.allocationState,
        }
      : {}),
  }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrgInvoiceRow } from "@/lib/org-quotes-invoices/map"
import { parseLineItems } from "@/lib/org-quotes-invoices/map"
import { insertOrgInvoice } from "@/lib/org-quotes-invoices/repository"

export type DuplicateOrgInvoiceResult =
  | { ok: true; invoiceId: string; invoiceNumber: string }
  | { ok: false; code: string; message: string }

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDaysYmd(ymd: string, days: number): string {
  const [yy, mm, dd] = ymd.split("-").map((n) => Number(n))
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return ymd
  const t = new Date(yy, mm - 1, dd)
  if (Number.isNaN(t.getTime())) return ymd
  t.setDate(t.getDate() + days)
  return ymdLocal(t)
}

/**
 * Creates a new draft invoice from an existing row: copies customer, equipment, work order links,
 * line items, notes, terms, tax snapshots, and billing fields. Does not copy payment state,
 * internal notes, sent/paid timestamps, or external tax provider references.
 */
export async function duplicateOrgInvoiceForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  sourceInvoiceId: string,
  userId: string | null,
): Promise<DuplicateOrgInvoiceResult> {
  const { data: row, error: invErr } = await supabase
    .from("org_invoices")
    .select("*")
    .eq("id", sourceInvoiceId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (invErr || !row) {
    return { ok: false, code: "not_found", message: "Invoice not found." }
  }

  const inv = row as OrgInvoiceRow & { archived_at?: string | null }

  if (inv.archived_at) {
    return { ok: false, code: "archived", message: "Restore this invoice before duplicating." }
  }

  const { data: linkRows, error: linkErr } = await supabase
    .from("invoice_work_order_links")
    .select("work_order_id, sort_order")
    .eq("organization_id", organizationId)
    .eq("invoice_id", sourceInvoiceId)
    .order("sort_order", { ascending: true })

  if (linkErr) {
    return { ok: false, code: "links_failed", message: linkErr.message }
  }

  const orderedLinks = (linkRows ?? []) as Array<{ work_order_id: string; sort_order: number }>
  const linkWoIds: string[] = []
  const seenLink = new Set<string>()
  for (const lr of orderedLinks) {
    const wid = lr.work_order_id?.trim()
    if (!wid || seenLink.has(wid)) continue
    seenLink.add(wid)
    linkWoIds.push(wid)
  }

  const rowWo = inv.work_order_id?.trim() || null
  const primaryWorkOrderId = rowWo || linkWoIds[0] || null
  const allWorkOrders = [...new Set([...(primaryWorkOrderId ? [primaryWorkOrderId] : []), ...linkWoIds])]

  const todayYmd = ymdLocal(new Date())
  const oldIssYmd = inv.issued_at ? String(inv.issued_at).slice(0, 10) : todayYmd
  const oldDueYmd = inv.due_date ? String(inv.due_date).slice(0, 10) : oldIssYmd
  const issueTime = new Date(`${oldIssYmd}T12:00:00`)
  const dueTime = new Date(`${oldDueYmd}T12:00:00`)
  const spanDays = Number.isFinite(issueTime.getTime()) && Number.isFinite(dueTime.getTime())
    ? Math.max(0, Math.round((dueTime.getTime() - issueTime.getTime()) / 86400000))
    : 0
  const newDueYmd = addDaysYmd(todayYmd, spanDays)

  const lineItems = parseLineItems(inv.line_items)
  const taxAmountDollars = inv.tax_amount_cents == null ? null : Math.round(Number(inv.tax_amount_cents)) / 100
  const taxableSub =
    inv.taxable_subtotal_cents == null ? null : Math.round(Number(inv.taxable_subtotal_cents)) / 100
  const nonTaxSub =
    inv.non_taxable_subtotal_cents == null ? null : Math.round(Number(inv.non_taxable_subtotal_cents)) / 100

  const ins = await insertOrgInvoice(
    supabase,
    {
      organizationId,
      customerId: inv.customer_id,
      equipmentId: inv.equipment_id,
      workOrderId: primaryWorkOrderId,
      quoteId: inv.quote_id,
      calibrationRecordId: inv.calibration_record_id,
      title: inv.title?.trim() ? inv.title.trim() : "Invoice",
      amountCents: Math.round(Number(inv.amount_cents ?? 0)),
      status: "Draft",
      issuedAt: todayYmd,
      dueDate: newDueYmd,
      paidAt: null,
      lineItems,
      notes: inv.notes?.trim() ? inv.notes.trim() : null,
      internalNotes: null,
      termsCode: inv.terms_code ?? null,
      termsCustomDays: inv.terms_custom_days ?? null,
      paymentTermsKey: inv.payment_terms_key ?? null,
      paymentTermsDays: inv.payment_terms_days ?? null,
      paymentTermsLabel: inv.payment_terms_label ?? null,
      dueDateOverridden: Boolean(inv.due_date_overridden),
      billingCustomerId: inv.billing_customer_id ?? null,
      billingName: inv.billing_name ?? null,
      billingContactName: inv.billing_contact_name ?? null,
      billingContactEmail: inv.billing_contact_email ?? null,
      billingContactPhone: inv.billing_contact_phone ?? null,
      billingAddressLine1: inv.billing_address_line1 ?? null,
      billingAddressLine2: inv.billing_address_line2 ?? null,
      billingCity: inv.billing_city ?? null,
      billingState: inv.billing_state ?? null,
      billingPostalCode: inv.billing_postal_code ?? null,
      billingCountry: inv.billing_country ?? null,
      poNumber: inv.po_number ?? null,
      invoiceInstructions: inv.invoice_instructions ?? null,
      taxCalculationMode: inv.tax_calculation_mode ?? null,
      taxBasis: inv.tax_basis ?? null,
      taxJurisdictionLabel: inv.tax_jurisdiction_label ?? null,
      taxRatePercent: inv.tax_rate_percent == null ? null : Number(inv.tax_rate_percent),
      taxAmount: taxAmountDollars,
      taxableSubtotal: taxableSub,
      nonTaxableSubtotal: nonTaxSub,
      taxExemptionApplied: inv.tax_exemption_applied ?? null,
      taxExemptionReason: inv.tax_exemption_reason ?? null,
      taxProvider: inv.tax_provider ?? null,
      taxProviderReference: null,
      taxSnapshotJson: inv.tax_snapshot_json ?? null,
    },
    { skipWorkOrderBillingStateSync: true },
  )

  if (ins.error || !ins.id) {
    return { ok: false, code: "insert_failed", message: ins.error ?? "Could not create duplicate invoice." }
  }

  const newId = ins.id
  const extras = allWorkOrders.filter((id) => id && id !== primaryWorkOrderId)
  let sortOrder = 1
  for (const woId of extras) {
    const { error: exErr } = await supabase.from("invoice_work_order_links").insert({
      organization_id: organizationId,
      invoice_id: newId,
      work_order_id: woId,
      linked_by: userId,
      linked_at: new Date().toISOString(),
      sort_order: sortOrder++,
    })
    if (exErr && !String(exErr.message).toLowerCase().includes("duplicate")) {
      return { ok: false, code: "link_failed", message: exErr.message }
    }
  }

  return {
    ok: true,
    invoiceId: newId,
    invoiceNumber: ins.invoiceNumber?.trim() || "Invoice",
  }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { invoiceGrandTotalCents } from "@/lib/billing/invoice-payment-allocation"
import { splitLineItemDescription } from "@/lib/documents/document-address"
import { loadCustomerDocumentFields } from "@/lib/documents/load-customer-document-fields"
import { profileLabelById } from "@/lib/documents/profile-label"
import { getOrganizationDocumentBranding } from "@/lib/organization/document-branding"
import { quoteStatusDbToUi, parseLineItems } from "@/lib/org-quotes-invoices/map"
import type { QuoteDocumentContext, QuoteDocumentLineItem } from "@/lib/quotes/quote-document-context"

function formatDateLabel(isoDate: string | null | undefined, fallback: string): string {
  if (!isoDate) return fallback
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export type LoadQuoteDocumentContextOptions = {
  /**
   * When true, archived quotes still load (internal PDF, download).
   * Customer-facing sends should omit this so archived quotes are not exposed.
   */
  staffDocumentExport?: boolean
}

export async function loadQuoteDocumentContext(
  supabase: SupabaseClient,
  organizationId: string,
  quoteId: string,
  opts?: LoadQuoteDocumentContextOptions,
): Promise<QuoteDocumentContext | null> {
  const { data: row, error: qErr } = await supabase
    .from("org_quotes")
    .select(
      [
        "id",
        "organization_id",
        "customer_id",
        "equipment_id",
        "quote_number",
        "title",
        "amount_cents",
        "tax_amount_cents",
        "tax_rate_percent",
        "status",
        "created_at",
        "created_by",
        "expires_at",
        "line_items",
        "notes",
        "archived_at",
      ].join(", "),
    )
    .eq("id", quoteId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (qErr || !row) return null

  const quote = row as unknown as {
    id: string
    customer_id: string
    equipment_id: string | null
    quote_number?: string | null
    title?: string | null
    amount_cents?: number | null
    tax_amount_cents?: number | null
    tax_rate_percent?: number | string | null
    status?: string | null
    created_at?: string | null
    created_by?: string | null
    expires_at?: string | null
    line_items?: unknown
    notes?: string | null
    archived_at?: string | null
  }

  if (!opts?.staffDocumentExport && quote.archived_at) return null

  const [branding, customerFields, authorName, equipRes] = await Promise.all([
    getOrganizationDocumentBranding(supabase, organizationId),
    loadCustomerDocumentFields(supabase, organizationId, quote.customer_id),
    profileLabelById(supabase, quote.created_by),
    quote.equipment_id ?
      supabase
        .from("equipment")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", quote.equipment_id)
        .maybeSingle()
    : Promise.resolve({ data: null }),
  ])

  const equipmentName =
    equipRes.data && typeof equipRes.data === "object" && "name" in equipRes.data
      ? String((equipRes.data as { name: string }).name).trim() || null
    : null

  const parsed = parseLineItems(quote.line_items)
  const lineItems: QuoteDocumentLineItem[] = parsed.map((li) => {
    const qty = Number(li.qty) || 0
    const unit = Number(li.unit) || 0
    const lineTotalUsd = qty * unit
    const description = li.description?.trim() ? li.description.trim() : "Line item"
    const split = splitLineItemDescription(description)
    const row: QuoteDocumentLineItem = {
      description,
      itemName: split.title,
      detailNotes: split.detail,
      qty,
      unitUsd: unit,
      lineTotalUsd,
    }
    if (typeof li.taxable === "boolean") row.taxable = li.taxable
    if (li.sku?.trim()) row.sku = li.sku.trim()
    return row
  })

  const subtotalCents = Math.round(Number(quote.amount_cents ?? 0))
  const taxCents = quote.tax_amount_cents == null ? 0 : Math.round(Number(quote.tax_amount_cents))
  const totalCents = invoiceGrandTotalCents({
    amount_cents: subtotalCents,
    tax_amount_cents: quote.tax_amount_cents,
  })
  const taxRateNum = quote.tax_rate_percent == null ? null : Number(quote.tax_rate_percent)

  return {
    organizationId,
    quoteId: quote.id,
    customerId: quote.customer_id,
    organizationName: branding.organizationName,
    documentLogoUrl: branding.documentLogoUrl,
    logoUrl: branding.appLogoUrl,
    companyAddress: branding.companyAddress,
    companyPhone: branding.companyPhone,
    companyWebsite: branding.companyWebsite,
    companyEmail: branding.companyEmail,
    quoteNumberLabel: String(quote.quote_number ?? "").trim() || "Quote",
    quoteTitle: quote.title?.trim() ? quote.title.trim() : null,
    customerCompanyName: customerFields?.customerCompanyName ?? "Customer",
    customerPhone: customerFields?.customerPhone ?? null,
    customerEmail: customerFields?.customerEmail ?? null,
    serviceAddressBlock: customerFields?.serviceAddressBlock ?? null,
    billingAddressBlock: customerFields?.billingAddressBlock ?? null,
    equipmentName,
    statusDisplay: quoteStatusDbToUi(String(quote.status || "")),
    createdDateLabel: formatDateLabel(quote.created_at, "—"),
    expiresDateLabel: formatDateLabel(quote.expires_at, "—"),
    authorName: authorName,
    poNumber: customerFields?.poNumber ?? null,
    lineItems,
    customerNotes: quote.notes?.trim() ? quote.notes.trim() : null,
    subtotalCents,
    taxCents,
    taxRatePercent: taxRateNum != null && Number.isFinite(taxRateNum) ? taxRateNum : null,
    totalCents,
  }
}

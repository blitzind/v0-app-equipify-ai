import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
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
        "status",
        "created_at",
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
    status?: string | null
    created_at?: string | null
    expires_at?: string | null
    line_items?: unknown
    notes?: string | null
    archived_at?: string | null
  }

  if (!opts?.staffDocumentExport && quote.archived_at) return null

  const [{ data: org }, { data: cust }, equipRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, logo_url, document_logo_url")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("company_name")
      .eq("organization_id", organizationId)
      .eq("id", quote.customer_id)
      .maybeSingle(),
    quote.equipment_id ?
      supabase
        .from("equipment")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", quote.equipment_id)
        .maybeSingle()
    : Promise.resolve({ data: null }),
  ])

  const organizationName =
    (org as { name?: string; logo_url?: string | null; document_logo_url?: string | null } | null)?.name?.trim() ||
    "Your service team"
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

  const parsed = parseLineItems(quote.line_items)
  const lineItems: QuoteDocumentLineItem[] = parsed.map((li) => {
    const qty = Number(li.qty) || 0
    const unit = Number(li.unit) || 0
    const lineTotalUsd = qty * unit
    return {
      description: li.description?.trim() ? li.description.trim() : "Line item",
      qty,
      unitUsd: unit,
      lineTotalUsd,
    }
  })

  const totalCents = Math.round(Number(quote.amount_cents ?? 0))
  const statusDisplay = quoteStatusDbToUi(String(quote.status || ""))

  return {
    organizationId,
    quoteId: quote.id,
    customerId: quote.customer_id,
    organizationName,
    documentLogoUrl,
    logoUrl,
    quoteNumberLabel: String(quote.quote_number ?? "").trim() || "Quote",
    quoteTitle: quote.title?.trim() ? quote.title.trim() : null,
    customerCompanyName,
    equipmentName,
    statusDisplay,
    createdDateLabel: formatDateLabel(quote.created_at, "—"),
    expiresDateLabel: formatDateLabel(quote.expires_at, "—"),
    lineItems,
    customerNotes: quote.notes?.trim() ? quote.notes.trim() : null,
    totalCents,
  }
}

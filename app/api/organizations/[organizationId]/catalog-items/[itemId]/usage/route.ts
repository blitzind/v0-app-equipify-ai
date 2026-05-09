import { NextResponse } from "next/server"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"
import { requireOrgMemberRead } from "@/lib/catalog/require-org-catalog-write"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { maybeCatalogSchemaErrorResponse } from "@/lib/supabase/catalog-schema-errors"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonLinesHasCatalogId(raw: unknown, catalogItemId: string): LineItemJson[] {
  if (!Array.isArray(raw)) return []
  const hits: LineItemJson[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    if (o.catalog_item_id === catalogItemId) {
      hits.push({
        description: String(o.description ?? ""),
        qty: typeof o.qty === "number" ? o.qty : Number(o.qty) || 0,
        unit: typeof o.unit === "number" ? o.unit : Number(o.unit) || 0,
        catalog_item_id: catalogItemId,
      })
    }
  }
  return hits
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; itemId: string }> },
) {
  const { organizationId, itemId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberRead(organizationId)
  if ("error" in gate) return gate.error
  const financialGate = await requireAnyOrgPermission(organizationId, [
    "canViewFinancials",
    "canViewBilling",
    "canManageInventory",
  ])
  if ("error" in financialGate) return financialGate.error

  const { data: itemRow, error: itemErr } = await gate.svc
    .from("catalog_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle()

  if (itemErr) {
    const schema = maybeCatalogSchemaErrorResponse(itemErr.message)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: itemErr.message }, { status: 500 })
  }
  if (!itemRow) {
    return NextResponse.json({ error: "not_found", message: "Catalog item not found." }, { status: 404 })
  }

  const [
    quotesRes,
    invoicesRes,
    poRes,
    woLinesRes,
  ] = await Promise.all([
    gate.svc
      .from("org_quotes")
      .select("id, quote_number, title, line_items, created_at, archived_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(800),
    gate.svc
      .from("org_invoices")
      .select("id, invoice_number, title, line_items, issued_at, archived_at")
      .eq("organization_id", organizationId)
      .order("issued_at", { ascending: false })
      .limit(800),
    gate.svc
      .from("org_purchase_orders")
      .select("id, purchase_order_number, line_items, order_date, total_cents, archived_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(800),
    gate.svc
      .from("work_order_line_items")
      .select("id, work_order_id, line_total_cents, quantity, unit_cost_cents, created_at")
      .eq("organization_id", organizationId)
      .eq("catalog_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  if (quotesRes.error || invoicesRes.error || poRes.error || woLinesRes.error) {
    const msg =
      quotesRes.error?.message ??
      invoicesRes.error?.message ??
      poRes.error?.message ??
      woLinesRes.error?.message ??
      "Query failed"
    const schema = maybeCatalogSchemaErrorResponse(msg)
    if (schema) return schema
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }

  const quoteHits: Array<{
    id: string
    quote_number: string
    title: string
    created_at: string
    line_total: number
  }> = []
  for (const r of quotesRes.data ?? []) {
    const row = r as {
      id: string
      quote_number: string
      title: string
      line_items: unknown
      created_at: string
      archived_at: string | null
    }
    const lines = jsonLinesHasCatalogId(row.line_items, itemId)
    if (lines.length === 0) continue
    const lineTotal = lines.reduce((s, li) => s + li.qty * li.unit, 0)
    quoteHits.push({
      id: row.id,
      quote_number: row.quote_number,
      title: row.title,
      created_at: row.created_at,
      line_total: lineTotal,
    })
  }

  const invoiceHits: Array<{
    id: string
    invoice_number: string
    title: string
    issued_at: string
    line_total: number
  }> = []
  let lifetimeRevenue = 0
  for (const r of invoicesRes.data ?? []) {
    const row = r as {
      id: string
      invoice_number: string
      title: string
      line_items: unknown
      issued_at: string
      archived_at: string | null
    }
    const lines = jsonLinesHasCatalogId(row.line_items, itemId)
    if (lines.length === 0) continue
    const lineTotal = lines.reduce((s, li) => s + li.qty * li.unit, 0)
    lifetimeRevenue += lineTotal
    invoiceHits.push({
      id: row.id,
      invoice_number: row.invoice_number,
      title: row.title,
      issued_at: row.issued_at,
      line_total: lineTotal,
    })
  }

  const poHits: Array<{
    id: string
    purchase_order_number: string
    order_date: string | null
    line_cost: number
  }> = []
  let poCost = 0
  for (const r of poRes.data ?? []) {
    const row = r as { id: string; purchase_order_number: string; line_items: unknown; order_date: string | null }
    if (!Array.isArray(row.line_items)) continue
    let matchedCents = 0
    for (const item of row.line_items) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      if (o.catalog_item_id !== itemId) continue
      const q =
        typeof o.quantity === "number"
          ? o.quantity
          : typeof o.qty === "number"
            ? o.qty
            : Number(o.quantity ?? o.qty ?? 0)
      const lt =
        typeof o.lineTotalCents === "number"
          ? o.lineTotalCents
          : typeof o.line_total_cents === "number"
            ? Number(o.line_total_cents)
            : 0
      if (lt > 0) matchedCents += lt
      else {
        const uc =
          typeof o.unitCostCents === "number"
            ? o.unitCostCents
            : typeof o.unit_cost_cents === "number"
              ? Number(o.unit_cost_cents)
              : 0
        matchedCents += Math.round(q * uc)
      }
    }
    if (matchedCents <= 0) continue
    poCost += matchedCents / 100
    poHits.push({
      id: row.id,
      purchase_order_number: row.purchase_order_number,
      order_date: row.order_date,
      line_cost: matchedCents / 100,
    })
  }

  const woPartIds = [...new Set((woLinesRes.data ?? []).map((w) => (w as { work_order_id: string }).work_order_id))]
  let woMap = new Map<string, { work_order_number: number | null; title: string }>()
  if (woPartIds.length > 0) {
    const { data: wRows } = await gate.svc
      .from("work_orders")
      .select("id, work_order_number, title")
      .eq("organization_id", organizationId)
      .in("id", woPartIds)
    for (const w of wRows ?? []) {
      const wr = w as { id: string; work_order_number: number | null; title: string }
      woMap.set(wr.id, { work_order_number: wr.work_order_number ?? null, title: wr.title })
    }
  }

  let woCost = 0
  const woHits: Array<{
    id: string
    work_order_id: string
    work_order_number: number | null
    title: string
    line_cost: number
    created_at: string
  }> = []
  for (const line of woLinesRes.data ?? []) {
    const li = line as {
      id: string
      work_order_id: string
      line_total_cents: number
      created_at: string
    }
    const meta = woMap.get(li.work_order_id)
    const cost = (Number(li.line_total_cents) || 0) / 100
    woCost += cost
    woHits.push({
      id: li.id,
      work_order_id: li.work_order_id,
      work_order_number: meta?.work_order_number ?? null,
      title: meta?.title ?? "Work order",
      line_cost: cost,
      created_at: li.created_at,
    })
  }

  const dates: string[] = [
    ...quoteHits.map((q) => q.created_at),
    ...invoiceHits.map((i) => i.issued_at),
    ...poHits.map((p) => p.order_date).filter((d): d is string => Boolean(d)),
    ...woHits.map((w) => w.created_at),
  ]
  const lastUsed = dates.length > 0 ? dates.sort().reverse()[0]! : null

  const lifetimeCost = woCost + poCost

  return NextResponse.json({
    usage: {
      quotes: quoteHits,
      invoices: invoiceHits,
      purchase_orders: poHits,
      work_orders: woHits,
      last_used_at: lastUsed,
      lifetime_revenue: lifetimeRevenue,
      lifetime_cost: lifetimeCost,
    },
  })
}

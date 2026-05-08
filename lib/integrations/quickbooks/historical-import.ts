import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { qbFetchJson, qbSqlEscape } from "@/lib/integrations/quickbooks/api"
import { getQuickBooksConnection } from "@/lib/integrations/quickbooks/connection"
import { readQuickBooksFaultMessage } from "@/lib/integrations/quickbooks/qb-fault"
import { resolveImportStrategy } from "@/lib/migration-imports/strategy"
import type { MigrationImportStrategy, RowOutcome } from "@/lib/migration-imports/types"

export type QuickBooksHistoricalEntity = "customers" | "items" | "invoices"

export type QuickBooksHistoricalImportOptions = {
  entities: QuickBooksHistoricalEntity[]
  invoiceStartDate?: string | null
  invoiceEndDate?: string | null
  strategy?: MigrationImportStrategy
}

type QbQueryResponse<T> = {
  QueryResponse?: {
    Customer?: T[]
    Item?: T[]
    Invoice?: T[]
    maxResults?: number
    startPosition?: number
  }
}

type QbRef = { value?: string; name?: string }
type QbAddress = {
  Line1?: string
  Line2?: string
  City?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
  Country?: string
}
type QbCustomer = {
  Id: string
  SyncToken?: string
  DisplayName?: string
  CompanyName?: string
  PrimaryEmailAddr?: { Address?: string }
  PrimaryPhone?: { FreeFormNumber?: string }
  BillAddr?: QbAddress
  ShipAddr?: QbAddress
  Active?: boolean
  Notes?: string
  Balance?: number
}
type QbItem = {
  Id: string
  SyncToken?: string
  Name?: string
  Type?: string
  Description?: string
  UnitPrice?: number
  IncomeAccountRef?: QbRef
  Active?: boolean
}
type QbInvoice = {
  Id: string
  SyncToken?: string
  DocNumber?: string
  CustomerRef?: QbRef
  TxnDate?: string
  DueDate?: string
  Balance?: number
  TotalAmt?: number
  BillAddr?: QbAddress
  ShipAddr?: QbAddress
  Line?: Array<Record<string, unknown>>
  LinkedTxn?: Array<Record<string, unknown>>
  PrivateNote?: string
  CustomerMemo?: { value?: string }
  EmailStatus?: string
}

type ExistingMapping = {
  internal_id: string
  external_id: string
  entity_type: "customer" | "catalog_item" | "invoice"
}

type PreviewBucket = {
  total: number
  likelyNew: number
  likelyMatched: number
  likelySkipped: number
  warnings: string[]
}

export type QuickBooksHistoricalPreview = {
  connected: boolean
  strategy: MigrationImportStrategy
  dateRange: { start: string | null; end: string | null }
  breakdown: Record<QuickBooksHistoricalEntity, PreviewBucket>
  warnings: string[]
  sample: Array<{ entity: QuickBooksHistoricalEntity; label: string; status: string; reason: string }>
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function dateLiteral(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return value.slice(0, 10)
}

function addressLine(a: QbAddress | undefined): string | null {
  if (!a) return null
  return [
    a.Line1,
    a.Line2,
    [a.City, a.CountrySubDivisionCode, a.PostalCode].filter(Boolean).join(" "),
    a.Country,
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ") || null
}

function invoiceStatus(inv: QbInvoice): "paid" | "unpaid" | "overdue" {
  const balance = Number(inv.Balance ?? 0)
  if (balance <= 0) return "paid"
  const due = inv.DueDate ? new Date(inv.DueDate).getTime() : 0
  if (due && due < Date.now()) return "overdue"
  return "unpaid"
}

function lineItems(inv: QbInvoice) {
  return (inv.Line ?? [])
    .map((line) => {
      const detail = (line.SalesItemLineDetail ?? {}) as Record<string, unknown>
      const qty = Number(detail.Qty ?? 1) || 1
      const unit = Number(detail.UnitPrice ?? 0) || 0
      const description = clean(line.Description) || clean((detail.ItemRef as QbRef | undefined)?.name) || "QuickBooks line item"
      return { description, qty, unit }
    })
    .filter((line) => line.description)
}

function normalizeOptions(input: QuickBooksHistoricalImportOptions): Required<Pick<QuickBooksHistoricalImportOptions, "entities">> & QuickBooksHistoricalImportOptions {
  const allowed = new Set<QuickBooksHistoricalEntity>(["customers", "items", "invoices"])
  const entities = (input.entities ?? []).filter((e) => allowed.has(e))
  return {
    ...input,
    entities: entities.length ? entities : ["customers", "items", "invoices"],
    strategy: resolveImportStrategy({ strategy: input.strategy }),
    invoiceStartDate: dateLiteral(input.invoiceStartDate),
    invoiceEndDate: dateLiteral(input.invoiceEndDate),
  }
}

async function qbQueryAll<T>(
  svc: SupabaseClient,
  organizationId: string,
  sql: string,
  key: "Customer" | "Item" | "Invoice",
): Promise<T[]> {
  const conn = await getQuickBooksConnection(svc, organizationId)
  if ("error" in conn) throw new Error(conn.error)
  const out: T[] = []
  for (let start = 1; start <= 1000; start += 100) {
    const pageSql = `${sql} STARTPOSITION ${start} MAXRESULTS 100`
    const res = await qbFetchJson<QbQueryResponse<T>>({
      realmId: conn.realmId,
      accessToken: conn.accessToken,
      method: "GET",
      resourcePath: "query",
      searchParams: { query: pageSql },
    })
    if (!res.ok) throw new Error(readQuickBooksFaultMessage(res.data) || res.rawText || `QuickBooks API error ${res.status}`)
    const rows = res.data?.QueryResponse?.[key] ?? []
    out.push(...rows)
    if (rows.length < 100) break
  }
  return out
}

async function loadQuickBooksData(svc: SupabaseClient, organizationId: string, options: QuickBooksHistoricalImportOptions) {
  const opts = normalizeOptions(options)
  const [customers, items, invoices] = await Promise.all([
    opts.entities.includes("customers")
      ? qbQueryAll<QbCustomer>(svc, organizationId, "select * from Customer", "Customer")
      : Promise.resolve([]),
    opts.entities.includes("items")
      ? qbQueryAll<QbItem>(svc, organizationId, "select * from Item", "Item")
      : Promise.resolve([]),
    opts.entities.includes("invoices")
      ? qbQueryAll<QbInvoice>(
          svc,
          organizationId,
          [
            "select * from Invoice",
            opts.invoiceStartDate ? `where TxnDate >= '${qbSqlEscape(opts.invoiceStartDate)}'` : "",
            opts.invoiceEndDate ? `${opts.invoiceStartDate ? "and" : "where"} TxnDate <= '${qbSqlEscape(opts.invoiceEndDate)}'` : "",
          ].filter(Boolean).join(" "),
          "Invoice",
        )
      : Promise.resolve([]),
  ])
  return { opts, customers, items, invoices }
}

async function mappings(svc: SupabaseClient, organizationId: string) {
  const { data } = await svc
    .from("external_sync_mappings")
    .select("internal_id, external_id, entity_type")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .in("entity_type", ["customer", "catalog_item", "invoice"])
  const byExternal = new Map<string, ExistingMapping>()
  for (const row of (data ?? []) as ExistingMapping[]) {
    byExternal.set(`${row.entity_type}:${row.external_id}`, row)
  }
  return byExternal
}

export async function previewQuickBooksHistoricalImport(
  svc: SupabaseClient,
  organizationId: string,
  options: QuickBooksHistoricalImportOptions,
): Promise<QuickBooksHistoricalPreview> {
  const { opts, customers, items, invoices } = await loadQuickBooksData(svc, organizationId, options)
  const mapByExternal = await mappings(svc, organizationId)
  const breakdown: QuickBooksHistoricalPreview["breakdown"] = {
    customers: { total: customers.length, likelyNew: 0, likelyMatched: 0, likelySkipped: 0, warnings: [] },
    items: { total: items.length, likelyNew: 0, likelyMatched: 0, likelySkipped: 0, warnings: [] },
    invoices: { total: invoices.length, likelyNew: 0, likelyMatched: 0, likelySkipped: 0, warnings: [] },
  }
  const sample: QuickBooksHistoricalPreview["sample"] = []

  for (const c of customers) {
    const matched = mapByExternal.has(`customer:${c.Id}`)
    breakdown.customers[matched ? "likelyMatched" : "likelyNew"] += 1
    if (matched) breakdown.customers.likelySkipped += opts.strategy === "skip_duplicates" ? 1 : 0
    if (sample.length < 12) sample.push({ entity: "customers", label: c.DisplayName || c.CompanyName || c.Id, status: matched ? "matched" : "new", reason: matched ? "QuickBooks ID mapping exists" : "No QuickBooks mapping found" })
  }
  for (const it of items) {
    const matched = mapByExternal.has(`catalog_item:${it.Id}`)
    breakdown.items[matched ? "likelyMatched" : "likelyNew"] += 1
    if (matched) breakdown.items.likelySkipped += opts.strategy === "skip_duplicates" ? 1 : 0
    if (sample.length < 12) sample.push({ entity: "items", label: it.Name || it.Id, status: matched ? "matched" : "new", reason: matched ? "QuickBooks ID mapping exists" : "No QuickBooks mapping found" })
  }
  for (const inv of invoices) {
    const matched = mapByExternal.has(`invoice:${inv.Id}`)
    breakdown.invoices[matched ? "likelyMatched" : "likelyNew"] += 1
    if (matched) breakdown.invoices.likelySkipped += opts.strategy === "skip_duplicates" ? 1 : 0
    if (sample.length < 12) sample.push({ entity: "invoices", label: inv.DocNumber || inv.Id, status: matched ? "matched" : "new", reason: matched ? "QuickBooks ID mapping exists" : "No QuickBooks mapping found" })
  }

  return {
    connected: true,
    strategy: opts.strategy ?? "skip_duplicates",
    dateRange: { start: opts.invoiceStartDate ?? null, end: opts.invoiceEndDate ?? null },
    breakdown,
    warnings: invoices.length >= 1000 ? ["Invoice preview is capped at 1,000 QuickBooks rows for this phase. Narrow the date range for larger histories."] : [],
    sample,
  }
}

async function upsertMapping(params: {
  svc: SupabaseClient
  organizationId: string
  entityType: "customer" | "catalog_item" | "invoice"
  internalId: string
  externalId: string
  syncToken?: string | null
  snapshot: unknown
  importJobId: string
  status: "matched" | "created" | "updated" | "skipped" | "error"
}) {
  const now = new Date().toISOString()
  await params.svc.from("external_sync_mappings").upsert(
    {
      organization_id: params.organizationId,
      provider: "quickbooks_online",
      entity_type: params.entityType,
      internal_id: params.internalId,
      external_id: params.externalId,
      sync_status: "synced",
      last_synced_at: now,
      imported_at: now,
      import_job_id: params.importJobId,
      mapping_status: params.status,
      mapping_confidence: 1,
      metadata: {
        source: "quickbooks_historical_import",
        sync_token: params.syncToken ?? null,
        raw_snapshot: params.snapshot,
      },
      updated_at: now,
    },
    { onConflict: "organization_id,provider,entity_type,internal_id" },
  )
}

export async function commitQuickBooksHistoricalImport(args: {
  svc: SupabaseClient
  organizationId: string
  userId: string
  importJobId: string
  options: QuickBooksHistoricalImportOptions
}) {
  const { svc, organizationId, importJobId } = args
  const { opts, customers, items, invoices } = await loadQuickBooksData(svc, organizationId, args.options)
  const strategy = opts.strategy ?? "skip_duplicates"
  const mapByExternal = await mappings(svc, organizationId)
  const outcomes: RowOutcome[] = []
  let rowIndex = 0
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  const customerByQbId = new Map<string, string>()

  for (const c of customers) {
    rowIndex += 1
    const label = c.DisplayName || c.CompanyName || c.Id
    const existingMap = mapByExternal.get(`customer:${c.Id}`)
    if (existingMap && strategy === "skip_duplicates") {
      skippedCount += 1
      customerByQbId.set(c.Id, existingMap.internal_id)
      outcomes.push({ rowIndex, status: "skipped", codes: ["existing_quickbooks_mapping"], message: "Skipped existing QuickBooks customer mapping.", entityKind: "customer", entityId: existingMap.internal_id, matchedLabel: label })
      continue
    }
    let internalId = existingMap?.internal_id ?? null
    if (!internalId) {
      const { data: byName } = await svc.from("customers").select("id").eq("organization_id", organizationId).ilike("company_name", label).maybeSingle()
      internalId = (byName as { id?: string } | null)?.id ?? null
    }
    if (internalId) {
      if (strategy === "update_existing") {
        await svc.from("customers").update({
          company_name: label,
          external_code: c.Id,
          billing_email: c.PrimaryEmailAddr?.Address ?? null,
          billing_contact_phone: c.PrimaryPhone?.FreeFormNumber ?? null,
          billing_address_line1: c.BillAddr?.Line1 ?? null,
          billing_address_line2: c.BillAddr?.Line2 ?? null,
          billing_city: c.BillAddr?.City ?? null,
          billing_state: c.BillAddr?.CountrySubDivisionCode ?? null,
          billing_postal_code: c.BillAddr?.PostalCode ?? null,
          notes: [c.Notes, c.Balance != null ? `QuickBooks historical balance: ${c.Balance}` : null].filter(Boolean).join("\n\n") || null,
        }).eq("organization_id", organizationId).eq("id", internalId)
        updatedCount += 1
      } else {
        skippedCount += 1
      }
      customerByQbId.set(c.Id, internalId)
      await upsertMapping({ svc, organizationId, entityType: "customer", internalId, externalId: c.Id, syncToken: c.SyncToken, snapshot: c, importJobId, status: strategy === "update_existing" ? "updated" : "matched" })
      outcomes.push({ rowIndex, status: strategy === "update_existing" ? "updated" : "skipped", codes: ["matched_customer"], message: strategy === "update_existing" ? "Updated from QuickBooks customer." : "Matched existing customer.", entityKind: "customer", entityId: internalId, matchedLabel: label })
      continue
    }
    const { data: inserted, error } = await svc.from("customers").insert({
      organization_id: organizationId,
      company_name: label,
      external_code: c.Id,
      status: c.Active === false ? "inactive" : "active",
      billing_email: c.PrimaryEmailAddr?.Address ?? null,
      billing_contact_phone: c.PrimaryPhone?.FreeFormNumber ?? null,
      billing_address_line1: c.BillAddr?.Line1 ?? null,
      billing_address_line2: c.BillAddr?.Line2 ?? null,
      billing_city: c.BillAddr?.City ?? null,
      billing_state: c.BillAddr?.CountrySubDivisionCode ?? null,
      billing_postal_code: c.BillAddr?.PostalCode ?? null,
      notes: [c.Notes, c.Balance != null ? `QuickBooks historical balance: ${c.Balance}` : null].filter(Boolean).join("\n\n") || null,
    }).select("id").maybeSingle()
    if (error || !inserted) {
      errorCount += 1
      outcomes.push({ rowIndex, status: "error", codes: ["customer_insert_failed"], message: error?.message ?? "Could not create customer.", matchedLabel: label })
      continue
    }
    internalId = (inserted as { id: string }).id
    customerByQbId.set(c.Id, internalId)
    createdCount += 1
    await upsertMapping({ svc, organizationId, entityType: "customer", internalId, externalId: c.Id, syncToken: c.SyncToken, snapshot: c, importJobId, status: "created" })
    outcomes.push({ rowIndex, status: "imported", codes: [], message: "Created customer from QuickBooks.", entityKind: "customer", entityId: internalId, matchedLabel: label })
  }

  for (const item of items) {
    rowIndex += 1
    const label = item.Name || item.Id
    const existingMap = mapByExternal.get(`catalog_item:${item.Id}`)
    if (existingMap && strategy === "skip_duplicates") {
      skippedCount += 1
      outcomes.push({ rowIndex, status: "skipped", codes: ["existing_quickbooks_mapping"], message: "Skipped existing QuickBooks item mapping.", entityKind: "catalog_item", entityId: existingMap.internal_id, matchedLabel: label })
      continue
    }
    let internalId = existingMap?.internal_id ?? null
    if (!internalId) {
      const { data: byName } = await svc.from("catalog_items").select("id").eq("organization_id", organizationId).ilike("name", label).maybeSingle()
      internalId = (byName as { id?: string } | null)?.id ?? null
    }
    if (internalId) {
      if (strategy === "update_existing") {
        await svc.from("catalog_items").update({ name: label, description: item.Description ?? null, sale_price: item.UnitPrice ?? null, list_price: item.UnitPrice ?? null, status: item.Active === false ? "inactive" : "active" }).eq("organization_id", organizationId).eq("id", internalId)
        updatedCount += 1
      } else {
        skippedCount += 1
      }
      await upsertMapping({ svc, organizationId, entityType: "catalog_item", internalId, externalId: item.Id, syncToken: item.SyncToken, snapshot: item, importJobId, status: strategy === "update_existing" ? "updated" : "matched" })
      outcomes.push({ rowIndex, status: strategy === "update_existing" ? "updated" : "skipped", codes: ["matched_item"], message: strategy === "update_existing" ? "Updated from QuickBooks item." : "Matched existing item.", entityKind: "catalog_item", entityId: internalId, matchedLabel: label })
      continue
    }
    const { data: inserted, error } = await svc.from("catalog_items").insert({ organization_id: organizationId, name: label, sku: item.Id, item_type: item.Type === "Service" ? "service" : "other", description: item.Description ?? null, sale_price: item.UnitPrice ?? null, list_price: item.UnitPrice ?? null, status: item.Active === false ? "inactive" : "active", source_file_name: "QuickBooks historical import", notes: item.IncomeAccountRef?.name ? `QuickBooks income account: ${item.IncomeAccountRef.name}` : null }).select("id").maybeSingle()
    if (error || !inserted) {
      errorCount += 1
      outcomes.push({ rowIndex, status: "error", codes: ["item_insert_failed"], message: error?.message ?? "Could not create item.", matchedLabel: label })
      continue
    }
    internalId = (inserted as { id: string }).id
    createdCount += 1
    await upsertMapping({ svc, organizationId, entityType: "catalog_item", internalId, externalId: item.Id, syncToken: item.SyncToken, snapshot: item, importJobId, status: "created" })
    outcomes.push({ rowIndex, status: "imported", codes: [], message: "Created catalog item from QuickBooks.", entityKind: "catalog_item", entityId: internalId, matchedLabel: label })
  }

  for (const inv of invoices) {
    rowIndex += 1
    const label = inv.DocNumber || inv.Id
    const existingMap = mapByExternal.get(`invoice:${inv.Id}`)
    if (existingMap && strategy === "skip_duplicates") {
      skippedCount += 1
      outcomes.push({ rowIndex, status: "skipped", codes: ["existing_quickbooks_mapping"], message: "Skipped existing QuickBooks invoice mapping.", entityKind: "invoice", entityId: existingMap.internal_id, matchedLabel: label })
      continue
    }
    const customerId = inv.CustomerRef?.value ? (customerByQbId.get(inv.CustomerRef.value) ?? mapByExternal.get(`customer:${inv.CustomerRef.value}`)?.internal_id ?? null) : null
    if (!customerId) {
      errorCount += 1
      outcomes.push({ rowIndex, status: "error", codes: ["customer_not_found"], message: "Invoice customer was not imported or mapped.", matchedLabel: label })
      continue
    }
    const existingByNumber = label ? await svc.from("org_invoices").select("id").eq("organization_id", organizationId).eq("invoice_number", label).maybeSingle() : { data: null }
    let internalId = existingMap?.internal_id ?? ((existingByNumber.data as { id?: string } | null)?.id ?? null)
    if (internalId) {
      if (strategy === "update_existing") {
        await svc.from("org_invoices").update({ status: invoiceStatus(inv), amount_cents: Math.round(Number(inv.TotalAmt ?? 0) * 100), due_date: inv.DueDate ?? null, paid_at: invoiceStatus(inv) === "paid" ? inv.TxnDate ?? null : null, notes: inv.CustomerMemo?.value ?? null, internal_notes: [inv.PrivateNote, "Historical QuickBooks import — auto-sync back to QuickBooks skipped."].filter(Boolean).join("\n\n") }).eq("organization_id", organizationId).eq("id", internalId)
        updatedCount += 1
      } else {
        skippedCount += 1
      }
      await upsertMapping({ svc, organizationId, entityType: "invoice", internalId, externalId: inv.Id, syncToken: inv.SyncToken, snapshot: inv, importJobId, status: strategy === "update_existing" ? "updated" : "matched" })
      outcomes.push({ rowIndex, status: strategy === "update_existing" ? "updated" : "skipped", codes: ["matched_invoice"], message: strategy === "update_existing" ? "Updated from QuickBooks invoice." : "Matched existing invoice.", entityKind: "invoice", entityId: internalId, matchedLabel: label })
      continue
    }
    const issuedAt = inv.TxnDate ?? new Date().toISOString().slice(0, 10)
    const { data: inserted, error } = await svc.from("org_invoices").insert({
      organization_id: organizationId,
      customer_id: customerId,
      seed_key: `${importJobId}-qb-${inv.Id}`,
      invoice_number: label,
      title: `QuickBooks invoice ${label}`,
      amount_cents: Math.round(Number(inv.TotalAmt ?? 0) * 100),
      status: invoiceStatus(inv),
      issued_at: issuedAt,
      due_date: inv.DueDate ?? issuedAt,
      paid_at: invoiceStatus(inv) === "paid" ? issuedAt : null,
      line_items: lineItems(inv),
      notes: inv.CustomerMemo?.value ?? null,
      internal_notes: [
        "Historical QuickBooks import — auto-sync back to QuickBooks skipped.",
        inv.PrivateNote ? `QuickBooks private note: ${inv.PrivateNote}` : null,
        inv.EmailStatus ? `QuickBooks email status: ${inv.EmailStatus}` : null,
        inv.LinkedTxn?.length ? `QuickBooks linked transactions preserved in mapping snapshot.` : null,
        addressLine(inv.BillAddr) ? `QuickBooks bill-to: ${addressLine(inv.BillAddr)}` : null,
      ].filter(Boolean).join("\n\n"),
    }).select("id").maybeSingle()
    if (error || !inserted) {
      errorCount += 1
      outcomes.push({ rowIndex, status: "error", codes: ["invoice_insert_failed"], message: error?.message ?? "Could not create invoice.", matchedLabel: label })
      continue
    }
    internalId = (inserted as { id: string }).id
    createdCount += 1
    await upsertMapping({ svc, organizationId, entityType: "invoice", internalId, externalId: inv.Id, syncToken: inv.SyncToken, snapshot: inv, importJobId, status: "created" })
    outcomes.push({ rowIndex, status: "imported", codes: [], message: "Created historical invoice from QuickBooks.", entityKind: "invoice", entityId: internalId, matchedLabel: label })
  }

  return { createdCount, updatedCount, skippedCount, errorCount, outcomes }
}

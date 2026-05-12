import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { sanitizeQuickBooksClientMessage } from "@/lib/integrations/quickbooks/safe-log"
import { invoiceStatusDbToUi, parseLineItems } from "@/lib/org-quotes-invoices/map"
import type { PrepareQuickBooksInvoiceSyncPreviewPayload } from "@/lib/aiden/actions/resolvers/prepare-quickbooks-invoice-sync-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ResolvePrepareQuickBooksInvoiceSyncInput = {
  organizationId: string
  invoiceId: string
}

export type ResolvePrepareQuickBooksInvoiceSyncResult =
  | { status: "prepared"; preview: PrepareQuickBooksInvoiceSyncPreviewPayload }
  | { status: "failed"; reason: string }

/**
 * Read-only preview for QuickBooks invoice export. Does not call QuickBooks APIs or mutate mappings.
 */
export async function resolvePrepareQuickBooksInvoiceSyncPreview(
  userSupabase: SupabaseClient,
  input: ResolvePrepareQuickBooksInvoiceSyncInput,
): Promise<ResolvePrepareQuickBooksInvoiceSyncResult> {
  const orgId = input.organizationId.trim()
  const invoiceId = input.invoiceId.trim()
  if (!UUID_RE.test(orgId) || !UUID_RE.test(invoiceId)) {
    return { status: "failed", reason: "Invalid organization or invoice id." }
  }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return { status: "failed", reason: "Server is not configured for integration checks." }
  }

  const { data: inv, error: invErr } = await userSupabase
    .from("org_invoices")
    .select(
      "id, organization_id, customer_id, invoice_number, title, amount_cents, status, archived_at, line_items, paid_at",
    )
    .eq("organization_id", orgId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invErr) {
    return { status: "failed", reason: invErr.message }
  }
  if (!inv) {
    return { status: "failed", reason: "Invoice was not found or is not accessible." }
  }

  const row = inv as {
    id: string
    customer_id: string
    invoice_number: string
    title: string
    amount_cents: number
    status: string
    archived_at: string | null
    line_items: unknown
    paid_at: string | null
  }

  if (row.archived_at) {
    return { status: "failed", reason: "Archived invoices cannot be synced to QuickBooks." }
  }

  const { data: cust, error: custErr } = await userSupabase
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", orgId)
    .eq("id", row.customer_id)
    .maybeSingle()

  if (custErr || !cust) {
    return { status: "failed", reason: "Customer for this invoice was not found." }
  }

  const { data: integ } = await admin
    .from("organization_integrations")
    .select(
      "connection_status, last_successful_sync_at, last_sync_attempt_at, sync_health, last_sync_error",
    )
    .eq("organization_id", orgId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  const connSt = String((integ as { connection_status?: string } | null)?.connection_status ?? "").trim()
  const connected = connSt === "connected"
  const connectionNeedsAttention = connSt === "error"
  const disconnected = !integ || connSt === "disconnected" || connSt === "revoked" || connSt === ""

  let qbStatus: PrepareQuickBooksInvoiceSyncPreviewPayload["qbConnection"]["status"] = "unknown"
  if (connected) qbStatus = "connected"
  else if (connectionNeedsAttention) qbStatus = "error"
  else if (disconnected) qbStatus = "disconnected"

  const lastErrRaw = (integ as { last_sync_error?: string | null })?.last_sync_error ?? null
  const lastSyncErrorSafe =
    typeof lastErrRaw === "string" ? sanitizeQuickBooksClientMessage(lastErrRaw, 500) : null

  const { data: custMap } = await admin
    .from("external_sync_mappings")
    .select("external_id, sync_status")
    .eq("organization_id", orgId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "customer")
    .eq("internal_id", row.customer_id)
    .maybeSingle()

  const customerMappedToQuickBooks = Boolean(
    custMap && typeof (custMap as { external_id?: string }).external_id === "string",
  )

  const { data: catMaps } = await admin
    .from("external_sync_mappings")
    .select("internal_id")
    .eq("organization_id", orgId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "catalog_item")

  const catIds = new Set(
    (catMaps ?? []).map((m) => String((m as { internal_id: string }).internal_id).trim()).filter(Boolean),
  )

  const lines = parseLineItems(row.line_items)
  let unmappedCatalogLineCount = 0
  for (const ln of lines) {
    const cid = ln.catalog_item_id?.trim()
    if (cid && !catIds.has(cid)) unmappedCatalogLineCount += 1
  }

  const totalCents = Math.round(Number(row.amount_cents) || 0)
  const hasBillableLines = lines.length > 0 || totalCents > 0
  const hasRenderableLines = lines.length > 0 ? lines.some((ln) => Math.round(ln.qty * ln.unit * 100) > 0 || ln.description.trim()) : totalCents > 0

  const { data: invMap } = await admin
    .from("external_sync_mappings")
    .select("external_id, sync_status, last_synced_at")
    .eq("organization_id", orgId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "invoice")
    .eq("internal_id", invoiceId)
    .maybeSingle()

  const existingInvoiceMapping = invMap
    ? {
        syncStatus: String((invMap as { sync_status?: string }).sync_status ?? ""),
        lastSyncedAt: ((invMap as { last_synced_at?: string | null }).last_synced_at ?? null) as string | null,
        quickBooksInvoiceId: String((invMap as { external_id?: string }).external_id ?? "").trim() || null,
      }
    : null

  const statusUi = invoiceStatusDbToUi(String(row.status ?? ""))
  const paidLike = Boolean(row.paid_at) || row.status === "paid" || row.status === "void"

  const warnings: string[] = []
  if (unmappedCatalogLineCount > 0) {
    warnings.push(
      `${unmappedCatalogLineCount} invoice line(s) reference catalog items that are not mapped to QuickBooks yet — export will use your miscellaneous service item for those lines.`,
    )
  }
  if (connectionNeedsAttention) {
    warnings.push("QuickBooks connection needs attention — open Settings → Integrations → QuickBooks before syncing.")
  }
  if (existingInvoiceMapping?.syncStatus === "stale") {
    warnings.push("Last sync marked this invoice as stale in QuickBooks (often due to payments in QBO). Export may be skipped until resolved.")
  }

  let whatWillSyncSummary = ""
  if (paidLike) {
    whatWillSyncSummary = "This invoice is paid or void — QuickBooks invoice export is skipped for paid/void invoices."
  } else if (!connected) {
    whatWillSyncSummary = disconnected
      ? "Connect QuickBooks in Settings, then run sync again."
      : "QuickBooks is not in a connected state — resolve connection issues first."
  } else if (!customerMappedToQuickBooks) {
    whatWillSyncSummary = "Run a QuickBooks customer sync (or map this customer) before invoices can export."
  } else if (!hasBillableLines || !hasRenderableLines) {
    whatWillSyncSummary = "This invoice has no billable lines for QuickBooks (empty lines and zero total)."
  } else if (existingInvoiceMapping?.quickBooksInvoiceId) {
    whatWillSyncSummary =
      "QuickBooks will receive an update to the existing mapped invoice when rules allow (duplicate-safe updates)."
  } else {
    whatWillSyncSummary = "QuickBooks will receive a new invoice with your line items (catalog lines use mapped items when available)."
  }

  let readiness: PrepareQuickBooksInvoiceSyncPreviewPayload["readiness"] = "ready"
  if (paidLike || !hasBillableLines || !hasRenderableLines || !connected || !customerMappedToQuickBooks) {
    readiness = "blocked"
  } else if (connectionNeedsAttention || unmappedCatalogLineCount > 0 || existingInvoiceMapping?.syncStatus === "stale") {
    readiness = "degraded"
  }

  const preview: PrepareQuickBooksInvoiceSyncPreviewPayload = {
    invoiceId: row.id,
    invoice: {
      id: row.id,
      invoiceNumber: String(row.invoice_number ?? ""),
      title: String(row.title ?? ""),
      statusUi: String(statusUi),
      amountCents: totalCents,
    },
    customer: { id: String(cust.id), companyName: String(cust.company_name ?? "Customer") },
    qbConnection: {
      status: qbStatus,
      connectionNeedsAttention,
      lastSuccessfulSyncAt: (integ as { last_successful_sync_at?: string | null })?.last_successful_sync_at ?? null,
      lastSyncAttemptAt: (integ as { last_sync_attempt_at?: string | null })?.last_sync_attempt_at ?? null,
      syncHealth: (integ as { sync_health?: string | null })?.sync_health ?? null,
      lastSyncError: lastSyncErrorSafe,
    },
    existingInvoiceMapping,
    customerMappedToQuickBooks,
    unmappedCatalogLineCount,
    whatWillSyncSummary,
    readiness,
    warnings,
  }

  return { status: "prepared", preview }
}

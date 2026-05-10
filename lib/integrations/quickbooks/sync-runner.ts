import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getQuickBooksConnection } from "@/lib/integrations/quickbooks/connection"
import { syncCustomersToQuickBooks } from "@/lib/integrations/quickbooks/customer-sync"
import { syncCatalogItemsToQuickBooks } from "@/lib/integrations/quickbooks/catalog-sync"
import { syncInvoicesToQuickBooks } from "@/lib/integrations/quickbooks/invoice-sync"
import { reconcileQuickBooksInvoiceInboundStatuses } from "@/lib/integrations/quickbooks/invoice-inbound-reconcile"

export type QuickBooksExportSyncKind = "customers" | "catalog_items" | "invoices" | "full_initial"

export type QuickBooksSyncRunResult =
  | {
      ok: true
      syncLogId: string
      status: "success" | "partial" | "failed"
      recordsAttempted: number
      recordsSucceeded: number
      errorMessage: string | null
      detail: Record<string, unknown>
    }
  | { ok: false; error: string; code?: string }

export async function runQuickBooksExportSync(params: {
  svc: SupabaseClient
  organizationId: string
  kind: QuickBooksExportSyncKind
}): Promise<QuickBooksSyncRunResult> {
  const conn = await getQuickBooksConnection(params.svc, params.organizationId)
  if ("error" in conn) {
    return { ok: false, error: conn.error, code: conn.code }
  }

  const onUnauthorized = async (): Promise<string | null> => {
    const again = await getQuickBooksConnection(params.svc, params.organizationId)
    return "error" in again ? null : again.accessToken
  }

  const syncKindDb =
    params.kind === "full_initial"
      ? "full_initial"
      : params.kind === "customers"
        ? "customers"
        : params.kind === "catalog_items"
          ? "catalog_items"
          : "invoices"

  const startedAt = new Date().toISOString()
  const { data: logRow, error: logInsErr } = await params.svc
    .from("quickbooks_sync_logs")
    .insert({
      organization_id: params.organizationId,
      sync_kind: syncKindDb,
      direction: "export",
      status: "started",
      records_attempted: 0,
      records_succeeded: 0,
      detail: { phases: [] },
      started_at: startedAt,
    })
    .select("id")
    .single()

  if (logInsErr || !logRow?.id) {
    return { ok: false, error: logInsErr?.message ?? "Could not create sync log.", code: "log_insert_failed" }
  }

  const logId = logRow.id as string

  const baseArgs = {
    svc: params.svc,
    organizationId: params.organizationId,
    realmId: conn.realmId,
    accessToken: conn.accessToken,
    onUnauthorized,
  }

  type PhaseResult = Awaited<ReturnType<typeof syncCustomersToQuickBooks>>

  const phases: Array<{ key: string; label: string; result: PhaseResult }> = []

  try {
    if (params.kind === "full_initial" || params.kind === "customers") {
      const result = await syncCustomersToQuickBooks(baseArgs)
      phases.push({ key: "customers", label: "Customers", result })
    }

    if (params.kind === "full_initial" || params.kind === "catalog_items") {
      const result = await syncCatalogItemsToQuickBooks(baseArgs)
      phases.push({ key: "catalog_items", label: "Catalog items", result })
    }

    if (params.kind === "full_initial" || params.kind === "invoices") {
      const result = await syncInvoicesToQuickBooks({
        ...baseArgs,
        integrationId: conn.integrationId,
      })
      phases.push({ key: "invoices", label: "Invoices", result })
    }

    let attempted = 0
    let succeeded = 0
    const errors: Array<{ phase: string; internalId: string; message: string }> = []

    for (const p of phases) {
      attempted += p.result.attempted
      succeeded += p.result.succeeded
      for (const e of p.result.errors) {
        errors.push({ phase: p.key, internalId: e.internalId, message: e.message })
      }
    }

    const status: "success" | "partial" | "failed" =
      errors.length === 0 ? "success" : succeeded > 0 ? "partial" : "failed"

    const errorMessage =
      errors.length === 0
        ? null
        : succeeded > 0
          ? `${errors.length} record error(s) — see sync detail.`
          : errors[0]?.message.slice(0, 900) ?? "QuickBooks sync failed."

    const completedAt = new Date().toISOString()

    const detail = {
      phases: phases.map((p) => ({
        kind: p.key,
        label: p.label,
        attempted: p.result.attempted,
        succeeded: p.result.succeeded,
        errorCount: p.result.errors.filter((x) => x.internalId !== "_").length,
      })),
      errors: errors.slice(0, 80),
    }

    await params.svc
      .from("quickbooks_sync_logs")
      .update({
        status,
        records_attempted: attempted,
        records_succeeded: succeeded,
        error_message: errorMessage,
        detail,
        completed_at: completedAt,
      })
      .eq("id", logId)

    const syncHealth =
      status === "failed" ? "error" : status === "partial" ? "degraded" : "healthy"

    await params.svc
      .from("organization_integrations")
      .update({
        last_sync_attempt_at: completedAt,
        ...(succeeded > 0 ? { last_successful_sync_at: completedAt } : {}),
        sync_health: syncHealth,
        last_sync_error: errorMessage,
        updated_at: completedAt,
      })
      .eq("organization_id", params.organizationId)
      .eq("provider", "quickbooks_online")

    return {
      ok: true,
      syncLogId: logId,
      status,
      recordsAttempted: attempted,
      recordsSucceeded: succeeded,
      errorMessage,
      detail,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const completedAt = new Date().toISOString()
    await params.svc
      .from("quickbooks_sync_logs")
      .update({
        status: "failed",
        error_message: msg.slice(0, 900),
        detail: { fatal: true, message: msg.slice(0, 900) },
        completed_at: completedAt,
      })
      .eq("id", logId)

    await params.svc
      .from("organization_integrations")
      .update({
        last_sync_attempt_at: completedAt,
        sync_health: "error",
        last_sync_error: msg.slice(0, 500),
        updated_at: completedAt,
      })
      .eq("organization_id", params.organizationId)
      .eq("provider", "quickbooks_online")

    return { ok: false, error: msg, code: "sync_exception" }
  }
}

/**
 * Import-style run: read QuickBooks invoice balances for mapped invoices and write review metadata
 * (does not change org_invoices unless a separate apply endpoint is used).
 */
export async function runQuickBooksPaymentStatusImportSync(params: {
  svc: SupabaseClient
  organizationId: string
  onlyInvoiceIds?: string[]
}): Promise<QuickBooksSyncRunResult> {
  const conn = await getQuickBooksConnection(params.svc, params.organizationId)
  if ("error" in conn) {
    return { ok: false, error: conn.error, code: conn.code }
  }

  const onUnauthorized = async (): Promise<string | null> => {
    const again = await getQuickBooksConnection(params.svc, params.organizationId)
    return "error" in again ? null : again.accessToken
  }

  const startedAt = new Date().toISOString()
  const { data: logRow, error: logInsErr } = await params.svc
    .from("quickbooks_sync_logs")
    .insert({
      organization_id: params.organizationId,
      sync_kind: "payments",
      direction: "import",
      status: "started",
      records_attempted: 0,
      records_succeeded: 0,
      detail: { phases: [] },
      started_at: startedAt,
    })
    .select("id")
    .single()

  if (logInsErr || !logRow?.id) {
    return { ok: false, error: logInsErr?.message ?? "Could not create sync log.", code: "log_insert_failed" }
  }

  const logId = logRow.id as string

  try {
    const result = await reconcileQuickBooksInvoiceInboundStatuses({
      svc: params.svc,
      organizationId: params.organizationId,
      realmId: conn.realmId,
      accessToken: conn.accessToken,
      onUnauthorized,
      onlyInvoiceIds: params.onlyInvoiceIds,
    })

    const errors = result.errors.filter((e) => e.internalId !== "_")
    const status: "success" | "partial" | "failed" =
      errors.length === 0 ? "success" : result.succeeded > 0 ? "partial" : "failed"

    const errorMessage =
      errors.length === 0
        ? null
        : result.succeeded > 0
          ? `${errors.length} invoice(s) need attention — see sync detail.`
          : errors[0]?.message.slice(0, 900) ?? "QuickBooks payment status import failed."

    const completedAt = new Date().toISOString()
    const detail = {
      phases: [
        {
          kind: "payments_import",
          label: "Payment status (QuickBooks)",
          attempted: result.attempted,
          succeeded: result.succeeded,
          errorCount: errors.length,
        },
      ],
      errors: result.errors.slice(0, 80),
    }

    await params.svc
      .from("quickbooks_sync_logs")
      .update({
        status,
        records_attempted: result.attempted,
        records_succeeded: result.succeeded,
        error_message: errorMessage,
        detail,
        completed_at: completedAt,
      })
      .eq("id", logId)

    const syncHealth =
      status === "failed" ? "error" : status === "partial" ? "degraded" : "healthy"

    await params.svc
      .from("organization_integrations")
      .update({
        last_sync_attempt_at: completedAt,
        ...(result.succeeded > 0 ? { last_successful_sync_at: completedAt } : {}),
        sync_health: syncHealth,
        last_sync_error: errorMessage,
        updated_at: completedAt,
      })
      .eq("organization_id", params.organizationId)
      .eq("provider", "quickbooks_online")

    return {
      ok: true,
      syncLogId: logId,
      status,
      recordsAttempted: result.attempted,
      recordsSucceeded: result.succeeded,
      errorMessage,
      detail,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const completedAt = new Date().toISOString()
    await params.svc
      .from("quickbooks_sync_logs")
      .update({
        status: "failed",
        error_message: msg.slice(0, 900),
        detail: { fatal: true, message: msg.slice(0, 900) },
        completed_at: completedAt,
      })
      .eq("id", logId)

    await params.svc
      .from("organization_integrations")
      .update({
        last_sync_attempt_at: completedAt,
        sync_health: "error",
        last_sync_error: msg.slice(0, 500),
        updated_at: completedAt,
      })
      .eq("organization_id", params.organizationId)
      .eq("provider", "quickbooks_online")

    return { ok: false, error: msg, code: "sync_exception" }
  }
}

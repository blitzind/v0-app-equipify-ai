import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { readInvoiceInboundSnapshot } from "@/lib/integrations/quickbooks/invoice-inbound-reconcile"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 })
  }

  const { data: integ } = await svc
    .from("organization_integrations")
    .select("connection_status, last_successful_sync_at, last_sync_attempt_at, sync_health, last_sync_error")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .maybeSingle()

  const connected = (integ as { connection_status?: string } | null)?.connection_status === "connected"

  const { data: inv } = await svc
    .from("org_invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const { data: invoiceMap } = await svc
    .from("external_sync_mappings")
    .select("external_id, sync_status, last_error, metadata, last_synced_at")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "invoice")
    .eq("internal_id", invoiceId)
    .maybeSingle()

  const { data: payRows } = await svc
    .from("org_invoice_payments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)

  const payIds = (payRows ?? []).map((r) => (r as { id: string }).id)
  let paymentMappings: Array<{
    internalId: string
    syncStatus: string
    lastError: string | null
    lastSyncedAt: string | null
  }> = []

  if (payIds.length > 0) {
    const { data: maps } = await svc
      .from("external_sync_mappings")
      .select("internal_id, sync_status, last_error, last_synced_at")
      .eq("organization_id", organizationId)
      .eq("provider", "quickbooks_online")
      .eq("entity_type", "payment")
      .in("internal_id", payIds)

    paymentMappings = (maps ?? []).map((m) => {
      const row = m as {
        internal_id: string
        sync_status: string
        last_error: string | null
        last_synced_at: string | null
      }
      return {
        internalId: row.internal_id,
        syncStatus: row.sync_status,
        lastError: row.last_error,
        lastSyncedAt: row.last_synced_at,
      }
    })
  }

  const inbound = readInvoiceInboundSnapshot((invoiceMap as { metadata?: unknown } | null)?.metadata)

  const paymentSyncById = new Map(paymentMappings.map((p) => [p.internalId, p]))
  const paymentVisibility = payIds.map((id) => {
    const row = paymentSyncById.get(id)
    return {
      paymentId: id,
      quickBooks:
        row != null
          ? { state: row.syncStatus as "pending" | "synced" | "error" | "stale", lastError: row.lastError }
          : { state: "not_tracked" as const, lastError: null as string | null },
    }
  })

  return NextResponse.json({
    connected,
    integrationHealth: connected
      ? {
          lastSuccessfulSyncAt: (integ as { last_successful_sync_at?: string | null })?.last_successful_sync_at ?? null,
          lastSyncAttemptAt: (integ as { last_sync_attempt_at?: string | null })?.last_sync_attempt_at ?? null,
          syncHealth: (integ as { sync_health?: string })?.sync_health ?? "unknown",
          lastSyncError: (integ as { last_sync_error?: string | null })?.last_sync_error ?? null,
        }
      : null,
    invoice: invoiceMap
      ? {
          quickBooksInvoiceId: (invoiceMap as { external_id: string }).external_id,
          syncStatus: (invoiceMap as { sync_status: string }).sync_status,
          lastError: (invoiceMap as { last_error: string | null }).last_error,
          lastSyncedAt: (invoiceMap as { last_synced_at: string | null }).last_synced_at,
          inbound: inbound
            ? {
                checkedAt: inbound.checkedAt,
                reviewState: inbound.reviewState,
                reviewReason: inbound.reviewReason ?? null,
                qbFullyPaid: inbound.qbFullyPaid,
                qbPartiallyPaid: inbound.qbPartiallyPaid,
                suggestApplyPaidOn: inbound.suggestApplyPaidOn ?? null,
              }
            : null,
        }
      : null,
    payments: paymentVisibility,
  })
}

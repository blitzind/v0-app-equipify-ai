import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getQuickBooksConnection } from "@/lib/integrations/quickbooks/connection"
import { syncInvoicesToQuickBooks } from "@/lib/integrations/quickbooks/invoice-sync"

/**
 * Fire-and-forget export of a single invoice when `sync_settings.auto_sync_invoices` is enabled.
 * Uses the service role client for OAuth secrets; swallows errors (logged server-side only via sync mappings).
 */
export async function triggerQuickBooksInvoiceAutoSyncIfEnabled(params: {
  organizationId: string
  invoiceId: string
}): Promise<void> {
  try {
    const svc = createServiceRoleSupabaseClient()

    const { data: int } = await svc
      .from("organization_integrations")
      .select("connection_status, sync_settings")
      .eq("organization_id", params.organizationId)
      .eq("provider", "quickbooks_online")
      .maybeSingle()

    const settings = (int?.sync_settings ?? {}) as { auto_sync_invoices?: boolean }
    if (!int || (int as { connection_status?: string }).connection_status !== "connected") return
    if (!settings.auto_sync_invoices) return

    const conn = await getQuickBooksConnection(svc, params.organizationId)
    if ("error" in conn) return

    const onUnauthorized = async (): Promise<string | null> => {
      const again = await getQuickBooksConnection(svc, params.organizationId)
      return "error" in again ? null : again.accessToken
    }

    await syncInvoicesToQuickBooks({
      svc,
      organizationId: params.organizationId,
      integrationId: conn.integrationId,
      realmId: conn.realmId,
      accessToken: conn.accessToken,
      onUnauthorized,
      onlyInvoiceIds: [params.invoiceId],
    })
  } catch {
    /* non-blocking */
  }
}

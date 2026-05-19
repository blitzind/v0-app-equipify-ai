import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { purchaseOrderBulkArchiveBlockMessage } from "@/lib/purchase-orders/bulk-archive-eligibility"
import { purchaseOrderAlreadyArchivedMessage } from "@/lib/purchase-orders/bulk-archive-messages"

export type BulkArchivePurchaseOrderResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

const DB_TO_UI_STATUS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  closed: "Closed",
}

function poStatusDbToUi(status: string): string {
  return DB_TO_UI_STATUS[String(status ?? "").toLowerCase()] ?? status
}

export async function bulkArchivePurchaseOrders(
  svc: SupabaseClient,
  organizationId: string,
  purchaseOrderIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchivePurchaseOrderResult[] }> {
  const unique = [...new Set(purchaseOrderIds)]
  const results: BulkArchivePurchaseOrderResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("org_purchase_orders")
      .select("id, archived_at, status")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Purchase order not found." })
      continue
    }

    const row = data as { id: string; archived_at: string | null; status: string }

    const already = purchaseOrderAlreadyArchivedMessage(row.archived_at)
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const block = purchaseOrderBulkArchiveBlockMessage({
      archivedAt: row.archived_at,
      status: poStatusDbToUi(row.status),
    })

    if (block) {
      results.push({ id, ok: false, message: block })
      continue
    }

    const { error: updateError } = await svc
      .from("org_purchase_orders")
      .update({
        archived_at: now,
        archived_by: actorUserId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this purchase order. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

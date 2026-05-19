import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ArchivedRecordType } from "@/lib/archived-center/types"
import { workOrderAlreadyArchivedMessage } from "@/lib/work-orders/archive-work-order-client"

export async function archiveArchivedRecord(
  admin: SupabaseClient,
  organizationId: string,
  recordType: ArchivedRecordType,
  recordId: string,
  actorUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  switch (recordType) {
    case "work_order":
      return archiveWorkOrderRecord(admin, organizationId, recordId, actorUserId)
    default:
      return { ok: false, message: "This record type cannot be archived from here." }
  }
}

async function archiveWorkOrderRecord(
  admin: SupabaseClient,
  organizationId: string,
  workOrderId: string,
  actorUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from("work_orders")
    .select("id, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, message: "Work order not found." }
  }

  const already = workOrderAlreadyArchivedMessage(
    (data as { archived_at?: string | null }).archived_at,
  )
  if (already) return { ok: false, message: already }

  const { error: updateError } = await admin
    .from("work_orders")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: actorUserId,
    })
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .is("archived_at", null)

  if (updateError) {
    return { ok: false, message: "Could not archive this work order. Try again." }
  }

  return { ok: true }
}

export type BulkArchiveWorkOrderItemResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveWorkOrders(
  admin: SupabaseClient,
  organizationId: string,
  workOrderIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchiveWorkOrderItemResult[] }> {
  const unique = [...new Set(workOrderIds)]
  const results: BulkArchiveWorkOrderItemResult[] = []
  for (const id of unique) {
    const result = await archiveWorkOrderRecord(admin, organizationId, id, actorUserId)
    results.push(result.ok ? { id, ok: true } : { id, ok: false, message: result.message })
  }
  return { results }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { customerAlreadyArchivedMessage } from "@/lib/customers/bulk-archive-messages"

export type BulkArchiveCustomerResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveCustomers(
  svc: SupabaseClient,
  organizationId: string,
  customerIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchiveCustomerResult[] }> {
  const unique = [...new Set(customerIds)]
  const results: BulkArchiveCustomerResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("customers")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Customer not found." })
      continue
    }

    const already = customerAlreadyArchivedMessage(
      (data as { archived_at?: string | null }).archived_at,
    )
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const { error: updateError } = await svc
      .from("customers")
      .update({
        archived_at: now,
        archived_by: actorUserId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this customer. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { vendorAlreadyArchivedMessage } from "@/lib/vendors/bulk-archive-messages"

export type BulkArchiveVendorResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveVendors(
  svc: SupabaseClient,
  organizationId: string,
  vendorIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchiveVendorResult[] }> {
  const unique = [...new Set(vendorIds)]
  const results: BulkArchiveVendorResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("org_vendors")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Vendor not found." })
      continue
    }

    const already = vendorAlreadyArchivedMessage(
      (data as { archived_at?: string | null }).archived_at,
    )
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const { error: updateError } = await svc
      .from("org_vendors")
      .update({
        archived_at: now,
        archived_by: actorUserId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this vendor. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { catalogItemAlreadyArchivedMessage } from "@/lib/catalog/bulk-archive-messages"

export type BulkArchiveCatalogItemResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveCatalogItems(
  svc: SupabaseClient,
  organizationId: string,
  itemIds: string[],
): Promise<{ results: BulkArchiveCatalogItemResult[] }> {
  const unique = [...new Set(itemIds)]
  const results: BulkArchiveCatalogItemResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("catalog_items")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Catalog item not found." })
      continue
    }

    const already = catalogItemAlreadyArchivedMessage(
      (data as { archived_at?: string | null }).archived_at,
    )
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const { error: updateError } = await svc
      .from("catalog_items")
      .update({ archived_at: now, updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this catalog item. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

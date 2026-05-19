import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { quoteAlreadyArchivedMessage } from "@/lib/quotes/bulk-archive-messages"

export type BulkArchiveQuoteResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveQuotes(
  svc: SupabaseClient,
  organizationId: string,
  quoteIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchiveQuoteResult[] }> {
  const unique = [...new Set(quoteIds)]
  const results: BulkArchiveQuoteResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("org_quotes")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Quote not found." })
      continue
    }

    const already = quoteAlreadyArchivedMessage(
      (data as { archived_at?: string | null }).archived_at,
    )
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const { error: updateError } = await svc
      .from("org_quotes")
      .update({
        archived_at: now,
        archived_by: actorUserId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this quote. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

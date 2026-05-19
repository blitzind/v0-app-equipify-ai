import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { prospectAlreadyArchivedMessage } from "@/lib/prospects/bulk-archive-messages"

export type BulkArchiveProspectResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveProspects(
  svc: SupabaseClient,
  organizationId: string,
  prospectIds: string[],
): Promise<{ results: BulkArchiveProspectResult[] }> {
  const unique = [...new Set(prospectIds)]
  const results: BulkArchiveProspectResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("prospects")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Prospect not found." })
      continue
    }

    const already = prospectAlreadyArchivedMessage(
      (data as { archived_at?: string | null }).archived_at,
    )
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const { error: updateError } = await svc
      .from("prospects")
      .update({ archived_at: now })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this prospect. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

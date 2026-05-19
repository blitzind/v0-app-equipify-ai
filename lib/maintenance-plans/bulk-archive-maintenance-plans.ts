import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { maintenancePlanBulkArchiveBlockMessage } from "@/lib/maintenance-plans/bulk-archive-eligibility"
import { maintenancePlanAlreadyArchivedMessage } from "@/lib/maintenance-plans/bulk-archive-messages"

export type BulkArchiveMaintenancePlanResult =
  | { id: string; ok: true }
  | { id: string; ok: false; message: string }

export async function bulkArchiveMaintenancePlans(
  svc: SupabaseClient,
  organizationId: string,
  planIds: string[],
  actorUserId: string,
): Promise<{ results: BulkArchiveMaintenancePlanResult[] }> {
  const unique = [...new Set(planIds)]
  const results: BulkArchiveMaintenancePlanResult[] = []
  const now = new Date().toISOString()

  for (const id of unique) {
    const { data, error } = await svc
      .from("maintenance_plans")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      results.push({ id, ok: false, message: "Maintenance plan not found." })
      continue
    }

    const row = data as { archived_at?: string | null }

    const already = maintenancePlanAlreadyArchivedMessage(row.archived_at)
    if (already) {
      results.push({ id, ok: false, message: already })
      continue
    }

    const block = maintenancePlanBulkArchiveBlockMessage({ archivedAt: row.archived_at })
    if (block) {
      results.push({ id, ok: false, message: block })
      continue
    }

    const { error: updateError } = await svc
      .from("maintenance_plans")
      .update({
        archived_at: now,
        archived_by: actorUserId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .is("archived_at", null)

    if (updateError) {
      results.push({ id, ok: false, message: "Could not archive this maintenance plan. Try again." })
      continue
    }

    results.push({ id, ok: true })
  }

  return { results }
}

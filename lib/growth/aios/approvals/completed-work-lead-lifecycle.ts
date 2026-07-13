/**
 * GE-AIOS-OPERATOR-UX-1A — Lead lifecycle lookup for Completed Work filtering (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CompletedWorkLeadLifecycleSnapshot } from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import { isInactiveLeadLifecycle } from "@/lib/growth/aios/approvals/completed-work-operator-ux"

export async function fetchCompletedWorkLeadLifecycleMap(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, CompletedWorkLeadLifecycleSnapshot>> {
  const unique = [...new Set(leadIds.filter(Boolean))]
  const map = new Map<string, CompletedWorkLeadLifecycleSnapshot>()
  if (unique.length === 0) return map

  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, status, archived_at, company_name")
    .in("id", unique)

  if (error) {
    throw new Error(error.message)
  }

  for (const row of data ?? []) {
    const id = String((row as { id: string }).id)
    map.set(id, {
      leadId: id,
      status: ((row as { status?: string | null }).status ?? null) as string | null,
      archivedAt: ((row as { archived_at?: string | null }).archived_at ?? null) as string | null,
      companyName: ((row as { company_name?: string | null }).company_name ?? null) as string | null,
    })
  }

  return map
}

export function collectSubjectLeadIdsFromApprovalItems(
  items: Array<{ subjectType?: string; subjectId?: string | null }>,
): string[] {
  return items
    .filter((item) => item.subjectType === "lead" && Boolean(item.subjectId))
    .map((item) => item.subjectId as string)
}

export { isInactiveLeadLifecycle }

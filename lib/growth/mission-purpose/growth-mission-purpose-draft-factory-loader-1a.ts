/** GE-AIOS-LIVE-1A — Draft factory state loader for mission purpose inference (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function loadDraftFactoryStatesForMissionPurpose(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadIds: string[]
  },
): Promise<Map<string, string | null>> {
  const leadIds = [...new Set(input.leadIds.filter(Boolean))]
  const result = new Map<string, string | null>()
  if (leadIds.length === 0) return result

  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state")
    .eq("organization_id", input.organizationId)
    .in("lead_id", leadIds)

  if (error) return result

  for (const row of data ?? []) {
    const leadId = typeof (row as { lead_id?: unknown }).lead_id === "string"
      ? (row as { lead_id: string }).lead_id
      : null
    if (!leadId) continue
    const state =
      typeof (row as { state?: unknown }).state === "string"
        ? (row as { state: string }).state
        : null
    result.set(leadId, state)
  }

  return result
}

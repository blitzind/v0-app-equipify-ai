import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAttributionPath } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import { buildAttributionPathFromTouches } from "@/lib/growth/revenue-attribution/attribution-path-utils"
import { listAttributionTouchesForLead } from "@/lib/growth/revenue-attribution/attribution-touch-repository"
import { isGrowthAttributionTouchLedgerSchemaReady } from "@/lib/growth/revenue-attribution/attribution-touch-schema-health"

export { buildAttributionPathFromTouches } from "@/lib/growth/revenue-attribution/attribution-path-utils"

export async function rebuildAttributionPathsForLead(
  admin: SupabaseClient,
  leadId: string,
  opportunityId?: string | null,
): Promise<void> {
  if (!(await isGrowthAttributionTouchLedgerSchemaReady(admin))) return

  const allTouches = await listAttributionTouchesForLead(admin, leadId, { limit: 500 })
  const leadTouches = allTouches

  const leadPath = buildAttributionPathFromTouches(leadTouches, {
    leadId,
    opportunityId: null,
    pathScope: "lead",
  })

  await upsertAttributionPath(admin, {
    ...leadPath,
    opportunityId: null,
  })

  const oppId = opportunityId ?? (await loadOpportunityIdForLead(admin, leadId))
  if (!oppId) return

  const oppTouches = allTouches.filter((t) => t.opportunityId === oppId || t.opportunityId === null)
  const oppPath = buildAttributionPathFromTouches(oppTouches, {
    leadId,
    opportunityId: oppId,
    pathScope: "opportunity",
  })

  await upsertAttributionPath(admin, {
    ...oppPath,
    opportunityId: oppId,
  })
}

async function loadOpportunityIdForLead(admin: SupabaseClient, leadId: string): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

async function upsertAttributionPath(
  admin: SupabaseClient,
  path: Omit<GrowthAttributionPath, "id" | "createdAt">,
): Promise<void> {
  const row = {
    lead_id: path.leadId,
    opportunity_id: path.opportunityId,
    path_scope: path.pathScope,
    touch_ids: path.touchIds,
    first_touch_id: path.firstTouchId,
    last_touch_id: path.lastTouchId,
    first_touch_type: path.firstTouchType,
    last_touch_type: path.lastTouchType,
    touch_count: path.touchCount,
    channels: path.channels,
    attribution_sources: path.attributionSources,
    path_summary: path.pathSummary,
    rebuilt_at: path.rebuiltAt,
    updated_at: new Date().toISOString(),
  }

  let lookup = admin
    .schema("growth")
    .from("attribution_paths")
    .select("id")
    .eq("lead_id", path.leadId)
    .eq("path_scope", path.pathScope)

  lookup =
    path.opportunityId != null
      ? lookup.eq("opportunity_id", path.opportunityId)
      : lookup.is("opportunity_id", null)

  const { data: existing } = await lookup.maybeSingle()

  if (existing?.id) {
    await admin.schema("growth").from("attribution_paths").update(row).eq("id", existing.id)
    return
  }

  await admin.schema("growth").from("attribution_paths").insert(row)
}

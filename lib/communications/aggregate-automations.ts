import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { COMMUNICATION_AUTOMATION_BLUEPRINTS } from "@/lib/communications/automation-blueprints"
import type { CommunicationAutomationRow } from "@/lib/communications/types"

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export async function aggregateCommunicationAutomations(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CommunicationAutomationRow[]> {
  const since = daysAgoIso(30)

  const { data: workflowRows } = await supabase
    .from("workflow_automations")
    .select("id, enabled, trigger_type, updated_at")
    .eq("organization_id", organizationId)

  const workflows = (workflowRows ?? []) as {
    id: string
    enabled: boolean
    trigger_type: string
    updated_at: string
  }[]

  const warrantyActive = workflows.some((w) => w.enabled && w.trigger_type === "equipment_warranty_expiring")

  const out: CommunicationAutomationRow[] = []

  for (const bp of COMMUNICATION_AUTOMATION_BLUEPRINTS) {
    if (bp.eventTypes.length === 0) {
      const row: CommunicationAutomationRow = {
        ...bp,
        active: warrantyActive,
        lastRunAt: null,
        nextScheduledLabel: warrantyActive ? "When warranty threshold hits (workflow)" : null,
        successCount30d: 0,
        failureCount30d: 0,
      }
      out.push(row)
      continue
    }

    const [{ data: lastEv }, { count: okCt }, { count: badCt }] = await Promise.all([
      supabase
        .from("communication_events")
        .select("created_at")
        .eq("organization_id", organizationId)
        .in("event_type", bp.eventTypes)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", since)
        .in("event_type", bp.eventTypes)
        .in("delivery_status", ["sent", "delivered"]),
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", since)
        .in("event_type", bp.eventTypes)
        .in("delivery_status", ["failed", "bounced"]),
    ])

    const lastRunAt =
      lastEv && typeof (lastEv as { created_at?: string }).created_at === "string"
        ? (lastEv as { created_at: string }).created_at
        : null

    const row: CommunicationAutomationRow = {
      ...bp,
      active: true,
      lastRunAt,
      nextScheduledLabel: "During reminder sync & workflows",
      successCount30d: okCt ?? 0,
      failureCount30d: badCt ?? 0,
    }
    out.push(row)
  }

  return out
}

import type { SupabaseClient } from "@supabase/supabase-js"

export type PlanAutomationEventType =
  | "wo_created"
  | "skipped_duplicate"
  | "run_error"
  | "plan_paused"
  | "plan_resumed"

export type PlanAutomationEventRow = {
  id: string
  organization_id: string
  maintenance_plan_id: string
  work_order_id: string | null
  event_type: PlanAutomationEventType
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export async function insertMaintenancePlanAutomationEvent(
  supabase: SupabaseClient,
  payload: {
    organizationId: string
    maintenancePlanId: string
    workOrderId?: string | null
    eventType: PlanAutomationEventType
    message: string
    metadata?: Record<string, unknown>
  },
): Promise<{ error?: string }> {
  const { error } = await supabase.from("maintenance_plan_automation_events").insert({
    organization_id: payload.organizationId,
    maintenance_plan_id: payload.maintenancePlanId,
    work_order_id: payload.workOrderId ?? null,
    event_type: payload.eventType,
    message: payload.message,
    metadata: payload.metadata ?? {},
  })
  if (error) return { error: error.message }
  return {}
}

export async function loadPlanAutomationEvents(
  supabase: SupabaseClient,
  organizationId: string,
  planId: string,
  limit = 50,
): Promise<{ events: PlanAutomationEventRow[]; error?: string }> {
  const { data, error } = await supabase
    .from("maintenance_plan_automation_events")
    .select("id, organization_id, maintenance_plan_id, work_order_id, event_type, message, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("maintenance_plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { events: [], error: error.message }
  return { events: (data ?? []) as PlanAutomationEventRow[] }
}

import type { SupabaseClient } from "@supabase/supabase-js"

export type TechnicianAssignmentColumns = {
  assigned_technician_id: string | null
  assigned_user_id: string | null
}

/**
 * Map UI technician selection to `assigned_technician_id` / `assigned_user_id`.
 * Selection id may be `technicians.id` or legacy `auth.users` id (pre-technicians-table pickers).
 * DB triggers normalize the paired column on work_orders and maintenance_plans.
 */
async function resolveTechnicianAssignmentColumns(
  supabase: SupabaseClient,
  organizationId: string,
  selectionId: string | null,
): Promise<TechnicianAssignmentColumns> {
  if (!selectionId) {
    return { assigned_technician_id: null, assigned_user_id: null }
  }

  const probe = await supabase
    .from("technicians")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", selectionId)
    .maybeSingle()

  if (!probe.error && probe.data) {
    return { assigned_technician_id: selectionId, assigned_user_id: null }
  }

  return { assigned_technician_id: null, assigned_user_id: selectionId }
}

export function workOrderAssignmentColumns(
  supabase: SupabaseClient,
  organizationId: string,
  selectionId: string | null,
): Promise<TechnicianAssignmentColumns> {
  return resolveTechnicianAssignmentColumns(supabase, organizationId, selectionId)
}

export function maintenancePlanAssignmentColumns(
  supabase: SupabaseClient,
  organizationId: string,
  selectionId: string | null,
): Promise<TechnicianAssignmentColumns> {
  return resolveTechnicianAssignmentColumns(supabase, organizationId, selectionId)
}

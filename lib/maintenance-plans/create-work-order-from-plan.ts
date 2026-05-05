import type { MaintenancePlan } from "@/lib/mock-data"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export async function createWorkOrderFromMaintenancePlan(params: {
  organizationId: string
  plan: MaintenancePlan
  /** Defaults to plan.nextDueDate */
  scheduledDate?: string
  scheduledTime?: string
}): Promise<{ error: string | null }> {
  const { organizationId, plan } = params
  const scheduledDate = params.scheduledDate ?? plan.nextDueDate
  const scheduledTime = params.scheduledTime ?? "08:00"

  if (!plan.equipmentId?.trim()) {
    return { error: "Attach equipment to this plan before creating a work order." }
  }

  const gate = await enforceCanCreateRecord(organizationId, "work_order")
  if (!gate.ok) {
    return { error: gate.message }
  }

  const supabase = createBrowserSupabaseClient()

  const rawTitle = `${plan.name} — ${plan.equipmentName}`.trim()
  const title = (rawTitle.length > 0 ? rawTitle : `Maintenance — ${plan.equipmentName}`).slice(0, 500)

  const planName = plan.name.trim() || "Maintenance plan"
  const problemReported = `Maintenance plan: ${planName}`

  const { error } = await supabase.from("work_orders").insert({
    organization_id: organizationId,
    customer_id: plan.customerId,
    equipment_id: plan.equipmentId,
    title: title.trim(),
    status: "open",
    priority: uiPriorityToDb(plan.workOrderPriority),
    type: uiTypeToDb(plan.workOrderType),
    scheduled_on: scheduledDate || null,
    scheduled_time: normalizeTimeForDb(scheduledTime),
    assigned_user_id: plan.technicianId || null,
    maintenance_plan_id: plan.id,
    notes: null,
    problem_reported: problemReported,
    repair_log: {
      problemReported,
      diagnosis: "",
      partsUsed: [],
      laborHours: 0,
      technicianNotes: "",
      photos: [],
      signatureDataUrl: "",
      signedBy: "",
      signedAt: "",
    },
  })

  return { error: error?.message ?? null }
}

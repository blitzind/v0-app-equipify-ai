import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeNextDueDate,
  intervalFromDb,
  parseServicesJsonb,
  type MaintenancePlanRow,
} from "@/lib/maintenance-plans/db-map"
import { uiPriorityToDb, uiTypeToDb, normalizeTimeForDb } from "@/lib/work-orders/db-map"

export type ProcessDuePlansResult = {
  processed: number
  workOrdersCreated: number
  skippedDuplicate: number
  errors: string[]
}

async function resolveAutomationActorUserId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const roles = ["owner", "admin", "manager"] as const
  for (const role of roles) {
    const { data } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .eq("role", role)
      .limit(1)
      .maybeSingle()
    const uid = (data as { user_id?: string } | null)?.user_id
    if (uid) return uid
  }
  return null
}

async function hasDuplicateWoForDueCycle(
  supabase: SupabaseClient,
  organizationId: string,
  planId: string,
  scheduledOn: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("work_orders")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("maintenance_plan_id", planId)
    .eq("scheduled_on", scheduledOn)
    .eq("is_archived", false)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export type ProcessDueOptions = {
  today?: string
  /**
   * true = service-role / cron: set explicit created_by (org actor).
   * false/omit = user session: omit created_by so trigger uses auth.uid().
   */
  systemInsert?: boolean
}

/**
 * Due-plan automation: active + auto WO + next_due_date <= today.
 * Creates one WO per due cycle (deduped by plan + scheduled_on).
 * Advances next_due_date by one interval from the processed due date; sets last_auto_wo_at.
 */
export async function processDuePlansForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  options?: ProcessDueOptions
): Promise<ProcessDuePlansResult> {
  const errors: string[] = []
  let processed = 0
  let workOrdersCreated = 0
  let skippedDuplicate = 0

  const todayStr = options?.today ?? new Date().toISOString().slice(0, 10)
  const systemInsert = options?.systemInsert === true

  let systemActorId: string | null = null
  if (systemInsert) {
    systemActorId = await resolveAutomationActorUserId(supabase, organizationId)
    if (!systemActorId) {
      errors.push(`No owner/admin/manager found for organization ${organizationId}; cannot attribute auto work orders.`)
      return { processed, workOrdersCreated, skippedDuplicate, errors }
    }
  }

  const { data: rows, error: qErr } = await supabase
    .from("maintenance_plans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .eq("status", "active")
    .eq("auto_create_work_order", true)
    .lte("next_due_date", todayStr)
    .not("next_due_date", "is", null)
    .not("equipment_id", "is", null)

  if (qErr) {
    errors.push(qErr.message)
    return { processed, workOrdersCreated, skippedDuplicate, errors }
  }

  const plans = (rows ?? []) as MaintenancePlanRow[]

  for (const row of plans) {
    processed++
    const dueDate = row.next_due_date
    if (!dueDate) continue

    const duplicate = await hasDuplicateWoForDueCycle(supabase, row.organization_id, row.id, dueDate)
    if (duplicate) {
      skippedDuplicate++
      continue
    }

    const { workOrderType, workOrderPriority } = parseServicesJsonb(row.services)

    const { data: eqRow } = await supabase
      .from("equipment")
      .select("name")
      .eq("organization_id", row.organization_id)
      .eq("id", row.equipment_id)
      .maybeSingle()

    const equipmentName = (eqRow as { name?: string } | null)?.name ?? "Equipment"
    const rawTitle = `${row.name} — ${equipmentName}`.trim()
    const title = (rawTitle.length > 0 ? rawTitle : `Maintenance — ${equipmentName}`).slice(0, 500)
    const problemReported = `Auto-created preventive maintenance — plan ${row.id}, due ${dueDate}.`

    const insertPayload: Record<string, unknown> = {
      organization_id: row.organization_id,
      customer_id: row.customer_id,
      equipment_id: row.equipment_id,
      title,
      status: "open",
      priority: uiPriorityToDb(workOrderPriority),
      type: uiTypeToDb(workOrderType),
      scheduled_on: dueDate,
      scheduled_time: normalizeTimeForDb("08:00"),
      assigned_user_id: row.assigned_user_id,
      maintenance_plan_id: row.id,
      notes: null,
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
    }

    if (systemInsert && systemActorId) {
      insertPayload.created_by = systemActorId
    }

    const { error: insErr } = await supabase.from("work_orders").insert(insertPayload as never)

    if (insErr) {
      errors.push(`Plan ${row.id}: ${insErr.message}`)
      continue
    }

    workOrdersCreated++

    const { interval, customIntervalDays } = intervalFromDb(row.interval_value, row.interval_unit)
    const nextDue = computeNextDueDate(dueDate, interval, customIntervalDays)

    const { error: upErr } = await supabase
      .from("maintenance_plans")
      .update({
        next_due_date: nextDue,
        last_auto_wo_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("organization_id", row.organization_id)

    if (upErr) {
      errors.push(`Plan ${row.id}: work order created but schedule update failed: ${upErr.message}`)
    }
  }

  return { processed, workOrdersCreated, skippedDuplicate, errors }
}

/** Cron: every organization that has at least one qualifying plan. */
export async function processDuePlansAllOrganizations(
  supabase: SupabaseClient,
  options?: { today?: string }
): Promise<
  ProcessDuePlansResult & {
    organizationsTouched: number
  }
> {
  const todayStr = options?.today ?? new Date().toISOString().slice(0, 10)

  const { data: orgRows, error } = await supabase
    .from("maintenance_plans")
    .select("organization_id")
    .eq("is_archived", false)
    .eq("status", "active")
    .eq("auto_create_work_order", true)
    .lte("next_due_date", todayStr)
    .not("next_due_date", "is", null)
    .not("equipment_id", "is", null)

  if (error) {
    return {
      processed: 0,
      workOrdersCreated: 0,
      skippedDuplicate: 0,
      errors: [error.message],
      organizationsTouched: 0,
    }
  }

  const orgIds = [
    ...new Set((orgRows ?? []).map((r: { organization_id: string }) => r.organization_id)),
  ]

  let processed = 0
  let workOrdersCreated = 0
  let skippedDuplicate = 0
  const errors: string[] = []

  for (const orgId of orgIds) {
    const r = await processDuePlansForOrganization(supabase, orgId, {
      today: todayStr,
      systemInsert: true,
    })
    processed += r.processed
    workOrdersCreated += r.workOrdersCreated
    skippedDuplicate += r.skippedDuplicate
    errors.push(...r.errors)
  }

  return {
    processed,
    workOrdersCreated,
    skippedDuplicate,
    errors,
    organizationsTouched: orgIds.length,
  }
}

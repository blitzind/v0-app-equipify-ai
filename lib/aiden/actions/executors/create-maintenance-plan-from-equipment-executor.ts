import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { CreateMaintenancePlanFromEquipmentPreviewPayload } from "@/lib/aiden/actions/resolvers/create-maintenance-plan-from-equipment-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { requireMaintenancePlanCreate } from "@/lib/billing/server-guard"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import {
  intervalToDb,
  notificationRulesToJsonb,
  planStatusUiToDb,
  serializeServicesForDb,
} from "@/lib/maintenance-plans/db-map"
import type { OrgPermissions } from "@/lib/permissions/model"
import { maintenancePlanAssignmentColumns } from "@/lib/work-orders/assignment-payload"

const ACTION_ID: AidenPreparedWorkspaceActionId = "create_maintenance_plan_from_equipment"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

async function fetchOrgSubscriptionForTrialLocal(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("status, trial_ends_at, plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()
  return (data ?? null) as OrganizationSubscription | null
}

async function reassertPermission(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  platformAdminPlanBypass?: boolean
}): Promise<boolean> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const sub = await fetchOrgSubscriptionForTrialLocal(args.supabase, args.organizationId)
  return canPrepareAidenActionId(
    {
      permissions: args.permissions,
      planId,
      trialActive: isTrialActive(sub),
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    },
    ACTION_ID,
  )
}

function parsePreviewPayload(
  previewPayload: Record<string, unknown>,
): { ok: true; preview: CreateMaintenancePlanFromEquipmentPreviewPayload } | { ok: false; message: string } {
  const prev = previewPayload.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }

  const cust = prev.customer
  if (!isRecord(cust)) return { ok: false, message: "Missing customer." }
  const cid = typeof cust.id === "string" ? cust.id.trim() : ""
  const companyName = typeof cust.companyName === "string" ? cust.companyName.trim() : ""
  if (!UUID_RE.test(cid) || !companyName) return { ok: false, message: "Invalid customer in preview." }

  const eq = prev.equipment
  if (!isRecord(eq)) return { ok: false, message: "Missing equipment." }
  const eid = typeof eq.id === "string" ? eq.id.trim() : ""
  const en = typeof eq.name === "string" ? eq.name.trim() : ""
  if (!UUID_RE.test(eid) || !en) return { ok: false, message: "Invalid equipment in preview." }
  const sn =
    eq.serialNumber === null || eq.serialNumber === undefined ? null : typeof eq.serialNumber === "string" ? eq.serialNumber : null
  const cat =
    eq.category === null || eq.category === undefined ? null : typeof eq.category === "string" ? eq.category : null
  const loc =
    eq.location === null || eq.location === undefined ? null : typeof eq.location === "string" ? eq.location : null

  const planName = typeof prev.planName === "string" ? prev.planName.trim() : ""
  if (planName.length < 2 || planName.length > 500) return { ok: false, message: "Plan name must be between 2 and 500 characters." }

  const allowedIntervals = new Set(["Annual", "Semi-Annual", "Quarterly", "Monthly", "Custom"])
  const intervalUi = prev.intervalUi
  if (typeof intervalUi !== "string" || !allowedIntervals.has(intervalUi)) {
    return { ok: false, message: "Invalid interval." }
  }

  const customIntervalDays =
    typeof prev.customIntervalDays === "number" && Number.isFinite(prev.customIntervalDays) ?
      Math.round(prev.customIntervalDays)
    : 0
  if (customIntervalDays < 0 || customIntervalDays > 3650) return { ok: false, message: "Invalid custom interval days." }

  const nextDueDate = typeof prev.nextDueDate === "string" ? prev.nextDueDate.trim() : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) return { ok: false, message: "Invalid next due date." }

  let lastServiceDate: string | null = null
  if (prev.lastServiceDate === null) lastServiceDate = null
  else if (typeof prev.lastServiceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(prev.lastServiceDate.trim())) {
    lastServiceDate = prev.lastServiceDate.trim()
  } else if (prev.lastServiceDate !== undefined) {
    return { ok: false, message: "Invalid last service date." }
  }

  const serviceScope = typeof prev.serviceScope === "string" ? prev.serviceScope.trim() : ""
  if (serviceScope.length < 3 || serviceScope.length > 4000) {
    return { ok: false, message: "Service scope must be between 3 and 4000 characters." }
  }

  const allowedTypes = new Set(["Repair", "PM", "Inspection", "Install", "Emergency"])
  const allowedPri = new Set(["Low", "Normal", "High", "Critical"])
  const workOrderTypeUi = prev.workOrderTypeUi
  const workOrderPriorityUi = prev.workOrderPriorityUi
  if (typeof workOrderTypeUi !== "string" || !allowedTypes.has(workOrderTypeUi)) {
    return { ok: false, message: "Invalid work order type." }
  }
  if (typeof workOrderPriorityUi !== "string" || !allowedPri.has(workOrderPriorityUi)) {
    return { ok: false, message: "Invalid work order priority." }
  }

  const preferredServiceTime = typeof prev.preferredServiceTime === "string" ? prev.preferredServiceTime.trim() : ""
  if (!/^\d{1,2}:\d{2}$/.test(preferredServiceTime)) return { ok: false, message: "Invalid preferred service time." }

  let technicianSelectionId: string | null = null
  if (prev.technicianSelectionId === null) technicianSelectionId = null
  else if (typeof prev.technicianSelectionId === "string" && prev.technicianSelectionId.trim() === "") {
    technicianSelectionId = null
  } else if (typeof prev.technicianSelectionId === "string" && UUID_RE.test(prev.technicianSelectionId)) {
    technicianSelectionId = prev.technicianSelectionId
  } else if (typeof prev.technicianSelectionId === "string") {
    return { ok: false, message: "Invalid technician selection id." }
  }

  const autoCreateWorkOrder = Boolean(prev.autoCreateWorkOrder)

  const notes = typeof prev.notes === "string" ? prev.notes : ""
  if (notes.length > 12_000) return { ok: false, message: "Notes are too long." }

  const durationMinutes =
    prev.estimatedDurationMinutes === null || prev.estimatedDurationMinutes === undefined ? null
    : typeof prev.estimatedDurationMinutes === "number" && Number.isFinite(prev.estimatedDurationMinutes) ?
      Math.round(prev.estimatedDurationMinutes)
    : null
  if (durationMinutes !== null && (durationMinutes < 15 || durationMinutes > 960)) {
    return { ok: false, message: "Estimated duration is out of range." }
  }

  return {
    ok: true,
    preview: {
      customer: { id: cid, companyName },
      equipment: { id: eid, name: en, serialNumber: sn, category: cat, location: loc },
      planName,
      intervalUi: intervalUi as CreateMaintenancePlanFromEquipmentPreviewPayload["intervalUi"],
      customIntervalDays,
      nextDueDate,
      lastServiceDate,
      serviceScope,
      estimatedDurationMinutes: durationMinutes,
      workOrderTypeUi: workOrderTypeUi as CreateMaintenancePlanFromEquipmentPreviewPayload["workOrderTypeUi"],
      workOrderPriorityUi: workOrderPriorityUi as CreateMaintenancePlanFromEquipmentPreviewPayload["workOrderPriorityUi"],
      preferredServiceTime,
      technicianSelectionId,
      technicianLabel: typeof prev.technicianLabel === "string" ? prev.technicianLabel : null,
      autoCreateWorkOrder,
      notes,
    },
  }
}

export type CreateMaintenancePlanFromEquipmentExecutorResult =
  | { kind: "success"; maintenancePlanId: string; message: string }
  | { kind: "idempotent"; maintenancePlanId: string; message: string }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecuteCreateMaintenancePlanFromEquipmentArgs = {
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

export async function executeCreateMaintenancePlanFromEquipment(
  args: ExecuteCreateMaintenancePlanFromEquipmentArgs,
): Promise<CreateMaintenancePlanFromEquipmentExecutorResult> {
  const okPerm = await reassertPermission({
    supabase: args.userSupabase,
    organizationId: args.organizationId,
    permissions: args.permissions,
    platformAdminPlanBypass: args.platformAdminPlanBypass,
  })
  if (!okPerm) {
    return { kind: "permission_denied", message: "You do not have permission to create this maintenance plan." }
  }

  const billing = await requireMaintenancePlanCreate(args.userSupabase, args.userId, args.organizationId)
  if (!billing.ok) {
    if (billing.httpStatus >= 500) {
      return { kind: "server_error", message: billing.message }
    }
    return { kind: "permission_denied", message: billing.message }
  }

  const execExisting = args.row.execution_payload as { maintenancePlanId?: string } | undefined
  if (args.row.status === "completed" && execExisting?.maintenancePlanId && UUID_RE.test(execExisting.maintenancePlanId)) {
    return {
      kind: "idempotent",
      maintenancePlanId: execExisting.maintenancePlanId,
      message: "Maintenance plan was already created for this prepared action.",
    }
  }

  const parsed = parsePreviewPayload(args.row.preview_payload ?? {})
  if (!parsed.ok) return { kind: "validation_error", message: parsed.message }
  const preview = parsed.preview

  const assign = await maintenancePlanAssignmentColumns(
    args.userSupabase,
    args.organizationId,
    preview.technicianSelectionId,
  )

  const nextDue = preview.nextDueDate.trim()

  const trace = `AIDEN_PREPARED_ACTION_ID=${args.preparedActionId}`
  const scopeAndNotes = [preview.serviceScope?.trim(), preview.notes?.trim()].filter(Boolean).join("\n\n").trim()
  const notesCombined = [trace, `AIDEN_PREPARED_ACTION=${ACTION_ID}`, scopeAndNotes].filter(Boolean).join("\n\n").trim()

  const { interval_value, interval_unit } = intervalToDb(preview.intervalUi, preview.customIntervalDays)

  const { data, error } = await args.userSupabase
    .from("maintenance_plans")
    .insert({
      organization_id: args.organizationId,
      customer_id: preview.customer.id,
      equipment_id: preview.equipment.id,
      name: preview.planName.trim(),
      status: planStatusUiToDb("Active"),
      priority: "normal",
      interval_value,
      interval_unit,
      last_service_date: preview.lastServiceDate?.trim() ? preview.lastServiceDate : null,
      next_due_date: nextDue?.trim() ? nextDue : null,
      auto_create_work_order: preview.autoCreateWorkOrder,
      notes: notesCombined.length > 0 ? notesCombined : null,
      services: serializeServicesForDb(
        [],
        preview.workOrderTypeUi,
        preview.workOrderPriorityUi,
        preview.preferredServiceTime,
      ),
      notification_rules: notificationRulesToJsonb([]),
      ...assign,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    return { kind: "server_error", message: error.message }
  }
  const id = (data as { id?: string } | null)?.id
  if (!id) return { kind: "server_error", message: "Insert did not return a maintenance plan id." }

  return {
    kind: "success",
    maintenancePlanId: id,
    message: "Maintenance plan created. Review intervals and auto work order settings on the maintenance plans page.",
  }
}

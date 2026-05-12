import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { ScheduleMaintenanceVisitPreviewPayload } from "@/lib/aiden/actions/resolvers/schedule-maintenance-visit-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import type { OrgPermissions } from "@/lib/permissions/model"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"

const ACTION_ID: AidenPreparedWorkspaceActionId = "schedule_maintenance_visit"

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
): { ok: true; preview: ScheduleMaintenanceVisitPreviewPayload } | { ok: false; message: string } {
  const prev = previewPayload.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }
  const cust = prev.customer
  if (!isRecord(cust)) return { ok: false, message: "Missing customer." }
  const cid = typeof cust.id === "string" ? cust.id.trim() : ""
  const companyName = typeof cust.companyName === "string" ? cust.companyName.trim() : ""
  if (!UUID_RE.test(cid) || !companyName) return { ok: false, message: "Invalid customer in preview." }

  const serviceTypeUi = prev.serviceTypeUi
  const priorityUi = prev.priorityUi
  const allowedTypes = new Set(["Repair", "PM", "Inspection", "Install", "Emergency"])
  const allowedPri = new Set(["Low", "Normal", "High", "Critical"])
  if (typeof serviceTypeUi !== "string" || !allowedTypes.has(serviceTypeUi)) {
    return { ok: false, message: "Invalid service type." }
  }
  if (typeof priorityUi !== "string" || !allowedPri.has(priorityUi)) {
    return { ok: false, message: "Invalid priority." }
  }

  const suggestedDate = typeof prev.suggestedDate === "string" ? prev.suggestedDate.trim() : ""
  const suggestedTime = typeof prev.suggestedTime === "string" ? prev.suggestedTime.trim() : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(suggestedDate)) return { ok: false, message: "Invalid visit date." }
  if (!/^\d{1,2}:\d{2}$/.test(suggestedTime)) return { ok: false, message: "Invalid visit time." }

  const serviceReason = typeof prev.serviceReason === "string" ? prev.serviceReason.trim() : ""
  if (serviceReason.length < 3 || serviceReason.length > 4000) {
    return { ok: false, message: "Service reason must be between 3 and 4000 characters." }
  }

  const notes = typeof prev.notes === "string" ? prev.notes : ""
  if (notes.length > 12_000) return { ok: false, message: "Notes are too long." }

  let equipment: ScheduleMaintenanceVisitPreviewPayload["equipment"] = null
  if (prev.equipment !== null && prev.equipment !== undefined) {
    if (!isRecord(prev.equipment)) return { ok: false, message: "Invalid equipment object." }
    const eid = typeof prev.equipment.id === "string" ? prev.equipment.id.trim() : ""
    const en = typeof prev.equipment.name === "string" ? prev.equipment.name.trim() : ""
    if (!UUID_RE.test(eid) || !en) return { ok: false, message: "Invalid equipment in preview." }
    const sn =
      prev.equipment.serialNumber === null || prev.equipment.serialNumber === undefined ?
        null
      : typeof prev.equipment.serialNumber === "string" ?
        prev.equipment.serialNumber
      : null
    equipment = { id: eid, name: en, serialNumber: sn }
  }

  let technicianSelectionId: string | null = null
  if (prev.technicianSelectionId === null) technicianSelectionId = null
  else if (typeof prev.technicianSelectionId === "string" && prev.technicianSelectionId.trim() === "") {
    technicianSelectionId = null
  } else if (typeof prev.technicianSelectionId === "string" && UUID_RE.test(prev.technicianSelectionId)) {
    technicianSelectionId = prev.technicianSelectionId
  } else if (typeof prev.technicianSelectionId === "string") {
    return { ok: false, message: "Invalid technician selection id." }
  }

  let maintenancePlanId: string | null = null
  if (prev.maintenancePlanId === null || prev.maintenancePlanId === undefined) maintenancePlanId = null
  else if (typeof prev.maintenancePlanId === "string" && prev.maintenancePlanId.trim() === "") {
    maintenancePlanId = null
  } else if (typeof prev.maintenancePlanId === "string" && UUID_RE.test(prev.maintenancePlanId)) {
    maintenancePlanId = prev.maintenancePlanId
  } else if (typeof prev.maintenancePlanId === "string") {
    return { ok: false, message: "Invalid maintenance plan id." }
  }

  const locationSummary =
    typeof prev.locationSummary === "string" ? prev.locationSummary.trim() : "Service address on file."

  const durationMinutes =
    prev.durationMinutes === null || prev.durationMinutes === undefined ? null
    : typeof prev.durationMinutes === "number" && Number.isFinite(prev.durationMinutes) ?
      Math.round(prev.durationMinutes)
    : null

  return {
    ok: true,
    preview: {
      customer: {
        id: cid,
        companyName,
        billingAddressLine1:
          cust.billingAddressLine1 === null || cust.billingAddressLine1 === undefined ?
            null
          : String(cust.billingAddressLine1),
        billingCity:
          cust.billingCity === null || cust.billingCity === undefined ? null : String(cust.billingCity),
        billingState:
          cust.billingState === null || cust.billingState === undefined ? null : String(cust.billingState),
        billingPostalCode:
          cust.billingPostalCode === null || cust.billingPostalCode === undefined ?
            null
          : String(cust.billingPostalCode),
      },
      locationSummary,
      equipment,
      serviceTypeUi: serviceTypeUi as ScheduleMaintenanceVisitPreviewPayload["serviceTypeUi"],
      priorityUi: priorityUi as ScheduleMaintenanceVisitPreviewPayload["priorityUi"],
      serviceReason,
      durationMinutes,
      suggestedDate,
      suggestedTime,
      dateSuggested: prev.dateSuggested === true,
      technicianSelectionId,
      technicianLabel: typeof prev.technicianLabel === "string" ? prev.technicianLabel : null,
      notes,
      maintenancePlanId,
    },
  }
}

export type ScheduleMaintenanceVisitExecutorResult =
  | { kind: "success"; workOrderId: string; message: string }
  | { kind: "idempotent"; workOrderId: string; message: string }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecuteScheduleMaintenanceVisitArgs = {
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

/**
 * Creates a **scheduled** work order (user JWT client so `created_by` trigger receives auth.uid()).
 */
export async function executeScheduleMaintenanceVisit(
  args: ExecuteScheduleMaintenanceVisitArgs,
): Promise<ScheduleMaintenanceVisitExecutorResult> {
  const okPerm = await reassertPermission({
    supabase: args.userSupabase,
    organizationId: args.organizationId,
    permissions: args.permissions,
    platformAdminPlanBypass: args.platformAdminPlanBypass,
  })
  if (!okPerm) {
    return { kind: "permission_denied", message: "You do not have permission to schedule this visit." }
  }

  const execExisting = args.row.execution_payload as { workOrderId?: string } | undefined
  if (args.row.status === "completed" && execExisting?.workOrderId && UUID_RE.test(execExisting.workOrderId)) {
    return {
      kind: "idempotent",
      workOrderId: execExisting.workOrderId,
      message: "Scheduled visit was already created for this prepared action.",
    }
  }

  const parsed = parsePreviewPayload(args.row.preview_payload ?? {})
  if (!parsed.ok) return { kind: "validation_error", message: parsed.message }
  const preview = parsed.preview

  const assign = await workOrderAssignmentColumns(
    args.userSupabase,
    args.organizationId,
    preview.technicianSelectionId,
  )

  const titleBase = preview.equipment ? `${preview.serviceTypeUi} — ${preview.equipment.name}` : `Service — ${preview.customer.companyName}`
  const title = titleBase.slice(0, 500)
  const scheduledTime = normalizeTimeForDb(preview.suggestedTime)
  if (!scheduledTime) {
    return { kind: "validation_error", message: "Visit time could not be normalized." }
  }

  const trace = `AIDEN_PREPARED_ACTION_ID=${args.preparedActionId}`
  const notesCombined = [trace, preview.notes?.trim()].filter(Boolean).join("\n\n").trim()

  const insertPayload: Record<string, unknown> = {
    organization_id: args.organizationId,
    customer_id: preview.customer.id,
    equipment_id: preview.equipment?.id ?? null,
    title,
    status: "scheduled",
    priority: uiPriorityToDb(preview.priorityUi),
    type: uiTypeToDb(preview.serviceTypeUi),
    scheduled_on: preview.suggestedDate,
    scheduled_time: scheduledTime,
    ...assign,
    maintenance_plan_id: preview.maintenancePlanId,
    notes: notesCombined.length > 0 ? notesCombined : null,
    problem_reported: preview.serviceReason,
    repair_log: {
      problemReported: preview.serviceReason,
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

  const { data, error } = await args.userSupabase.from("work_orders").insert(insertPayload).select("id").maybeSingle()

  if (error) {
    return { kind: "server_error", message: error.message }
  }
  const id = (data as { id?: string } | null)?.id
  if (!id) return { kind: "server_error", message: "Insert did not return a work order id." }

  return {
    kind: "success",
    workOrderId: id,
    message: "Scheduled work order created. Review on the schedule or work orders board.",
  }
}

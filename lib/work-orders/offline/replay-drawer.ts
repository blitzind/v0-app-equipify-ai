import type { SupabaseClient } from "@supabase/supabase-js"
import type { RepairLog, WorkOrder, WorkOrderStatus } from "@/lib/mock-data"
import { parseRepairLog, repairLogJsonForPersist } from "@/lib/work-orders/parse-repair-log"
import { workOrderAssignmentColumns } from "@/lib/work-orders/assignment-payload"
import { repairLogFingerprintFromWorkOrder } from "./repair-log-fingerprint"
import type { WorkOrderOfflineBundlePayload, WorkOrderOfflineOutboxRecord } from "./types"

function dbStatusToUi(s: string): WorkOrderStatus {
  switch (s) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "completed_pending_signature":
      return "Completed Pending Signature"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

export type WorkOrderOfflineServerBaseline = {
  updatedAt: string | null
  problemReported: string | null
  notes: string | null
  repairLog: unknown
  status: string
}

export async function fetchWorkOrderOfflineBaseline(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<WorkOrderOfflineServerBaseline | null> {
  const { data, error } = await supabase
    .from("work_orders")
    .select("updated_at, problem_reported, notes, repair_log, status")
    .eq("id", workOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as {
    updated_at?: string | null
    problem_reported?: string | null
    notes?: string | null
    repair_log?: unknown
    status?: string
  }
  return {
    updatedAt: row.updated_at?.trim() || null,
    problemReported: row.problem_reported ?? null,
    notes: row.notes ?? null,
    repairLog: row.repair_log,
    status: row.status ?? "open",
  }
}

function detectConflict(
  record: WorkOrderOfflineOutboxRecord,
  baseline: WorkOrderOfflineServerBaseline,
  serverFingerprint: string,
): boolean {
  if (record.baseStatusDb && baseline.status !== record.baseStatusDb) return true
  const versionMismatch =
    Boolean(record.baseServerUpdatedAt) &&
    Boolean(baseline.updatedAt) &&
    record.baseServerUpdatedAt !== baseline.updatedAt
  const contentMismatch = record.baselineRepairFingerprint !== serverFingerprint
  return versionMismatch || contentMismatch
}

export type ReplayDrawerResult =
  | { ok: true }
  | { ok: false; conflict: true; serverUpdatedAt: string | null }
  | { ok: false; conflict: false; message: string }

export async function replayWorkOrderOfflineBundle(args: {
  supabase: SupabaseClient
  organizationId: string
  workOrder: WorkOrder
  notesColumn: string
  usesTasksTable: boolean
  usesPartsLineItems: boolean
  record: WorkOrderOfflineOutboxRecord
}): Promise<ReplayDrawerResult> {
  const { supabase, organizationId, workOrder, notesColumn, usesTasksTable, usesPartsLineItems, record } = args

  if (record.actionKind !== "wo_technician_bundle") {
    return { ok: false, conflict: false, message: "Unsupported offline action." }
  }

  const baseline = await fetchWorkOrderOfflineBaseline(supabase, organizationId, workOrder.id)
  if (!baseline) {
    return { ok: false, conflict: false, message: "Work order not found or access denied." }
  }

  const parsed = parseRepairLog(baseline.repairLog)
  const columnProblem = typeof baseline.problemReported === "string" ? baseline.problemReported.trim() : ""
  const mergedProblem = columnProblem !== "" ? columnProblem : (parsed.problemReported ?? "")
  const serverRepair: RepairLog = {
    ...parsed,
    problemReported: mergedProblem,
  }
  const serverFp = repairLogFingerprintFromWorkOrder(mergedProblem, serverRepair, baseline.notes ?? "")

  if (detectConflict(record, baseline, serverFp)) {
    return { ok: false, conflict: true, serverUpdatedAt: baseline.updatedAt }
  }

  const payload = record.payload as WorkOrderOfflineBundlePayload

  if (payload.tasks !== null && usesTasksTable) {
    return {
      ok: false,
      conflict: false,
      message: "Tasks are server-backed for this work order — cannot replay offline JSON.",
    }
  }

  let mergedRepair: RepairLog = { ...serverRepair }
  if (payload.repair) {
    mergedRepair = {
      ...mergedRepair,
      problemReported: payload.repair.problemReported,
      diagnosis: payload.repair.diagnosis,
      technicianNotes: payload.repair.technicianNotes,
    }
  }
  if (payload.tasks !== null && !usesTasksTable) {
    mergedRepair = {
      ...mergedRepair,
      tasks: payload.tasks,
    }
  }

  const touchRepairLog = Boolean(payload.repair) || (payload.tasks !== null && !usesTasksTable)
  const touchProblemNotes = Boolean(payload.repair)

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (touchRepairLog) {
    update.repair_log = repairLogJsonForPersist(mergedRepair, {
      stripTasks: usesTasksTable,
      stripParts: usesPartsLineItems,
    })
  }
  if (touchProblemNotes && payload.repair) {
    update.problem_reported = payload.repair.problemReported.trim() || null
    update.notes = payload.repair.notesInternal.trim() || null
  }

  const prevStatusDb = baseline.status
  let assign: Awaited<ReturnType<typeof workOrderAssignmentColumns>> | null = null

  if (payload.statusInProgress) {
    const curUi = dbStatusToUi(baseline.status)
    if (curUi !== "Open" && curUi !== "Scheduled") {
      return {
        ok: false,
        conflict: false,
        message: "Status changed on server — cannot apply offline in-progress transition.",
      }
    }
    const tid = workOrder.technicianId === "unassigned" ? null : workOrder.technicianId
    assign = await workOrderAssignmentColumns(supabase, organizationId, tid)
    update.status = "in_progress"
    Object.assign(update, assign)
  }

  try {
    const { error } = await supabase
      .from("work_orders")
      .update(update)
      .eq("id", workOrder.id)
      .eq("organization_id", organizationId)
    if (error) throw new Error(error.message)

    if (payload.statusInProgress && assign) {
      const nextStatusDb = "in_progress"
      if (prevStatusDb !== nextStatusDb) {
        const woCtx = {
          id: workOrder.id,
          status: nextStatusDb,
          priority: workOrder.priority.toLowerCase(),
          customer_id: workOrder.customerId,
          equipment_id: workOrder.equipmentId,
          assigned_user_id: assign.assigned_user_id,
          assigned_technician_id: assign.assigned_technician_id,
        }
        void fetch(`/api/organizations/${organizationId}/workflows/emit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger_type: "work_order_status_changed",
            source_type: "work_order",
            source_id: workOrder.id,
            context: {
              work_order: woCtx,
              previous_work_order: { status: prevStatusDb },
            },
          }),
        }).catch(() => {})
      }
    }

    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      conflict: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

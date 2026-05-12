import { NextResponse } from "next/server"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { getPreparedActionById, updatePreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import { getPreparedWorkspaceActionDefinition, isFinancialAidenAction } from "@/lib/aiden/actions/action-registry"
import { mergeAndValidateInvoicePreviewForPatch } from "@/lib/aiden/prepared-actions/invoice-preview-merge"
import { mergeAndValidateQuotePreviewForPatch } from "@/lib/aiden/prepared-actions/quote-preview-merge"
import { mergeDraftCustomerMessagePreviewForPatch } from "@/lib/aiden/prepared-actions/draft-customer-message-preview-merge"
import { mergeAndValidateFollowUpTaskPreviewForPatch } from "@/lib/aiden/prepared-actions/follow-up-task-preview-merge"
import { mergeAndValidateScheduleMaintenanceVisitPreviewForPatch } from "@/lib/aiden/prepared-actions/schedule-maintenance-visit-preview-merge"
import { mergeAndValidateCreateMaintenancePlanFromEquipmentPreviewForPatch } from "@/lib/aiden/prepared-actions/create-maintenance-plan-from-equipment-preview-merge"
import { mergeAndValidateCreatePartsReorderRequestPreviewForPatch } from "@/lib/aiden/prepared-actions/create-parts-reorder-request-preview-merge"
import { mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch } from "@/lib/aiden/prepared-actions/bulk-invoice-completed-work-orders-preview-merge"
import {
  assertAidenActionsEnabled,
  assertFinancialActionAllowedForTechnician,
  canPrepareWorkspaceActionForUser,
  getServiceRoleOrNull,
  isPreparedWorkspaceActionId,
  requireWorkspacePreparedActionPermissions,
  serializePreparedAction,
  UUID_RE,
} from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

export const runtime = "nodejs"

const PATCHABLE = new Set(["prepared", "ready_for_confirmation"])

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; actionId: string }> },
) {
  const { organizationId, actionId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(actionId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const svc = getServiceRoleOrNull()
  if (!svc) {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const rowRes = await getPreparedActionById(svc, organizationId, actionId)
  if (rowRes.error) {
    return NextResponse.json({ error: "query_failed", message: rowRes.error.message }, { status: 500 })
  }
  const row = rowRes.data
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Prepared action not found." }, { status: 404 })
  }

  const gate = await requireWorkspacePreparedActionPermissions(organizationId, row.action_id)
  if ("error" in gate) return gate.error

  const enabled = await assertAidenActionsEnabled(gate.supabase, organizationId)
  if (enabled !== true) return enabled.error

  if (!isPreparedWorkspaceActionId(row.action_id)) {
    return NextResponse.json({ error: "unknown_action", message: "Unknown action on row." }, { status: 400 })
  }

  const techOk = assertFinancialActionAllowedForTechnician(gate.permissions, row.action_id)
  if (techOk !== true) return techOk.error

  const canPrepare = await canPrepareWorkspaceActionForUser({
    supabase: gate.supabase,
    organizationId,
    permissions: gate.permissions,
    actionId: row.action_id,
    isPlatformAdmin: gate.isPlatformAdmin,
  })
  if (!canPrepare) {
    return NextResponse.json(
      { error: "insufficient_permissions", message: "You do not have permission to update this preview." },
      { status: 403 },
    )
  }

  if (
    row.action_id !== "create_invoice_from_work_order" &&
    row.action_id !== "create_quote_from_work_order" &&
    row.action_id !== "draft_customer_message" &&
    row.action_id !== "create_follow_up_task" &&
    row.action_id !== "schedule_maintenance_visit" &&
    row.action_id !== "create_maintenance_plan_from_equipment" &&
    row.action_id !== "create_parts_reorder_request" &&
    row.action_id !== "bulk_invoice_completed_work_orders"
  ) {
    return NextResponse.json(
      {
        error: "unsupported_action",
        message: "Preview edits are not supported for this action type.",
      },
      { status: 400 },
    )
  }

  if (!PATCHABLE.has(row.status)) {
    return NextResponse.json(
      {
        error: "invalid_state",
        message: "Preview can only be edited while the action is prepared or awaiting confirmation.",
      },
      { status: 409 },
    )
  }

  const def = getPreparedWorkspaceActionDefinition(row.action_id)
  if (def && isFinancialAidenAction(def)) {
    const still = await canPrepareWorkspaceActionForUser({
      supabase: gate.supabase,
      organizationId,
      permissions: gate.permissions,
      actionId: row.action_id,
      isPlatformAdmin: gate.isPlatformAdmin,
    })
    if (!still) {
      return NextResponse.json(
        { error: "insufficient_permissions", message: "Financial action permissions failed re-check." },
        { status: 403 },
      )
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const merged =
    row.action_id === "create_invoice_from_work_order" ?
      mergeAndValidateInvoicePreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "create_quote_from_work_order" ?
      mergeAndValidateQuotePreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "create_follow_up_task" ?
      mergeAndValidateFollowUpTaskPreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "schedule_maintenance_visit" ?
      mergeAndValidateScheduleMaintenanceVisitPreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "create_maintenance_plan_from_equipment" ?
      mergeAndValidateCreateMaintenancePlanFromEquipmentPreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "create_parts_reorder_request" ?
      mergeAndValidateCreatePartsReorderRequestPreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "bulk_invoice_completed_work_orders" ?
      mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch(row.preview_payload ?? {}, body)
    : row.action_id === "draft_customer_message" ?
      mergeDraftCustomerMessagePreviewForPatch(row.preview_payload ?? {}, body)
    : { ok: false as const, message: "Preview edits are not supported for this action type." }

  if (!merged.ok) {
    return NextResponse.json({ error: "validation_error", message: merged.message }, { status: 400 })
  }

  const upd = await updatePreparedActionById(svc, organizationId, actionId, {
    preview_payload: merged.previewPayload,
  })
  if (upd.error || !upd.data) {
    return NextResponse.json({ error: "update_failed", message: upd.error?.message ?? "Update failed." }, { status: 500 })
  }

  const previewInner = merged.previewPayload.preview as { lineItems?: unknown[]; subject?: string; title?: string } | undefined
  const audit = await insertActionAuditLog(svc, {
    organization_id: organizationId,
    prepared_action_id: actionId,
    actor_user_id: gate.userId,
    event_type: "preview_updated",
    action_id: row.action_id,
    details:
      row.action_id === "create_invoice_from_work_order" || row.action_id === "create_quote_from_work_order" ?
        { lineItemCount: Array.isArray(previewInner?.lineItems) ? previewInner.lineItems.length : 0 }
      : row.action_id === "create_follow_up_task" ?
        { titleLen: typeof previewInner?.title === "string" ? previewInner.title.length : 0 }
      : row.action_id === "schedule_maintenance_visit" ?
        { visitDate: typeof previewInner?.suggestedDate === "string" ? previewInner.suggestedDate : "" }
      : row.action_id === "create_maintenance_plan_from_equipment" ?
        {
          nextDueDate:
            previewInner && typeof previewInner === "object" && "nextDueDate" in previewInner &&
            typeof (previewInner as { nextDueDate?: unknown }).nextDueDate === "string" ?
              String((previewInner as { nextDueDate: string }).nextDueDate)
            : "",
        }
      :       row.action_id === "create_parts_reorder_request" ?
        {
          lineCount: Array.isArray((previewInner as { lines?: unknown })?.lines) ?
            (previewInner as { lines: unknown[] }).lines.length
          : 0,
        }
      : row.action_id === "bulk_invoice_completed_work_orders" ?
        {
          excludedCount: Array.isArray((previewInner as { excludedWorkOrderIds?: unknown })?.excludedWorkOrderIds) ?
            (previewInner as { excludedWorkOrderIds: unknown[] }).excludedWorkOrderIds.length
          : 0,
        }
      : { subjectLen: typeof previewInner?.subject === "string" ? previewInner.subject.length : 0 },
  })
  if (audit.error) {
    return NextResponse.json({ error: "audit_failed", message: audit.error.message }, { status: 500 })
  }

  return NextResponse.json({ preparedAction: serializePreparedAction(upd.data) })
}

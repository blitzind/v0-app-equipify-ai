import type { SupabaseClient } from "@supabase/supabase-js"
import { canAccessAssignedWorkResource } from "@/lib/permissions/technician-scope"
import type { OrgPermissions } from "@/lib/permissions/model"
import type { SafeActionPrepareAnswer } from "@/lib/aiden/safe-actions/schema"
import { parseRemindAtIso } from "@/lib/aiden/safe-actions/schema"

export async function assertWorkOrderInOrg(
  supabase: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("work_orders")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()
  return Boolean(data)
}

export async function assertCustomerInOrg(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()
  return Boolean(data)
}

export type PrepareValidationFailure = { ok: false; code: string; message: string }
export type PrepareValidationOk = { ok: true }

/**
 * Mirrors execute-time RBAC + existence checks so we do not persist pending rows
 * the user cannot confirm (assigned scope, draft permissions, invalid IDs).
 */
export async function validatePreparedProposalForPrepare(args: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  proposal: SafeActionPrepareAnswer
}): Promise<PrepareValidationOk | PrepareValidationFailure> {
  const { supabase, organizationId, userId, permissions, proposal } = args

  switch (proposal.action_type) {
    case "create_follow_up_task": {
      if (!permissions.canEditWorkOrders) {
        return { ok: false, code: "forbidden", message: "Your role cannot prepare work order tasks." }
      }
      const woId = proposal.proposed_payload.work_order_id
      if (!(await assertWorkOrderInOrg(supabase, organizationId, woId))) {
        return { ok: false, code: "invalid_target", message: "That work order was not found in this workspace." }
      }
      const scopeOk = await canAccessAssignedWorkResource(supabase, {
        organizationId,
        userId,
        permissions,
        resource: { workOrderId: woId },
      })
      if (!scopeOk) {
        return {
          ok: false,
          code: "out_of_scope",
          message: "You can only prepare actions for work on your assigned jobs.",
        }
      }
      return { ok: true }
    }
    case "create_internal_note": {
      const payload = proposal.proposed_payload
      if (payload.target === "work_order") {
        if (!permissions.canEditWorkOrders) {
          return { ok: false, code: "forbidden", message: "Your role cannot prepare work order notes." }
        }
        const woId = payload.work_order_id
        if (!(await assertWorkOrderInOrg(supabase, organizationId, woId))) {
          return { ok: false, code: "invalid_target", message: "That work order was not found in this workspace." }
        }
        const scopeOk = await canAccessAssignedWorkResource(supabase, {
          organizationId,
          userId,
          permissions,
          resource: { workOrderId: woId },
        })
        if (!scopeOk) {
          return {
            ok: false,
            code: "out_of_scope",
            message: "You can only prepare notes for work orders you can access.",
          }
        }
        return { ok: true }
      }
      const customerId = payload.customer_id
      if (!(await assertCustomerInOrg(supabase, organizationId, customerId))) {
        return { ok: false, code: "invalid_target", message: "That customer was not found in this workspace." }
      }
      const scopeOk = await canAccessAssignedWorkResource(supabase, {
        organizationId,
        userId,
        permissions,
        resource: { customerId },
      })
      if (!scopeOk) {
        return {
          ok: false,
          code: "out_of_scope",
          message: "You can only prepare notes for customers tied to your assigned work.",
        }
      }
      return { ok: true }
    }
    case "create_reminder": {
      const p = proposal.proposed_payload
      const when = parseRemindAtIso(p.remind_at)
      if (!when) {
        return { ok: false, code: "invalid_time", message: "Reminder time is invalid — try a clear date and time." }
      }
      if (when.getTime() < Date.now() - 60_000) {
        return { ok: false, code: "invalid_time", message: "Reminder time must be in the future." }
      }
      const relType = p.related_entity_type ?? "none"
      if (relType === "work_order") {
        const wid = p.related_entity_id
        if (!wid) {
          return { ok: false, code: "invalid_payload", message: "Work order id is required for this reminder." }
        }
        if (!(await assertWorkOrderInOrg(supabase, organizationId, wid))) {
          return { ok: false, code: "invalid_target", message: "That work order was not found in this workspace." }
        }
        const scopeOk = await canAccessAssignedWorkResource(supabase, {
          organizationId,
          userId,
          permissions,
          resource: { workOrderId: wid },
        })
        if (!scopeOk) {
          return {
            ok: false,
            code: "out_of_scope",
            message: "You cannot queue reminders for work orders outside your assigned scope.",
          }
        }
      } else if (relType === "customer") {
        const cid = p.related_entity_id
        if (!cid) {
          return { ok: false, code: "invalid_payload", message: "Customer id is required for this reminder." }
        }
        if (!(await assertCustomerInOrg(supabase, organizationId, cid))) {
          return { ok: false, code: "invalid_target", message: "That customer was not found in this workspace." }
        }
        const scopeOk = await canAccessAssignedWorkResource(supabase, {
          organizationId,
          userId,
          permissions,
          resource: { customerId: cid },
        })
        if (!scopeOk) {
          return {
            ok: false,
            code: "out_of_scope",
            message: "You cannot queue reminders for customers outside your assigned scope.",
          }
        }
      }
      return { ok: true }
    }
    case "create_communication_draft": {
      if (!permissions.canManageCommunications) {
        return {
          ok: false,
          code: "forbidden",
          message: "Draft messages can only be prepared by teammates with communications management access.",
        }
      }
      const p = proposal.proposed_payload
      if (p.related_entity_type && !p.related_entity_id) {
        return { ok: false, code: "invalid_payload", message: "Related record id is missing for this draft." }
      }
      if (p.related_entity_id && p.related_entity_type === "work_order") {
        if (!(await assertWorkOrderInOrg(supabase, organizationId, p.related_entity_id))) {
          return { ok: false, code: "invalid_target", message: "Related work order was not found in this workspace." }
        }
        const scopeOk = await canAccessAssignedWorkResource(supabase, {
          organizationId,
          userId,
          permissions,
          resource: { workOrderId: p.related_entity_id },
        })
        if (!scopeOk) {
          return {
            ok: false,
            code: "out_of_scope",
            message: "You cannot link a draft to that work order.",
          }
        }
      }
      if (p.related_entity_id && p.related_entity_type === "customer") {
        if (!(await assertCustomerInOrg(supabase, organizationId, p.related_entity_id))) {
          return { ok: false, code: "invalid_target", message: "Related customer was not found in this workspace." }
        }
        const scopeOk = await canAccessAssignedWorkResource(supabase, {
          organizationId,
          userId,
          permissions,
          resource: { customerId: p.related_entity_id },
        })
        if (!scopeOk) {
          return {
            ok: false,
            code: "out_of_scope",
            message: "You cannot link a draft to that customer.",
          }
        }
      }
      if (p.recipient_customer_id) {
        if (!(await assertCustomerInOrg(supabase, organizationId, p.recipient_customer_id))) {
          return { ok: false, code: "invalid_target", message: "Recipient customer was not found in this workspace." }
        }
        const scopeOk = await canAccessAssignedWorkResource(supabase, {
          organizationId,
          userId,
          permissions,
          resource: { customerId: p.recipient_customer_id },
        })
        if (!scopeOk) {
          return {
            ok: false,
            code: "out_of_scope",
            message: "You cannot address this draft to that customer.",
          }
        }
      }
      return { ok: true }
    }
    default:
      return { ok: false, code: "unsupported_action", message: "Unsupported action type." }
  }
}

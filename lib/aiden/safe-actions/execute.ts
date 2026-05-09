import type { SupabaseClient } from "@supabase/supabase-js"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import type { RelatedEntityType } from "@/lib/notifications/types"
import { canAccessAssignedWorkResource } from "@/lib/permissions/technician-scope"
import type { OrgPermissions } from "@/lib/permissions/model"
import type { SafeActionPrepareAnswer } from "@/lib/aiden/safe-actions/schema"
import { parseRemindAtIso } from "@/lib/aiden/safe-actions/schema"
import { assertCustomerInOrg, assertWorkOrderInOrg } from "@/lib/aiden/safe-actions/resource-checks"

export type ExecuteSafeActionParams = {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  parsed: SafeActionPrepareAnswer
}

export type ExecuteSafeActionResult =
  | { ok: true; summary: string; result: Record<string, unknown> }
  | { ok: false; code: string; message: string }

export async function executeSafeAction(params: ExecuteSafeActionParams): Promise<ExecuteSafeActionResult> {
  const { supabase, organizationId, userId, permissions, parsed } = params

  switch (parsed.action_type) {
    case "create_follow_up_task":
      return executeFollowUpTask({ supabase, organizationId, userId, permissions, parsed })
    case "create_internal_note":
      return executeInternalNote({ supabase, organizationId, userId, permissions, parsed })
    case "create_reminder":
      return executeReminder({ supabase, organizationId, userId, permissions, parsed })
    case "create_communication_draft":
      return executeCommunicationDraft({ supabase, organizationId, userId, permissions, parsed })
    default:
      return { ok: false, code: "unsupported_action", message: "Unsupported action type." }
  }
}

async function executeFollowUpTask(args: ExecuteSafeActionParams): Promise<ExecuteSafeActionResult> {
  const { supabase, organizationId, userId, permissions, parsed } = args
  if (parsed.action_type !== "create_follow_up_task") {
    return { ok: false, code: "invalid_payload", message: "Wrong payload shape." }
  }
  if (!permissions.canEditWorkOrders) {
    return { ok: false, code: "forbidden", message: "Your role cannot add work order tasks." }
  }

  const woId = parsed.proposed_payload.work_order_id
  const okWo = await assertWorkOrderInOrg(supabase, organizationId, woId)
  if (!okWo) return { ok: false, code: "not_found", message: "Work order was not found." }

  const scopeOk = await canAccessAssignedWorkResource(supabase, {
    organizationId,
    userId,
    permissions,
    resource: { workOrderId: woId },
  })
  if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot modify this work order." }

  const { data: maxRow } = await supabase
    .from("work_order_tasks")
    .select("sort_order")
    .eq("organization_id", organizationId)
    .eq("work_order_id", woId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxSort = typeof (maxRow as { sort_order?: number } | null)?.sort_order === "number"
    ? (maxRow as { sort_order: number }).sort_order
    : -1

  const { data: inserted, error } = await supabase
    .from("work_order_tasks")
    .insert({
      organization_id: organizationId,
      work_order_id: woId,
      title: parsed.proposed_payload.task_title.trim(),
      description: parsed.proposed_payload.task_description?.trim() || null,
      completed: false,
      sort_order: maxSort + 1,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, code: "insert_failed", message: error.message }

  const taskId = (inserted as { id?: string } | null)?.id
  return {
    ok: true,
    summary: `Follow-up task on work order`,
    result: { work_order_task_id: taskId ?? null, work_order_id: woId },
  }
}

async function executeInternalNote(args: ExecuteSafeActionParams): Promise<ExecuteSafeActionResult> {
  const { supabase, organizationId, userId, permissions, parsed } = args
  if (parsed.action_type !== "create_internal_note") {
    return { ok: false, code: "invalid_payload", message: "Wrong payload shape." }
  }

  const payload = parsed.proposed_payload
  if (payload.target === "work_order") {
    if (!permissions.canEditWorkOrders) {
      return { ok: false, code: "forbidden", message: "Your role cannot edit work order notes." }
    }
    const woId = payload.work_order_id
    const okWo = await assertWorkOrderInOrg(supabase, organizationId, woId)
    if (!okWo) return { ok: false, code: "not_found", message: "Work order was not found." }

    const scopeOk = await canAccessAssignedWorkResource(supabase, {
      organizationId,
      userId,
      permissions,
      resource: { workOrderId: woId },
    })
    if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot modify this work order." }

    const { data: wo, error: woErr } = await supabase
      .from("work_orders")
      .select("notes")
      .eq("organization_id", organizationId)
      .eq("id", woId)
      .maybeSingle()

    if (woErr || !wo) return { ok: false, code: "load_failed", message: woErr?.message ?? "Work order missing." }

    const prev = ((wo as { notes?: string | null }).notes ?? "").trim()
    const stamp = `[AIden note ${new Date().toISOString()}]`
    const addition = payload.body.trim()
    const next = prev ? `${prev}\n\n${stamp}\n${addition}` : `${stamp}\n${addition}`

    const { error: upErr } = await supabase
      .from("work_orders")
      .update({ notes: next, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", woId)

    if (upErr) return { ok: false, code: "update_failed", message: upErr.message }
    return { ok: true, summary: "Internal work order note appended", result: { work_order_id: woId } }
  }

  const customerId = payload.customer_id
  const okCust = await assertCustomerInOrg(supabase, organizationId, customerId)
  if (!okCust) return { ok: false, code: "not_found", message: "Customer was not found." }

  const scopeOk = await canAccessAssignedWorkResource(supabase, {
    organizationId,
    userId,
    permissions,
    resource: { customerId },
  })
  if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot add notes for this customer." }

  const title = parsed.title.trim().slice(0, 240)
  const body = payload.body.trim()
  const { id, error } = await logCommunicationEvent(supabase, {
    organizationId,
    channel: "system",
    direction: "outbound",
    eventType: "aiden_internal_note",
    title,
    summary: body.slice(0, 500),
    body,
    audience: "organization",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "customer",
    recipientCustomerId: customerId,
    relatedEntityType: "customer",
    relatedEntityId: customerId,
    provider: "internal",
    metadata: { source: "aiden_safe_actions_phase6" },
    createdBy: userId,
  })

  if (error || !id) return { ok: false, code: "insert_failed", message: error ?? "Could not save internal note." }
  return { ok: true, summary: "Internal customer note recorded", result: { communication_event_id: id } }
}

async function executeReminder(args: ExecuteSafeActionParams): Promise<ExecuteSafeActionResult> {
  const { supabase, organizationId, userId, permissions, parsed } = args
  if (parsed.action_type !== "create_reminder") {
    return { ok: false, code: "invalid_payload", message: "Wrong payload shape." }
  }

  const p = parsed.proposed_payload
  const when = parseRemindAtIso(p.remind_at)
  if (!when) return { ok: false, code: "invalid_time", message: "Invalid reminder time." }

  const now = Date.now()
  if (when.getTime() < now - 60_000) {
    return { ok: false, code: "invalid_time", message: "Reminder time must be in the future." }
  }

  const relType = p.related_entity_type ?? "none"
  let relatedEntityType: RelatedEntityType | null = null
  let relatedEntityId: string | null = null

  if (relType === "work_order") {
    const wid = p.related_entity_id
    if (!wid) return { ok: false, code: "invalid_payload", message: "Work order id required." }
    const okWo = await assertWorkOrderInOrg(supabase, organizationId, wid)
    if (!okWo) return { ok: false, code: "not_found", message: "Work order was not found." }
    const scopeOk = await canAccessAssignedWorkResource(supabase, {
      organizationId,
      userId,
      permissions,
      resource: { workOrderId: wid },
    })
    if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot set reminders for this work order." }
    relatedEntityType = "work_order"
    relatedEntityId = wid
  } else if (relType === "customer") {
    const cid = p.related_entity_id
    if (!cid) return { ok: false, code: "invalid_payload", message: "Customer id required." }
    const okC = await assertCustomerInOrg(supabase, organizationId, cid)
    if (!okC) return { ok: false, code: "not_found", message: "Customer was not found." }
    const scopeOk = await canAccessAssignedWorkResource(supabase, {
      organizationId,
      userId,
      permissions,
      resource: { customerId: cid },
    })
    if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot set reminders for this customer." }
    relatedEntityType = "customer"
    relatedEntityId = cid
  }

  const title = parsed.title.trim().slice(0, 240)
  const summary = (p.detail ?? parsed.explanation).trim().slice(0, 500)

  const { id, error } = await logCommunicationEvent(supabase, {
    organizationId,
    channel: "in_app",
    direction: "outbound",
    eventType: "staff_reminder",
    title,
    summary,
    body: p.detail?.trim() ?? null,
    audience: "organization",
    countsTowardUnread: true,
    deliveryStatus: "pending",
    recipientKind: "none",
    relatedEntityType,
    relatedEntityId,
    provider: "internal",
    scheduledAt: when.toISOString(),
    metadata: { source: "aiden_safe_actions_phase6" },
    createdBy: userId,
  })

  if (error || !id) return { ok: false, code: "insert_failed", message: error ?? "Could not create reminder." }
  return { ok: true, summary: "Reminder scheduled", result: { communication_event_id: id } }
}

async function executeCommunicationDraft(args: ExecuteSafeActionParams): Promise<ExecuteSafeActionResult> {
  const { supabase, organizationId, userId, permissions, parsed } = args
  if (parsed.action_type !== "create_communication_draft") {
    return { ok: false, code: "invalid_payload", message: "Wrong payload shape." }
  }

  if (!permissions.canManageCommunications) {
    return { ok: false, code: "forbidden", message: "Drafts require manager communications access." }
  }

  const p = parsed.proposed_payload
  if (p.related_entity_type && !p.related_entity_id) {
    return { ok: false, code: "invalid_payload", message: "Related entity id required." }
  }

  if (p.related_entity_id && p.related_entity_type) {
    if (p.related_entity_type === "work_order") {
      const okWo = await assertWorkOrderInOrg(supabase, organizationId, p.related_entity_id)
      if (!okWo) return { ok: false, code: "not_found", message: "Related work order was not found." }
      const scopeOk = await canAccessAssignedWorkResource(supabase, {
        organizationId,
        userId,
        permissions,
        resource: { workOrderId: p.related_entity_id },
      })
      if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot link a draft to this work order." }
    }
    if (p.related_entity_type === "customer") {
      const okC = await assertCustomerInOrg(supabase, organizationId, p.related_entity_id)
      if (!okC) return { ok: false, code: "not_found", message: "Related customer was not found." }
      const scopeOk = await canAccessAssignedWorkResource(supabase, {
        organizationId,
        userId,
        permissions,
        resource: { customerId: p.related_entity_id },
      })
      if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot link a draft to this customer." }
    }
  }

  if (p.recipient_customer_id) {
    const okC = await assertCustomerInOrg(supabase, organizationId, p.recipient_customer_id)
    if (!okC) return { ok: false, code: "not_found", message: "Recipient customer was not found." }
    const scopeOk = await canAccessAssignedWorkResource(supabase, {
      organizationId,
      userId,
      permissions,
      resource: { customerId: p.recipient_customer_id },
    })
    if (!scopeOk) return { ok: false, code: "forbidden", message: "You cannot address this customer." }
  }

  const subject = p.subject.trim()
  const insert = {
    organization_id: organizationId,
    channel: "email" as const,
    direction: "outbound" as const,
    event_type: "communication_draft",
    title: subject.slice(0, 240),
    summary: p.summary?.trim() ?? null,
    body: p.body?.trim() ?? null,
    audience: "organization" as const,
    counts_toward_unread: false,
    delivery_status: "pending" as const,
    recipient_kind: p.recipient_customer_id ? ("customer" as const) : ("none" as const),
    recipient_customer_id: p.recipient_customer_id ?? null,
    related_entity_type: (p.related_entity_type ?? null) as RelatedEntityType | null,
    related_entity_id: p.related_entity_id ?? null,
    provider: "manual" as const,
    metadata: {
      is_draft: true,
      drafted_by: userId,
      drafted_at: new Date().toISOString(),
      source: "aiden_safe_actions_phase6",
    },
    created_by: userId,
  }

  const { data, error } = await supabase.from("communication_events").insert(insert).select("id").maybeSingle()

  if (error) return { ok: false, code: "insert_failed", message: error.message }
  const id = (data as { id?: string } | null)?.id ?? null
  return { ok: true, summary: "Communication draft saved (not sent)", result: { communication_event_id: id } }
}

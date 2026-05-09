import { NextResponse } from "next/server"
import { resolveRecipientCustomerIdForTask } from "@/lib/follow-up-automation/resolve-customer"
import { logFollowUpAutomationUsage } from "@/lib/follow-up-automation/log-usage"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import type { FollowUpEntityType } from "@/lib/follow-up-automation/types"
import type { RelatedEntityType } from "@/lib/notifications/types"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function toRelatedEntityType(entityType: FollowUpEntityType): RelatedEntityType | null {
  switch (entityType) {
    case "prospect":
      return "prospect"
    case "work_order":
      return "work_order"
    case "invoice":
      return "invoice"
    case "customer":
      return "customer"
    case "equipment":
      return "equipment"
    default:
      return null
  }
}

export async function POST(_request: Request, context: { params: Promise<{ organizationId: string; taskId: string }> }) {
  const { organizationId, taskId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(taskId)) return jsonError("Invalid id.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageCommunications")
  if ("error" in gate) return gate.error

  const { data: task, error: tErr } = await gate.supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle()

  if (tErr) return jsonError(tErr.message, 500)
  if (!task) return jsonError("Task not found.", 404)
  if (task.status !== "approved") return jsonError("Approve and review the automation draft before handing off.", 400)

  const draft = task.draft_payload as { subject?: string; body?: string; channel?: string } | null
  const subject = typeof draft?.subject === "string" ? draft.subject.trim() : ""
  const body = typeof draft?.body === "string" ? draft.body.trim() : ""
  if (!subject || !body) return jsonError("Missing draft subject/body — regenerate the automation draft first.", 400)

  const channel = draft?.channel === "sms" ? "sms" : "email"

  const customerId = await resolveRecipientCustomerIdForTask(
    gate.supabase,
    organizationId,
    task.entity_type as FollowUpEntityType,
    task.entity_id as string,
  )

  const relatedType = toRelatedEntityType(task.entity_type as FollowUpEntityType)

  const { id: commId, error: commErr } = await logCommunicationEvent(gate.supabase, {
    organizationId,
    channel,
    direction: "outbound",
    eventType: "ai_followup_email_draft",
    title: subject.slice(0, 200),
    summary: body.slice(0, 280),
    body,
    audience: "organization",
    countsTowardUnread: true,
    deliveryStatus: "pending",
    recipientKind: customerId ? "customer" : "external",
    recipientCustomerId: customerId,
    relatedEntityType: relatedType ?? undefined,
    relatedEntityId: task.entity_id as string,
    provider: "internal",
    metadata: {
      follow_up_automation_phase: 23,
      follow_up_task_id: taskId,
      rule_key: task.rule_key,
      handoff_only: true,
    },
    createdBy: gate.userId,
  })

  if (commErr || !commId) return jsonError(commErr ?? "Could not create communications row.", 500)

  const now = new Date().toISOString()
  const { error: uErr } = await gate.supabase
    .from("follow_up_tasks")
    .update({
      status: "sent",
      communication_event_id: commId,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", taskId)

  if (uErr) return jsonError(uErr.message, 500)

  await logFollowUpAutomationUsage({
    supabase: gate.supabase,
    organizationId,
    userId: gate.userId,
    eventType: "handoff",
    metadata: { task_id: taskId, communication_event_id: commId },
  })

  return NextResponse.json({ ok: true, communicationEventId: commId })
}

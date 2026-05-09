import { NextResponse } from "next/server"
import { logFollowUpAutomationUsage } from "@/lib/follow-up-automation/log-usage"
import { canAccessInvoiceFollowUpTasks } from "@/lib/follow-up-automation/invoice-access"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { logProspectFollowUpAutomationReview } from "@/lib/prospects/follow-up-task-timeline"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(_request: Request, context: { params: Promise<{ organizationId: string; taskId: string }> }) {
  const { organizationId, taskId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(taskId)) return jsonError("Invalid id.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageCommunications")
  if ("error" in gate) return gate.error

  const { data: task, error: tErr } = await gate.supabase
    .from("follow_up_tasks")
    .select("entity_type, entity_id, rule_key")
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle()

  if (tErr) return jsonError(tErr.message, 500)
  if (!task) return jsonError("Task not found.", 404)
  if (task.entity_type === "invoice" && !canAccessInvoiceFollowUpTasks(gate.permissions)) {
    return jsonError("Billing or financial access is required to dismiss invoice follow-ups.", 403)
  }

  const now = new Date().toISOString()
  const { error } = await gate.supabase
    .from("follow_up_tasks")
    .update({
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .in("status", ["pending", "approved"])

  if (error) return jsonError(error.message, 500)

  await logFollowUpAutomationUsage({
    supabase: gate.supabase,
    organizationId,
    userId: gate.userId,
    eventType: "dismissed",
    metadata: { task_id: taskId },
  })

  if (task.entity_type === "prospect") {
    await logProspectFollowUpAutomationReview({
      supabase: gate.supabase,
      organizationId,
      prospectId: task.entity_id as string,
      ruleKey: task.rule_key as string,
      taskId,
      action: "dismissed",
      userId: gate.userId,
    })
  }

  return NextResponse.json({ ok: true })
}

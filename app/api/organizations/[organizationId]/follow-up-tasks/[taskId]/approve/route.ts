import { NextResponse } from "next/server"
import { mergeFollowUpAutomationConfig } from "@/lib/follow-up-automation/merge-config"
import { generateFollowUpAutomationDraft } from "@/lib/follow-up-automation/generate-draft"
import { resolveDraftCategorySettings } from "@/lib/follow-up-automation/draft-category"
import { resolveAiExecutionMode } from "@/lib/ai/execution-mode"
import { logFollowUpAutomationUsage } from "@/lib/follow-up-automation/log-usage"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { canAccessInvoiceFollowUpTasks } from "@/lib/follow-up-automation/invoice-access"
import { logProspectFollowUpAutomationReview } from "@/lib/prospects/follow-up-task-timeline"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string; taskId: string }> }) {
  const { organizationId, taskId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(taskId)) return jsonError("Invalid id.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageCommunications")
  if ("error" in gate) return gate.error

  const execMode = await resolveAiExecutionMode({ organizationId })
  if (execMode.mode === "mock_trial") {
    return jsonError(
      "Trial AI preview — automated follow-up approval is not available during trial. Review drafts manually or upgrade for outbound automation.",
      422,
    )
  }

  let generateAi = true
  try {
    const j = (await request.json()) as { generateAi?: boolean }
    if (typeof j.generateAi === "boolean") generateAi = j.generateAi
  } catch {
    generateAi = true
  }

  const { data: task, error: tErr } = await gate.supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle()

  if (tErr) return jsonError(tErr.message, 500)
  if (!task) return jsonError("Task not found.", 404)
  if (task.entity_type === "invoice" && !canAccessInvoiceFollowUpTasks(gate.permissions)) {
    return jsonError("Billing or financial access is required to approve invoice follow-ups.", 403)
  }
  if (task.status !== "pending") return jsonError("Only pending tasks can be approved.", 400)

  const { data: settingsRow } = await gate.supabase
    .from("follow_up_automation_settings")
    .select("config")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const cfg = mergeFollowUpAutomationConfig((settingsRow as { config?: unknown } | null)?.config ?? {})
  const cat = resolveDraftCategorySettings(cfg, {
    entityType: task.entity_type as string,
    ruleKey: task.rule_key as string,
  })

  const { data: orgRow } = await gate.supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle()
  const orgName = (orgRow as { name?: string } | null)?.name ?? null

  let draftPayload: Record<string, unknown> = { ...(task.draft_payload as Record<string, unknown> | undefined) }

  if (generateAi && cat?.aiDraftsEnabled) {
    try {
      const preferredChannel = cat.channels.includes("sms") && !cat.channels.includes("email") ? "sms" : "email"
      const draft = await generateFollowUpAutomationDraft({
        organizationId,
        ruleKey: task.rule_key as string,
        entityType: task.entity_type as string,
        metadata: (task.metadata as Record<string, unknown>) ?? {},
        organizationName: orgName,
        preferredChannel,
      })
      draftPayload = {
        subject: draft.subject,
        body: draft.body,
        channel: preferredChannel,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Draft generation failed."
      await gate.supabase
        .from("follow_up_tasks")
        .update({
          status: "failed",
          metadata: {
            ...(typeof task.metadata === "object" && task.metadata ? task.metadata : {}),
            last_error: message.slice(0, 500),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
      return jsonError(message, 502)
    }
  } else if (!draftPayload.subject || !draftPayload.body) {
    draftPayload = {
      ...draftPayload,
      subject: typeof draftPayload.subject === "string" ? draftPayload.subject : String(task.metadata?.summary ?? "Follow-up"),
      body: typeof draftPayload.body === "string" ? draftPayload.body : "",
      channel: draftPayload.channel ?? "email",
    }
  }

  const now = new Date().toISOString()
  const { error: uErr } = await gate.supabase
    .from("follow_up_tasks")
    .update({
      status: "approved",
      draft_payload: draftPayload,
      updated_at: now,
    })
    .eq("id", taskId)

  if (uErr) return jsonError(uErr.message, 500)

  await logFollowUpAutomationUsage({
    supabase: gate.supabase,
    organizationId,
    userId: gate.userId,
    eventType: "approved",
    metadata: { task_id: taskId, ai: Boolean(generateAi && cat?.aiDraftsEnabled) },
  })

  if (task.entity_type === "prospect") {
    await logProspectFollowUpAutomationReview({
      supabase: gate.supabase,
      organizationId,
      prospectId: task.entity_id as string,
      ruleKey: task.rule_key as string,
      taskId,
      action: "approved",
      userId: gate.userId,
    })
  }

  return NextResponse.json({
    ok: true,
    draft: {
      subject: draftPayload.subject,
      body: draftPayload.body,
      channel: draftPayload.channel ?? "email",
    },
  })
}

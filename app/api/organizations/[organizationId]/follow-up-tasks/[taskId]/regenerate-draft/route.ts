import { NextResponse } from "next/server"
import { mergeFollowUpAutomationConfig } from "@/lib/follow-up-automation/merge-config"
import { generateFollowUpAutomationDraft } from "@/lib/follow-up-automation/generate-draft"
import { logFollowUpAutomationUsage } from "@/lib/follow-up-automation/log-usage"
import type { FollowUpAutomationConfig, FollowUpEntityType } from "@/lib/follow-up-automation/types"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function categoryCfg(
  cfg: FollowUpAutomationConfig,
  entityType: FollowUpEntityType,
): { aiDraftsEnabled: boolean; channels: ("email" | "sms")[] } | null {
  switch (entityType) {
    case "prospect":
      return cfg.categories.prospects
    case "work_order":
      return cfg.categories.work_orders
    case "invoice":
      return cfg.categories.invoices
    case "customer":
      return cfg.categories.customers
    case "equipment":
      return cfg.categories.equipment
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
  if (task.status === "dismissed" || task.status === "sent") return jsonError("Task is closed.", 400)

  const { data: settingsRow } = await gate.supabase
    .from("follow_up_automation_settings")
    .select("config")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const cfg = mergeFollowUpAutomationConfig((settingsRow as { config?: unknown } | null)?.config ?? {})
  const cat = categoryCfg(cfg, task.entity_type as FollowUpEntityType)
  if (!cat?.aiDraftsEnabled) return jsonError("AI drafts are disabled for this category.", 400)

  const { data: orgRow } = await gate.supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle()
  const orgName = (orgRow as { name?: string } | null)?.name ?? null

  const preferredChannel = cat.channels.includes("sms") && !cat.channels.includes("email") ? "sms" : "email"

  try {
    const draft = await generateFollowUpAutomationDraft({
      organizationId,
      ruleKey: task.rule_key as string,
      entityType: task.entity_type as string,
      metadata: (task.metadata as Record<string, unknown>) ?? {},
      organizationName: orgName,
      preferredChannel,
    })

    const draftPayload = {
      subject: draft.subject,
      body: draft.body,
      channel: preferredChannel,
    }

    const now = new Date().toISOString()
    const { error: uErr } = await gate.supabase
      .from("follow_up_tasks")
      .update({
        draft_payload: draftPayload,
        updated_at: now,
      })
      .eq("id", taskId)

    if (uErr) return jsonError(uErr.message, 500)

    await logFollowUpAutomationUsage({
      supabase: gate.supabase,
      organizationId,
      userId: gate.userId,
      eventType: "draft_generated",
      metadata: { task_id: taskId },
    })

    return NextResponse.json({ ok: true, draft: draftPayload })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return jsonError(message, 502)
  }
}

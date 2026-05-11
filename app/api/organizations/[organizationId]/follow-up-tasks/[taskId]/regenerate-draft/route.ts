import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { tryConsumeAiOperationSlot } from "@/lib/ai/operation-rate-limit"
import { mergeFollowUpAutomationConfig } from "@/lib/follow-up-automation/merge-config"
import { generateFollowUpAutomationDraft } from "@/lib/follow-up-automation/generate-draft"
import { resolveDraftCategorySettings } from "@/lib/follow-up-automation/draft-category"
import { logFollowUpAutomationUsage } from "@/lib/follow-up-automation/log-usage"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { canAccessInvoiceFollowUpTasks } from "@/lib/follow-up-automation/invoice-access"

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

  const {
    data: { user: authUser },
  } = await gate.supabase.auth.getUser()
  const isPlatformAdmin = Boolean(authUser?.email && isPlatformAdminEmail(authUser.email))
  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(gate.supabase, organizationId, "ai")
    if (!planGate.ok) {
      return NextResponse.json(
        { error: planGate.code, message: planGate.message },
        { status: planGate.httpStatus },
      )
    }
  }

  try {
    const admin = createServiceRoleSupabaseClient()
    const rl = await tryConsumeAiOperationSlot(admin, organizationId, "follow_up_regenerate_draft")
    if (!rl.allowed) {
      return jsonError("Draft regeneration rate limit — try again in a minute.", 429)
    }
  } catch {
    /* rate limit table optional — continue without blocking */
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
    return jsonError("Billing or financial access is required to regenerate invoice drafts.", 403)
  }
  if (task.status === "dismissed" || task.status === "sent") return jsonError("Task is closed.", 400)

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
  if (!cat?.aiDraftsEnabled) return jsonError("AI drafts are disabled for this automation category.", 400)

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

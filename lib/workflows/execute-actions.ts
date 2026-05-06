import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import { requireCanCreateRecordForOrganization } from "@/lib/billing/server-guard"
import type { WorkflowActionSpec, WorkflowAutomationRow, WorkflowEventContext } from "./types"
import { resolveWorkflowActorUserId } from "./automation-actor"

export type LogFn = (step: string, message: string, metadata?: Record<string, unknown>) => Promise<void>

function actionsList(automation: WorkflowAutomationRow): WorkflowActionSpec[] {
  const raw = automation.action_config as { actions?: WorkflowActionSpec[] }
  return Array.isArray(raw?.actions) ? raw.actions : []
}

export async function executeWorkflowActions(args: {
  supabase: SupabaseClient
  automation: WorkflowAutomationRow
  ctx: WorkflowEventContext
  log: LogFn
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, automation, ctx, log } = args
  const organizationId = automation.organization_id
  const acts = actionsList(automation)
  if (acts.length === 0) {
    await log("noop", "No actions configured.")
    return { ok: true }
  }

  const actorId = await resolveWorkflowActorUserId(supabase, organizationId, automation.created_by)

  for (let i = 0; i < acts.length; i++) {
    const a = acts[i]!
    const cfg = (a.config ?? {}) as Record<string, unknown>
    try {
      const r = await runOneAction({
        supabase,
        organizationId,
        ctx,
        automation,
        action: a,
        cfg,
        actorId,
        log,
      })
      if (!r.ok) return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await log(`action_${i}_error`, msg, { type: a.type })
      return { ok: false, error: msg }
    }
  }
  return { ok: true }
}

async function runOneAction(input: {
  supabase: SupabaseClient
  organizationId: string
  ctx: WorkflowEventContext
  automation: WorkflowAutomationRow
  action: WorkflowActionSpec
  cfg: Record<string, unknown>
  actorId: string | null
  log: LogFn
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, organizationId, ctx, automation, action, cfg, actorId, log } = input
  const wo = ctx.work_order as Record<string, unknown> | undefined
  const woId = typeof wo?.id === "string" ? wo.id : null

  switch (action.type) {
    case "notify_internal_user": {
      const title = String(cfg.title ?? "Automation")
      const summary = String(cfg.summary ?? automation.name)
      const recipientUserId = typeof cfg.user_id === "string" ? cfg.user_id : actorId
      await supabase.from("communication_events").insert({
        organization_id: organizationId,
        channel: "in_app",
        direction: "outbound",
        event_type: "workflow_automation",
        title,
        summary,
        audience: "organization",
        counts_toward_unread: true,
        delivery_status: "sent",
        recipient_kind: recipientUserId ? "user" : "none",
        recipient_user_id: recipientUserId,
        related_entity_type: woId ? "work_order" : "organization",
        related_entity_id: woId ?? undefined,
        provider: "manual",
        metadata: { automation_id: automation.id, trigger: ctx.trigger_type },
        sent_at: new Date().toISOString(),
        created_by: actorId,
      })
      await log("notify_internal_user", summary.slice(0, 500))
      return { ok: true }
    }

    case "send_email": {
      const subject = String(cfg.subject ?? `[Automation] ${automation.name}`)
      const body = String(cfg.body ?? "")
      const to = String(cfg.to ?? "")
      await supabase.from("communication_events").insert({
        organization_id: organizationId,
        channel: "email",
        direction: "outbound",
        event_type: "workflow_email",
        title: subject,
        summary: body.slice(0, 500),
        body,
        audience: "organization",
        recipient_kind: to ? "external" : "none",
        recipient_address: to || null,
        delivery_status: "queued",
        related_entity_type: woId ? "work_order" : null,
        related_entity_id: woId ?? null,
        provider: "manual",
        metadata: { automation_id: automation.id, trigger: ctx.trigger_type },
        created_by: actorId,
      })
      await log("send_email", `Queued email: ${subject}`)
      return { ok: true }
    }

    case "send_sms": {
      await log("send_sms", "SMS dispatch not wired — logged only.", { to: cfg.to })
      return { ok: true }
    }

    case "assign_technician": {
      const techId = typeof cfg.user_id === "string" ? cfg.user_id : null
      const targetWo = typeof cfg.work_order_id === "string" ? cfg.work_order_id : woId
      if (!techId || !targetWo) {
        await log("assign_technician", "Skipped — missing user_id or work_order_id.")
        return { ok: true }
      }
      const { error } = await supabase
        .from("work_orders")
        .update({ assigned_user_id: techId, updated_at: new Date().toISOString() })
        .eq("id", targetWo)
        .eq("organization_id", organizationId)
      if (error) return { ok: false, error: error.message }
      await log("assign_technician", `Assigned ${techId} to WO ${targetWo}`)
      return { ok: true }
    }

    case "update_status": {
      const entity = String(cfg.entity ?? "work_order")
      const status = String(cfg.status ?? "")
      if (!status) {
        await log("update_status", "Skipped — empty status.")
        return { ok: true }
      }
      if (entity === "work_order" && woId) {
        const { error } = await supabase
          .from("work_orders")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", woId)
          .eq("organization_id", organizationId)
        if (error) return { ok: false, error: error.message }
        await log("update_status", `Work order ${woId} → ${status}`)
      } else {
        await log("update_status", "Skipped — no work_order context.")
      }
      return { ok: true }
    }

    case "create_followup_task": {
      const title = String(cfg.title ?? `Follow-up: ${automation.name}`)
      const description = String(cfg.description ?? "")
      const gate = await requireCanCreateRecordForOrganization(supabase, organizationId, "org_task")
      if (!gate.ok) {
        await log("create_followup_task", gate.message)
        return { ok: true }
      }
      const { error } = await supabase.from("org_tasks").insert({
        organization_id: organizationId,
        title,
        description,
        source_type: "workflow_automation",
        source_id: automation.id,
        status: "open",
      })
      if (error) return { ok: false, error: error.message }
      await log("create_followup_task", title)
      return { ok: true }
    }

    case "create_work_order": {
      const customerId = typeof cfg.customer_id === "string" ? cfg.customer_id : (wo?.customer_id as string | undefined)
      const equipmentId = typeof cfg.equipment_id === "string" ? cfg.equipment_id : (wo?.equipment_id as string | undefined)
      const titleText = String(cfg.title ?? `Automated work order — ${automation.name}`)
      if (!customerId || !equipmentId || !actorId) {
        await log("create_work_order", "Skipped — missing customer_id, equipment_id, or actor.")
        return { ok: true }
      }
      const gate = await requireCanCreateRecordForOrganization(supabase, organizationId, "work_order")
      if (!gate.ok) {
        await log("create_work_order", gate.message)
        return { ok: true }
      }
      const { error } = await supabase.from("work_orders").insert({
        organization_id: organizationId,
        customer_id: customerId,
        equipment_id: equipmentId,
        title: titleText.slice(0, 500),
        status: typeof cfg.status === "string" ? cfg.status : "open",
        priority: typeof cfg.priority === "string" ? cfg.priority : "normal",
        type: typeof cfg.type === "string" ? cfg.type : "repair",
        notes: typeof cfg.notes === "string" ? cfg.notes : null,
        created_by: actorId,
        repair_log: {},
      } as never)
      if (error) return { ok: false, error: error.message }
      await log("create_work_order", titleText.slice(0, 200))
      return { ok: true }
    }

    case "create_ai_task": {
      const task = String(cfg.task ?? "workflow_trigger")
      const inputJson = (cfg.input_json && typeof cfg.input_json === "object"
        ? cfg.input_json
        : { automation_id: automation.id, trigger: ctx.trigger_type, context: wo ?? {} }) as Record<
        string,
        unknown
      >
      if (!actorId) {
        await log("create_ai_task", "Skipped — no actor user id.")
        return { ok: true }
      }
      const res = await insertQueuedAiJob(supabase, {
        organization_id: organizationId,
        created_by: actorId,
        task,
        input_json: inputJson,
        source_type: "workflow_automation",
        source_id: automation.id,
      })
      if ("error" in res) {
        return { ok: false, error: res.error }
      }
      await log("create_ai_task", `Queued AI job ${res.jobId}`)
      return { ok: true }
    }

    default:
      await log("unknown_action", `Unsupported action type: ${(action as WorkflowActionSpec).type}`)
      return { ok: true }
  }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canUseFeature } from "@/lib/billing/entitlements"
import { loadOrgBillingContext } from "@/lib/billing/server-guard"
import { isTrialActive } from "@/lib/billing/subscriptions"
import { evaluateConditions } from "./conditions"
import { executeWorkflowActions } from "./execute-actions"
import type { WorkflowAutomationRow, WorkflowEventContext, WorkflowTriggerType } from "./types"

export type DispatchResult = {
  evaluated: number
  executed: number
  skippedPlan?: boolean
  errors: string[]
}

function normalizeContext(ctx: WorkflowEventContext): WorkflowEventContext {
  const wo = ctx.work_order as Record<string, unknown> | undefined
  const inv = ctx.invoice as Record<string, unknown> | undefined
  let daysOverdue: number | undefined
  if (inv?.due_date && typeof inv.due_date === "string") {
    const today = ctx.today ?? new Date().toISOString().slice(0, 10)
    daysOverdue = Math.max(
      0,
      Math.ceil(
        (new Date(today + "T12:00:00").getTime() - new Date(String(inv.due_date) + "T12:00:00").getTime()) /
          86400000,
      ),
    )
  }
  return {
    ...ctx,
    invoice:
      inv && daysOverdue !== undefined
        ? { ...inv, days_overdue: daysOverdue }
        : inv,
  }
}

async function appendLog(
  supabase: SupabaseClient,
  organizationId: string,
  runId: string,
  step: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from("workflow_run_logs").insert({
    organization_id: organizationId,
    workflow_run_id: runId,
    step,
    message,
    metadata: metadata ?? {},
  })
}

export async function runWorkflowAutomation(args: {
  supabase: SupabaseClient
  automation: WorkflowAutomationRow
  ctx: WorkflowEventContext
  sourceType: string
  sourceId: string | null
}): Promise<{ ok: boolean; runId: string; error?: string }> {
  const { supabase, automation, ctx, sourceType, sourceId } = args
  const organizationId = automation.organization_id
  const normCtx = normalizeContext(ctx)

  const { data: runRow, error: runErr } = await supabase
    .from("workflow_runs")
    .insert({
      organization_id: organizationId,
      automation_id: automation.id,
      status: "running",
      source_type: sourceType,
      source_id: sourceId,
    })
    .select("id")
    .single()

  if (runErr || !runRow?.id) {
    return { ok: false, runId: "", error: runErr?.message ?? "Could not create workflow run." }
  }
  const runId = runRow.id as string

  await appendLog(supabase, organizationId, runId, "start", `Automation "${automation.name}" started.`)

  const log = async (step: string, message: string, metadata?: Record<string, unknown>) => {
    await appendLog(supabase, organizationId, runId, step, message, metadata)
  }

  const exec = await executeWorkflowActions({
    supabase,
    automation,
    ctx: normCtx,
    log,
  })

  if (!exec.ok) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: exec.error ?? "Unknown error",
      })
      .eq("id", runId)
    await appendLog(supabase, organizationId, runId, "failed", exec.error ?? "failed")
    return { ok: false, runId, error: exec.error }
  }

  await supabase
    .from("workflow_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", runId)

  await appendLog(supabase, organizationId, runId, "complete", "Automation finished.")
  return { ok: true, runId }
}

export async function dispatchWorkflowTriggers(args: {
  supabase: SupabaseClient
  organizationId: string
  triggerType: WorkflowTriggerType
  ctx: WorkflowEventContext
  sourceType: string
  sourceId: string | null
}): Promise<DispatchResult> {
  const { supabase, organizationId, triggerType, sourceType, sourceId } = args
  let ctx = normalizeContext({ ...args.ctx, organization_id: organizationId, trigger_type: triggerType })
  const errors: string[] = []

  const billing = await loadOrgBillingContext(supabase, organizationId)
  const planId = billing.subscription?.plan_id ?? "solo"
  const trial = isTrialActive(billing.subscription)
  if (!canUseFeature(planId, "automation", trial)) {
    return { evaluated: 0, executed: 0, skippedPlan: true, errors }
  }

  const { data: rows, error } = await supabase
    .from("workflow_automations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .eq("trigger_type", triggerType)

  if (error) {
    errors.push(error.message)
    return { evaluated: 0, executed: 0, errors }
  }

  const automations = (rows ?? []) as WorkflowAutomationRow[]
  let executed = 0

  for (const automation of automations) {
    ctx = normalizeContext(ctx)
    const condRaw = automation.condition_config as Record<string, unknown>
    if (!evaluateConditions(condRaw, ctx)) {
      continue
    }
    const res = await runWorkflowAutomation({
      supabase,
      automation,
      ctx,
      sourceType,
      sourceId,
    })
    if (res.ok) executed += 1
    else if (res.error) errors.push(`${automation.name}: ${res.error}`)
  }

  return { evaluated: automations.length, executed, errors }
}

import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { evaluateConditions } from "@/lib/workflows/conditions"
import { ACTION_CATALOG } from "@/lib/workflows/action-catalog"
import { samplePayloadFor } from "@/lib/workflows/sample-payloads"
import type { WorkflowActionSpec, WorkflowAutomationRow, WorkflowTriggerType } from "@/lib/workflows/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Workflow Automations Phase 2 — "Run test".
 *
 * Simulator that never touches real customer-facing systems. We:
 *   1. Load the automation (RLS-scoped to the caller's org).
 *   2. Build a `WorkflowEventContext` from the matching sample payload.
 *   3. Evaluate `condition_config` using the existing engine helper —
 *      same code paths the dispatcher takes.
 *   4. Walk `action_config.actions` and append `workflow_run_logs` rows
 *      describing what *would* have happened. We deliberately do NOT
 *      call `executeWorkflowActions` because that has real side
 *      effects (email queuing, work order creation, etc.).
 *   5. Persist the run with `status = 'simulated'` so the run history
 *      drawer can surface it with a "Simulated" badge alongside live
 *      runs without affecting failure / success counts on the list.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string; automationId: string }> },
) {
  const { organizationId, automationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(automationId)) {
    return jsonError("Invalid id.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError("Unauthorized.", 401)

  // Reuse the existing manager check inline — RLS already prevents
  // unauthorized reads but we want a clear 403 if a tech somehow hits
  // this endpoint.
  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (!mem || !["owner", "admin", "manager"].includes(mem.role as string)) {
    return jsonError("Forbidden.", 403)
  }

  const { data: automation, error: aErr } = await supabase
    .from("workflow_automations")
    .select("*")
    .eq("id", automationId)
    .eq("organization_id", organizationId)
    .maybeSingle<WorkflowAutomationRow>()
  if (aErr) return jsonError(aErr.message, 500)
  if (!automation) return jsonError("Not found.", 404)

  const triggerType = automation.trigger_type as WorkflowTriggerType
  const ctx = samplePayloadFor(triggerType, organizationId)
  const conditionsPass = evaluateConditions(automation.condition_config, ctx)

  const { data: runRow, error: runErr } = await supabase
    .from("workflow_runs")
    .insert({
      organization_id: organizationId,
      automation_id: automation.id,
      status: "simulated",
      source_type: "test",
      source_id: null,
    })
    .select("id")
    .single<{ id: string }>()
  if (runErr || !runRow?.id) {
    return jsonError(runErr?.message ?? "Could not create simulated run.", 500)
  }
  const runId = runRow.id

  const logRows: Array<Record<string, unknown>> = [
    {
      organization_id: organizationId,
      workflow_run_id: runId,
      step: "simulated_start",
      message: `Simulated run for "${automation.name}" — no side effects performed.`,
      metadata: { trigger: triggerType, sample_payload: true },
    },
    {
      organization_id: organizationId,
      workflow_run_id: runId,
      step: conditionsPass ? "conditions_pass" : "conditions_skip",
      message: conditionsPass
        ? "Conditions matched the sample payload — actions would execute."
        : "Conditions did not match the sample payload — actions would not execute.",
      metadata: { conditions_pass: conditionsPass },
    },
  ]

  const actionsRaw = (automation.action_config as { actions?: WorkflowActionSpec[] }).actions
  const actions = Array.isArray(actionsRaw) ? actionsRaw : []
  if (conditionsPass) {
    actions.forEach((spec, idx) => {
      const meta = (ACTION_CATALOG as Record<string, { label: string; availability: string }>)[spec.type as string]
      const label = meta?.label ?? spec.type
      const availability = meta?.availability ?? "unknown"
      logRows.push({
        organization_id: organizationId,
        workflow_run_id: runId,
        step: `simulated_action_${idx}`,
        message: `Would ${label.toLowerCase()} (${availability}).`,
        metadata: { action_index: idx, action_type: spec.type, availability },
      })
    })
  }
  if (logRows.length > 0) {
    await supabase.from("workflow_run_logs").insert(logRows)
  }

  await supabase
    .from("workflow_runs")
    .update({
      completed_at: new Date().toISOString(),
      // simulated runs never set error_message; engine writes that for failed
    })
    .eq("id", runId)

  return NextResponse.json({
    ok: true,
    runId,
    conditions_pass: conditionsPass,
    action_count: actions.length,
    sample_trigger: triggerType,
  })
}

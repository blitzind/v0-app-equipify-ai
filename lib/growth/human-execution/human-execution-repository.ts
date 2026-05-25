import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  assertHumanExecutionApprovalTransition,
  humanExecutionApprovalNextActions,
} from "@/lib/growth/human-execution/human-execution-approval-engine"
import { mapHumanExecutionApprovalRow } from "@/lib/growth/human-execution/human-execution-mapper"
import type {
  HumanExecutionApprovalItem,
  HumanExecutionApprovalStatus,
  HumanExecutionChannel,
  HumanExecutionReadinessBand,
  HumanExecutionSequenceTemplate,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  buildHumanExecutionSequencePlan,
  DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES,
} from "@/lib/growth/human-execution/human-execution-sequence-builder"
import {
  emitHumanExecutionApprovalNeededNotification,
  emitHumanExecutionReadyNotification,
  emitHumanExecutionStalledNotification,
} from "@/lib/growth/human-execution/human-execution-notifications"

const APPROVAL_SELECT =
  "id, lead_id, plan_id, plan_step_id, channel, approval_status, readiness_score, readiness_band, title, why, suggested_channel, suggested_timing, owner_user_id, reply_routing, created_at, updated_at, leads(company_name)"

export async function listHumanExecutionApprovals(
  admin: SupabaseClient,
  input?: { status?: HumanExecutionApprovalStatus | HumanExecutionApprovalStatus[]; leadId?: string; limit?: number },
): Promise<HumanExecutionApprovalItem[]> {
  let query = admin
    .schema("growth")
    .from("human_execution_approvals")
    .select(APPROVAL_SELECT)
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50)

  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  if (input?.status) {
    const statuses = Array.isArray(input.status) ? input.status : [input.status]
    query = query.in("approval_status", statuses)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapHumanExecutionApprovalRow(row as never))
}

export async function fetchHumanExecutionApproval(
  admin: SupabaseClient,
  approvalId: string,
): Promise<HumanExecutionApprovalItem | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("human_execution_approvals")
    .select(APPROVAL_SELECT)
    .eq("id", approvalId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapHumanExecutionApprovalRow(data as never)
}

export async function createHumanExecutionApprovalDraft(
  admin: SupabaseClient,
  input: {
    leadId: string
    channel: HumanExecutionChannel
    title: string
    why: string
    readinessScore: number
    readinessBand: HumanExecutionReadinessBand
    ownerUserId?: string | null
    suggestedChannel?: HumanExecutionChannel | null
    suggestedTiming?: string | null
    replyRouting?: string | null
    createdByUserId?: string | null
  },
): Promise<HumanExecutionApprovalItem> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const { data, error } = await admin
    .schema("growth")
    .from("human_execution_approvals")
    .insert({
      organization_id: orgId,
      lead_id: input.leadId,
      channel: input.channel,
      approval_status: "draft",
      readiness_score: input.readinessScore,
      readiness_band: input.readinessBand,
      title: input.title,
      why: input.why,
      suggested_channel: input.suggestedChannel ?? input.channel,
      suggested_timing: input.suggestedTiming ?? null,
      owner_user_id: input.ownerUserId ?? null,
      reply_routing: input.replyRouting ?? null,
      metadata: { createdByUserId: input.createdByUserId ?? null },
    })
    .select(APPROVAL_SELECT)
    .single()
  if (error) throw new Error(error.message)
  const item = mapHumanExecutionApprovalRow(data as never)
  await emitHumanExecutionApprovalNeededNotification(admin, item)
  return item
}

export async function transitionHumanExecutionApproval(
  admin: SupabaseClient,
  input: {
    approvalId: string
    toStatus: HumanExecutionApprovalStatus
    actorUserId: string
  },
): Promise<HumanExecutionApprovalItem> {
  const existing = await fetchHumanExecutionApproval(admin, input.approvalId)
  if (!existing) throw new Error("not_found")
  assertHumanExecutionApprovalTransition(existing.approvalStatus, input.toStatus)

  const patch: Record<string, unknown> = {
    approval_status: input.toStatus,
    updated_at: new Date().toISOString(),
  }
  const now = new Date().toISOString()
  if (input.toStatus === "review") patch.reviewed_by_user_id = input.actorUserId
  if (input.toStatus === "review") patch.reviewed_at = now
  if (input.toStatus === "approved") {
    patch.approved_by_user_id = input.actorUserId
    patch.approved_at = now
  }
  if (input.toStatus === "executed") {
    patch.executed_by_user_id = input.actorUserId
    patch.executed_at = now
  }
  if (input.toStatus === "complete") patch.completed_at = now

  const { data, error } = await admin
    .schema("growth")
    .from("human_execution_approvals")
    .update(patch)
    .eq("id", input.approvalId)
    .select(APPROVAL_SELECT)
    .single()
  if (error) throw new Error(error.message)

  const item = mapHumanExecutionApprovalRow(data as never)
  if (input.toStatus === "approved") {
    await emitHumanExecutionReadyNotification(admin, item)
  }
  if (input.toStatus === "review" && humanExecutionApprovalNextActions("review").includes("approved")) {
    // no-op — operator must explicitly approve
  }
  if (input.toStatus === "cancelled") {
    await emitHumanExecutionStalledNotification(admin, item, "Approval cancelled by operator.")
  }
  return item
}

export async function ensureHumanExecutionPlanForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    templateKey: HumanExecutionSequenceTemplate
    readinessScore: number
    readinessBand: HumanExecutionReadinessBand
    createdByUserId?: string | null
  },
): Promise<string> {
  const orgId = await getGrowthEngineAiOrgId(admin)
  const plan = buildHumanExecutionSequencePlan(input.templateKey)

  const { data: existing } = await admin
    .schema("growth")
    .from("human_execution_plans")
    .select("id")
    .eq("lead_id", input.leadId)
    .in("status", ["draft", "active", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: planRow, error: planError } = await admin
    .schema("growth")
    .from("human_execution_plans")
    .insert({
      organization_id: orgId,
      lead_id: input.leadId,
      status: "draft",
      template_key: input.templateKey,
      readiness_score: input.readinessScore,
      readiness_band: input.readinessBand,
      rules: plan.rules,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select("id")
    .single()
  if (planError) throw new Error(planError.message)

  const planId = planRow.id as string
  const stepRows = plan.steps.map((step) => ({
    plan_id: planId,
    step_order: step.stepOrder,
    day_offset: step.dayOffset,
    channel: step.channel,
    approval_status: step.stepOrder === 0 ? "draft" : "draft",
    title: step.title,
    instructions: step.instructions,
    cooldown_hours: step.cooldownHours,
    fatigue_protected: plan.rules.fatigueProtection,
  }))

  const { error: stepsError } = await admin.schema("growth").from("human_execution_plan_steps").insert(stepRows)
  if (stepsError) throw new Error(stepsError.message)

  return planId
}

export { DEFAULT_HUMAN_EXECUTION_SEQUENCE_RULES }

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createCondition, createEdge } from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import {
  SR3_CERTIFIED_PATTERN_A_KEY,
  SR3_CERTIFIED_PATTERN_B_KEY,
  SR3_CONDITIONAL_E2E_QA_MARKER,
} from "@/lib/growth/sequences/conditions/sequence-enrollment-branch-visibility-types"

export {
  SR3_CERTIFIED_PATTERN_A_KEY,
  SR3_CERTIFIED_PATTERN_B_KEY,
  SR3_CONDITIONAL_E2E_QA_MARKER,
}

const HOURS = 60 * 60 * 1000

export type Sr3CertifiedConditionalPatternSpec = {
  key: typeof SR3_CERTIFIED_PATTERN_A_KEY | typeof SR3_CERTIFIED_PATTERN_B_KEY
  label: string
  description: string
  steps: Array<{
    stepOrder: number
    channel: "email" | "sms" | "manual_call" | "voice_drop"
    delayDaysMin: number
    delayDaysMax: number
    label: string
  }>
  branchFromStepOrder: number
  condition: {
    conditionKey: string
    spec:
      | { dslVersion: 1; source: "email"; event: "email.opened" }
      | { dslVersion: 1; source: "share_page"; event: "share_page.cta_clicked" }
    label: string
  }
  timeoutHours: number
  trueTargetStepOrder: number
  timeoutTargetStepOrder: number
}

export const SR3_CERTIFIED_CONDITIONAL_PATTERN_A: Sr3CertifiedConditionalPatternSpec = {
  key: SR3_CERTIFIED_PATTERN_A_KEY,
  label: "SR-3 Certified · Email Open Branch",
  description:
    "Email sent → wait 72h for email.opened → if no open: SMS step · if opened: Share Page follow-up email.",
  steps: [
    { stepOrder: 1, channel: "email", delayDaysMin: 0, delayDaysMax: 0, label: "Initial email" },
    { stepOrder: 2, channel: "sms", delayDaysMin: 1, delayDaysMax: 1, label: "SMS (no open timeout)" },
    { stepOrder: 3, channel: "email", delayDaysMin: 2, delayDaysMax: 2, label: "Share page follow-up email" },
  ],
  branchFromStepOrder: 1,
  condition: {
    conditionKey: "email-opened-wait",
    spec: { dslVersion: 1, source: "email", event: "email.opened" },
    label: "Wait for email open",
  },
  timeoutHours: 72,
  trueTargetStepOrder: 3,
  timeoutTargetStepOrder: 2,
}

export const SR3_CERTIFIED_CONDITIONAL_PATTERN_B: Sr3CertifiedConditionalPatternSpec = {
  key: SR3_CERTIFIED_PATTERN_B_KEY,
  label: "SR-3 Certified · Share CTA Branch",
  description:
    "Share page viewed → wait 48h for CTA click → if clicked: manual call task · if no click: voice drop (pending approval).",
  steps: [
    { stepOrder: 1, channel: "email", delayDaysMin: 0, delayDaysMax: 0, label: "Share page email" },
    { stepOrder: 2, channel: "manual_call", delayDaysMin: 1, delayDaysMax: 1, label: "Manual call (CTA clicked)" },
    { stepOrder: 3, channel: "voice_drop", delayDaysMin: 2, delayDaysMax: 2, label: "Voice drop (no click timeout)" },
  ],
  branchFromStepOrder: 1,
  condition: {
    conditionKey: "share-cta-clicked-wait",
    spec: { dslVersion: 1, source: "share_page", event: "share_page.cta_clicked" },
    label: "Wait for share page CTA click",
  },
  timeoutHours: 48,
  trueTargetStepOrder: 2,
  timeoutTargetStepOrder: 3,
}

export const SR3_CERTIFIED_CONDITIONAL_PATTERNS = [
  SR3_CERTIFIED_CONDITIONAL_PATTERN_A,
  SR3_CERTIFIED_CONDITIONAL_PATTERN_B,
] as const

export type Sr3CertifiedConditionalPatternRecord = {
  patternId: string
  patternKey: string
  stepIdsByOrder: Record<number, string>
  conditionId: string
  trueEdgeId: string
  timeoutEdgeId: string
  created: boolean
}

async function upsertPatternRow(
  admin: SupabaseClient,
  spec: Sr3CertifiedConditionalPatternSpec,
): Promise<string | null> {
  const existing = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("id")
    .eq("key", spec.key)
    .maybeSingle()

  if (existing.data?.id) return String(existing.data.id)

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .insert({
      key: spec.key,
      label: spec.label,
      description: spec.description,
      pattern_kind: "catalog",
      is_active: true,
      metadata: { cert_marker: SR3_CONDITIONAL_E2E_QA_MARKER },
    })
    .select("id")
    .single()

  if (error) return null
  return String(data.id)
}

async function ensurePatternSteps(
  admin: SupabaseClient,
  patternId: string,
  spec: Sr3CertifiedConditionalPatternSpec,
): Promise<Record<number, string>> {
  const stepIdsByOrder: Record<number, string> = {}

  for (const step of spec.steps) {
    const existing = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .select("id")
      .eq("pattern_id", patternId)
      .eq("step_order", step.stepOrder)
      .maybeSingle()

    if (existing.data?.id) {
      stepIdsByOrder[step.stepOrder] = String(existing.data.id)
      await admin
        .schema("growth")
        .from("sequence_pattern_steps")
        .update({
          channel: step.channel,
          delay_days_min: step.delayDaysMin,
          delay_days_max: step.delayDaysMax,
          required_human_approval: true,
        })
        .eq("id", existing.data.id)
      continue
    }

    const { data, error } = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .insert({
        pattern_id: patternId,
        step_order: step.stepOrder,
        channel: step.channel,
        delay_days_min: step.delayDaysMin,
        delay_days_max: step.delayDaysMax,
        required_human_approval: true,
      })
      .select("id")
      .single()

    if (error) throw new Error(error.message)
    stepIdsByOrder[step.stepOrder] = String(data.id)
  }

  return stepIdsByOrder
}

async function ensureBranchGraph(
  admin: SupabaseClient,
  input: {
    patternId: string
    spec: Sr3CertifiedConditionalPatternSpec
    stepIdsByOrder: Record<number, string>
  },
): Promise<{ conditionId: string; trueEdgeId: string; timeoutEdgeId: string }> {
  const fromStepId = input.stepIdsByOrder[input.spec.branchFromStepOrder]
  const trueTargetId = input.stepIdsByOrder[input.spec.trueTargetStepOrder]
  const timeoutTargetId = input.stepIdsByOrder[input.spec.timeoutTargetStepOrder]

  if (!fromStepId || !trueTargetId || !timeoutTargetId) {
    throw new Error("certified_pattern_steps_incomplete")
  }

  const existingCondition = await admin
    .schema("growth")
    .from("sequence_pattern_step_conditions")
    .select("id")
    .eq("pattern_step_id", fromStepId)
    .eq("condition_key", input.spec.condition.conditionKey)
    .maybeSingle()

  let conditionId = existingCondition.data?.id ? String(existingCondition.data.id) : null
  if (!conditionId) {
    const condition = await createCondition(admin, {
      patternStepId: fromStepId,
      conditionKey: input.spec.condition.conditionKey,
      spec: input.spec.condition.spec,
      label: input.spec.condition.label,
      durationSeconds: input.spec.timeoutHours * 3600,
    })
    conditionId = condition.id
  }

  const existingEdges = await admin
    .schema("growth")
    .from("sequence_pattern_step_edges")
    .select("id, edge_type")
    .eq("pattern_id", input.patternId)
    .eq("from_pattern_step_id", fromStepId)

  let trueEdgeId =
    existingEdges.data?.find((row) => row.edge_type === "conditional_true")?.id?.toString() ?? null
  let timeoutEdgeId =
    existingEdges.data?.find((row) => row.edge_type === "timeout")?.id?.toString() ?? null

  if (!trueEdgeId) {
    const edge = await createEdge(admin, {
      patternId: input.patternId,
      fromPatternStepId: fromStepId,
      toPatternStepId: trueTargetId,
      edgeType: "conditional_true",
      conditionId,
      label: `${input.spec.key} true branch`,
    })
    trueEdgeId = edge.id
  }

  if (!timeoutEdgeId) {
    const edge = await createEdge(admin, {
      patternId: input.patternId,
      fromPatternStepId: fromStepId,
      toPatternStepId: timeoutTargetId,
      edgeType: "timeout",
      label: `${input.spec.key} timeout branch`,
    })
    timeoutEdgeId = edge.id
  }

  return { conditionId, trueEdgeId, timeoutEdgeId }
}

export async function ensureSr3CertifiedConditionalPattern(
  admin: SupabaseClient,
  spec: Sr3CertifiedConditionalPatternSpec,
): Promise<Sr3CertifiedConditionalPatternRecord | null> {
  const patternId = await upsertPatternRow(admin, spec)
  if (!patternId) return null

  const existingBefore = await admin
    .schema("growth")
    .from("sequence_pattern_step_edges")
    .select("id", { count: "exact", head: true })
    .eq("pattern_id", patternId)

  const stepIdsByOrder = await ensurePatternSteps(admin, patternId, spec)
  const graph = await ensureBranchGraph(admin, { patternId, spec, stepIdsByOrder })

  return {
    patternId,
    patternKey: spec.key,
    stepIdsByOrder,
    conditionId: graph.conditionId,
    trueEdgeId: graph.trueEdgeId,
    timeoutEdgeId: graph.timeoutEdgeId,
    created: (existingBefore.count ?? 0) === 0,
  }
}

export async function ensureAllSr3CertifiedConditionalPatterns(
  admin: SupabaseClient,
): Promise<Sr3CertifiedConditionalPatternRecord[]> {
  const records: Sr3CertifiedConditionalPatternRecord[] = []
  for (const spec of SR3_CERTIFIED_CONDITIONAL_PATTERNS) {
    const record = await ensureSr3CertifiedConditionalPattern(admin, spec)
    if (record) records.push(record)
  }
  return records
}

export function certifiedPatternTimeoutIso(fromIso: string, timeoutHours: number): string {
  return new Date(Date.parse(fromIso) + timeoutHours * HOURS).toISOString()
}

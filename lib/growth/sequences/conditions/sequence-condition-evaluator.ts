import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthSequenceEnrollmentById, fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type { SequenceConditionSpec } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import { parseSequenceConditionSpec } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  queryLeadFieldEvidence,
  querySequenceConditionEventEvidence,
} from "@/lib/growth/sequences/conditions/sequence-condition-event-query"
import {
  compareSequenceConditionNumeric,
  compareSequenceConditionString,
  maskSequenceConditionEvidenceRef,
  normalizeSequenceConditionTier,
  sanitizeSequenceConditionDetail,
  type SequenceConditionEvaluationInput,
  type SequenceConditionEvaluationResult,
  type SequenceConditionMaskedEvidence,
} from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"

export type EvaluateSequenceConditionReadOnlyInput = {
  enrollmentId: string
  enrollmentStepId: string
  conditionSpec: unknown
  now?: string
}

export async function evaluateSequenceConditionReadOnly(
  admin: SupabaseClient,
  input: EvaluateSequenceConditionReadOnlyInput,
): Promise<SequenceConditionEvaluationResult> {
  const validated = parseSequenceConditionSpec(input.conditionSpec)
  if (!validated.ok) {
    throw new Error(validated.message)
  }

  const now = input.now ?? new Date().toISOString()
  return evaluateSequenceConditionSpecReadOnly(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    conditionSpec: validated.spec,
    now,
  })
}

export async function evaluateSequenceConditionSpecReadOnly(
  admin: SupabaseClient,
  input: SequenceConditionEvaluationInput,
): Promise<SequenceConditionEvaluationResult> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("Enrollment not found.")

  const step = await fetchGrowthSequenceEnrollmentStepById(admin, input.enrollmentStepId)
  if (!step || step.enrollmentId !== enrollment.id) {
    throw new Error("Enrollment step not found for enrollment.")
  }

  const scope = {
    enrollmentId: enrollment.id,
    enrollmentStepId: step.id,
    leadId: enrollment.leadId,
  }

  const spec = input.conditionSpec
  const evaluatedAt = input.now

  if (spec.event === "lead.status") {
    const fields = await queryLeadFieldEvidence(admin, scope.leadId)
    return evaluateLeadFieldMatch(
      spec,
      evaluatedAt,
      scope.leadId,
      fields,
      spec.statusValue,
      (value) => value.status,
      "Lead status",
    )
  }

  if (spec.event === "lead.hot_tier") {
    const fields = await queryLeadFieldEvidence(admin, scope.leadId)
    return evaluateLeadFieldMatch(
      spec,
      evaluatedAt,
      scope.leadId,
      fields,
      spec.tierValue,
      (value) => value.engagementTier,
      "Lead engagement tier",
      true,
    )
  }

  if (spec.event === "lead.next_best_action") {
    const fields = await queryLeadFieldEvidence(admin, scope.leadId)
    return evaluateLeadFieldMatch(
      spec,
      evaluatedAt,
      scope.leadId,
      fields,
      spec.actionValue,
      (value) => value.nextBestAction,
      "Lead next best action",
    )
  }

  if (spec.event === "engagement.score_threshold") {
    const fields = await queryLeadFieldEvidence(admin, scope.leadId)
    const actual = fields.engagementScore ?? 0
    const matched = compareSequenceConditionNumeric(spec.operator, actual, spec.threshold)
    const evidence: SequenceConditionMaskedEvidence[] = [
      {
        ref: maskSequenceConditionEvidenceRef("engagement_scores", scope.leadId),
        occurredAt: evaluatedAt,
        detail: sanitizeSequenceConditionDetail(
          `Engagement score ${actual} ${spec.operator} ${spec.threshold}.`,
        ),
      },
    ]
    return buildResult(spec, evaluatedAt, matched, evidence, matched
      ? `Engagement score threshold satisfied (${actual} ${spec.operator} ${spec.threshold}).`
      : `Engagement score threshold not met (${actual} ${spec.operator} ${spec.threshold}).`)
  }

  if (spec.event === "engagement.tier") {
    const fields = await queryLeadFieldEvidence(admin, scope.leadId)
    const actual = fields.engagementScoreTier ?? fields.engagementTier ?? ""
    const matched = compareSequenceConditionString(
      null,
      normalizeSequenceConditionTier(actual),
      normalizeSequenceConditionTier(spec.tierValue),
    )
    const evidence: SequenceConditionMaskedEvidence[] = [
      {
        ref: maskSequenceConditionEvidenceRef("engagement_scores", scope.leadId),
        occurredAt: evaluatedAt,
        detail: sanitizeSequenceConditionDetail(`Engagement tier is ${actual || "unknown"}.`),
      },
    ]
    return buildResult(spec, evaluatedAt, matched, evidence, matched
      ? `Engagement tier matches ${spec.tierValue}.`
      : `Engagement tier does not match ${spec.tierValue}.`)
  }

  const query = await querySequenceConditionEventEvidence(admin, scope, spec.event, evaluatedAt)
  const matched = query.found
  const reason = matched
    ? `${spec.event} evidence found (${query.evidence.length} record(s), attribution_scoped=${query.attributionScoped}).`
    : `${spec.event} evidence not found for enrollment step.`

  return buildResult(spec, evaluatedAt, matched, query.evidence, reason)
}

function evaluateLeadFieldMatch(
  spec: SequenceConditionSpec,
  evaluatedAt: string,
  leadId: string,
  fields: Awaited<ReturnType<typeof queryLeadFieldEvidence>>,
  expected: string,
  readActual: (fields: Awaited<ReturnType<typeof queryLeadFieldEvidence>>) => string | null,
  label: string,
  normalizeTier = false,
): SequenceConditionEvaluationResult {
  const rawActual = readActual(fields)
  const actual = rawActual ?? ""
  const left = normalizeTier ? normalizeSequenceConditionTier(actual) : actual.trim().toLowerCase()
  const right = normalizeTier ? normalizeSequenceConditionTier(expected) : expected.trim().toLowerCase()
  const matched = left === right
  const evidence: SequenceConditionMaskedEvidence[] = [
    {
      ref: maskSequenceConditionEvidenceRef("leads", leadId),
      occurredAt: evaluatedAt,
      detail: sanitizeSequenceConditionDetail(`${label} is ${actual || "unset"}.`),
    },
  ]
  return buildResult(
    spec,
    evaluatedAt,
    matched,
    evidence,
    matched ? `${label} matches ${expected}.` : `${label} does not match ${expected}.`,
  )
}

function buildResult(
  spec: SequenceConditionSpec,
  evaluatedAt: string,
  matched: boolean,
  evidence: SequenceConditionMaskedEvidence[],
  reason: string,
): SequenceConditionEvaluationResult {
  return {
    matched,
    reason,
    evidence,
    evaluatedAt,
    readOnly: true,
    event: spec.event,
    source: spec.source,
  }
}

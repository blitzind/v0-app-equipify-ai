/** SR-3 Phase 2 — read-only condition evaluator types (client-safe). */

import type { SequenceConditionCompareOperator } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import type { SequenceConditionSpec } from "@/lib/growth/sequences/conditions/sequence-condition-types"

export const GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER =
  "growth-sequence-condition-evaluator-sr3-phase2-v1" as const

export const GROWTH_SEQUENCE_CONDITION_EVALUATOR_CONFIRM =
  "RUN_GROWTH_SEQUENCE_CONDITION_EVALUATOR_CERTIFICATION" as const

export type SequenceConditionEvaluationInput = {
  enrollmentId: string
  enrollmentStepId: string
  conditionSpec: SequenceConditionSpec
  now: string
}

export type SequenceConditionMaskedEvidence = {
  ref: string
  occurredAt: string | null
  detail: string
}

export type SequenceConditionEvaluationResult = {
  matched: boolean
  reason: string
  evidence: SequenceConditionMaskedEvidence[]
  evaluatedAt: string
  readOnly: true
  event: SequenceConditionSpec["event"]
  source: SequenceConditionSpec["source"]
}

export function maskSequenceConditionEvidenceRef(table: string, id: string): string {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "_").slice(0, 40)
  const prefix = id.slice(0, 8)
  return `${safeTable}:${prefix}…`
}

export function sanitizeSequenceConditionDetail(text: string, maxLength = 200): string {
  const cleaned = text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return "Evidence recorded."
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned
}

export function normalizeSequenceConditionTier(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === "warming") return "warm"
  return normalized
}

export function compareSequenceConditionNumeric(
  operator: SequenceConditionCompareOperator,
  actual: number,
  expected: number,
): boolean {
  switch (operator) {
    case "eq":
      return actual === expected
    case "neq":
      return actual !== expected
    case "gte":
      return actual >= expected
    case "lte":
      return actual <= expected
    case "gt":
      return actual > expected
    case "lt":
      return actual < expected
    default:
      return false
  }
}

export function compareSequenceConditionString(
  operator: SequenceConditionCompareOperator | null,
  actual: string,
  expected: string,
): boolean {
  const op = operator ?? "eq"
  const left = actual.trim().toLowerCase()
  const right = expected.trim().toLowerCase()
  switch (op) {
    case "eq":
      return left === right
    case "neq":
      return left !== right
    default:
      return left === right
  }
}

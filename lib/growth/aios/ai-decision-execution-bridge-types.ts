/** GE-AIOS-2I — Decision Engine execution bridge types (client-safe). */

import type { AiDecisionRecord } from "@/lib/growth/aios/ai-decision-record-types"
import type { AiDecisionGateValidationResult } from "@/lib/growth/aios/ai-decision-gate-types"
import { AI_DECISION_CONFIDENCE_BANDS } from "@/lib/growth/aios/ai-decision-engine-types"

export const GROWTH_AIOS_2I_PHASE = "GE-AIOS-2I" as const

export const GROWTH_AI_DECISION_EXECUTION_BRIDGE_QA_MARKER =
  "growth-aios-2i-decision-execution-bridge-v1" as const

export const AI_DECISION_EXECUTION_BRIDGE_BLOCK_REASONS = [
  "decision_engine_degraded",
  "insufficient_evidence",
  "gate_validation_failed",
] as const

export type AiDecisionExecutionBridgeBlockReason =
  (typeof AI_DECISION_EXECUTION_BRIDGE_BLOCK_REASONS)[number]

export type AiDecisionExecutionBridgeInput = {
  organizationId: string
  workOrderId: string
  actingAgent?: string | null
  source?: string
}

export type AiDecisionExecutionBridgeResult = {
  workOrderId: string
  decisionRecordIds: string[]
  engineInvoked: boolean
  skippedExistingRecord: boolean
}

/** Minimum confidence to treat a Decision Record as executable (§13.2). */
export const AI_DECISION_EXECUTION_MIN_CONFIDENCE =
  AI_DECISION_CONFIDENCE_BANDS.low.min

export function isExecutableDecisionRecord(record: AiDecisionRecord): boolean {
  if (record.decisionKey === "insufficient_evidence") return false
  return record.confidence >= AI_DECISION_EXECUTION_MIN_CONFIDENCE
}

export function hasExecutableDecisionRecords(records: AiDecisionRecord[]): boolean {
  return records.some(isExecutableDecisionRecord)
}

export function shouldInvokeDecisionEngineForGateResult(
  gateResult: AiDecisionGateValidationResult,
): boolean {
  if (gateResult.passed) return false
  return gateResult.blockReason === "missing_decision_records"
}

export function shouldBlockForInsufficientExistingRecords(
  gateResult: Extract<AiDecisionGateValidationResult, { passed: true }>,
): boolean {
  return !hasExecutableDecisionRecords(gateResult.decisionRecords)
}

/** Bridge wires Decision Engine → Decision Record → Decision Gate before execute. */
export const AI_DECISION_EXECUTION_BRIDGE_RUNTIME_RULE =
  "Decision Engine execution bridge invokes the Decision Engine when records are missing, then enforces the Decision Gate — it does not execute Work Orders or call providers." as const

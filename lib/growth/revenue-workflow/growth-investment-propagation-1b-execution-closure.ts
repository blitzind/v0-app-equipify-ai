/**
 * GE-AIOS-INVESTMENT-PROPAGATION-1B-EXECUTION-CLOSURE — Bounded action execution identity + selection.
 * Client-safe adapter consumed by research readiness, execution, and reconciliation paths.
 */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchNextBestAction } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import {
  GROWTH_INVESTMENT_PROPAGATION_1B_QA_MARKER,
  isGenericResearchAction,
  resolveBoundedResearchAuthorizationFromMetadata,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b"
import { resolveLegacyAdmissionPolicyRead } from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import {
  GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS,
  GROWTH_BOUNDED_RESEARCH_ACTION_ORDER,
  readBoundedResearchActionInProgress,
  readCompletedBoundedResearchActionKeys,
  readConsumedBoundedResearchRunIds,
  resolveBoundedResearchActionKeyFromEvidence,
  resolveBoundedResearchActionKeyFromLabel,
  resolveBoundedResearchActionKeyFromRun,
  type GrowthBoundedResearchActionDefinition,
  type GrowthBoundedResearchActionKey,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b-action-identity"

export const GROWTH_INVESTMENT_PROPAGATION_1B_EXECUTION_CLOSURE_QA_MARKER =
  "ge-aios-investment-propagation-1b-execution-closure-v1" as const

export {
  GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS,
  GROWTH_BOUNDED_RESEARCH_ACTION_KEYS,
  GROWTH_BOUNDED_RESEARCH_ACTION_ORDER,
  isGrowthBoundedResearchActionKey,
  readBoundedResearchActionInProgress,
  readCompletedBoundedResearchActionKeys,
  readConsumedBoundedResearchRunIds,
  resolveBoundedResearchActionKeyFromEvidence,
  resolveBoundedResearchActionKeyFromLabel,
  resolveBoundedResearchActionKeyFromRun,
  type GrowthBoundedResearchActionDefinition,
  type GrowthBoundedResearchActionKey,
} from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b-action-identity"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

export type GrowthBoundedResearchExecutionSelection = {
  actionKey: GrowthBoundedResearchActionKey
  displayLabel: string
  missingEvidenceTarget: string
  workflowType: "research_company"
  sourceAuthority: typeof GROWTH_INVESTMENT_PROPAGATION_1B_QA_MARKER
}

export type GrowthBoundedResearchExecutionGateResult =
  | {
      mode: "legacy"
      authorized: true
      selection: null
    }
  | {
      mode: "bounded"
      authorized: true
      selection: GrowthBoundedResearchExecutionSelection
    }
  | {
      mode: "bounded" | "legacy"
      authorized: false
      selection: null
      reason: string
    }

function resolveAuthorizedActionKeys(metadata: Record<string, unknown>): GrowthBoundedResearchActionKey[] {
  const auth = resolveBoundedResearchAuthorizationFromMetadata(metadata)
  const missingTargets = auth.missingRequiredEvidence
  const fromMissing = missingTargets
    .map((gap) => resolveBoundedResearchActionKeyFromEvidence(gap))
    .filter((value): value is GrowthBoundedResearchActionKey => value != null)
  const fromLabels = auth.authorizedActions
    .map((label) => resolveBoundedResearchActionKeyFromLabel(label))
    .filter((value): value is GrowthBoundedResearchActionKey => value != null)
  const completed = new Set(readCompletedBoundedResearchActionKeys(metadata))
  return [...new Set([...fromMissing, ...fromLabels])].filter((key) => !completed.has(key))
}

export function selectNextBoundedResearchAction(
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchExecutionSelection | null {
  const raw = asRecord(metadata) ?? {}
  const auth = resolveBoundedResearchAuthorizationFromMetadata(raw)
  if (!auth.authorized) return null

  const authorizedKeys = resolveAuthorizedActionKeys(raw)
  if (authorizedKeys.length === 0) return null

  const ordered = GROWTH_BOUNDED_RESEARCH_ACTION_ORDER.filter((key) => authorizedKeys.includes(key))
  const actionKey = ordered[0]
  if (!actionKey) return null

  const definition = GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS[actionKey]
  return {
    actionKey: definition.actionKey,
    displayLabel: definition.displayLabel,
    missingEvidenceTarget: definition.missingEvidenceTarget,
    workflowType: definition.workflowType,
    sourceAuthority: GROWTH_INVESTMENT_PROPAGATION_1B_QA_MARKER,
  }
}

export function evaluateBoundedResearchExecutionGate(
  metadata: Record<string, unknown> | null | undefined,
): GrowthBoundedResearchExecutionGateResult {
  const raw = asRecord(metadata) ?? {}
  const policyRead = resolveLegacyAdmissionPolicyRead({ admissionState: null, metadata: raw })
  if (!policyRead.hasPolicyMetadata) {
    return { mode: "legacy", authorized: true, selection: null }
  }

  if (policyRead.sufficiencyDecision === "terminal_reject") {
    return { mode: "bounded", authorized: false, selection: null, reason: "terminal_reject" }
  }
  if (policyRead.sufficiencyDecision === "operator_review_required") {
    return { mode: "bounded", authorized: false, selection: null, reason: "operator_review_required" }
  }
  if (policyRead.sufficiencyDecision !== "targeted_research_required") {
    return { mode: "bounded", authorized: false, selection: null, reason: "not_targeted_research" }
  }

  const selection = selectNextBoundedResearchAction(raw)
  if (!selection) {
    return { mode: "bounded", authorized: false, selection: null, reason: "bounded_authorization_exhausted" }
  }

  const inProgress = readBoundedResearchActionInProgress(raw)
  if (inProgress && inProgress !== selection.actionKey) {
    return { mode: "bounded", authorized: false, selection: null, reason: "different_bounded_action_in_progress" }
  }

  return { mode: "bounded", authorized: true, selection }
}

export function shouldQueueSpecificBoundedResearchActionByKey(
  metadata: Record<string, unknown> | null | undefined,
  actionKey: string,
): boolean {
  const gate = evaluateBoundedResearchExecutionGate(metadata)
  if (!gate.authorized || !gate.selection) return false
  return gate.selection.actionKey === actionKey
}

export function rejectGenericBoundedResearchAction(action: string): boolean {
  return isGenericResearchAction(action)
}

export function buildBoundedResearchNextBestAction(
  selection: GrowthBoundedResearchExecutionSelection,
): GrowthLeadResearchNextBestAction {
  return {
    label: selection.displayLabel,
    kind: "continue_research",
    reason: `Bounded research authorized to resolve ${selection.missingEvidenceTarget.replaceAll("_", " ")}.`,
    priority: "high",
    urgency: "medium",
  }
}

export function applyBoundedResearchExecutionPlan(input: {
  metadata: Record<string, unknown> | null | undefined
  executionPlan: GrowthLeadResearchExecutionPlan
}): GrowthLeadResearchExecutionPlan {
  const gate = evaluateBoundedResearchExecutionGate(input.metadata)
  if (gate.mode !== "bounded" || !gate.selection) return input.executionPlan

  const selection = gate.selection
  return {
    ...input.executionPlan,
    nextBestAction: selection.displayLabel,
    nextBestActionKind: "continue_research",
    workflowType: "research_company",
    requiredEvidence: [
      selection.missingEvidenceTarget,
      `bounded_action:${selection.actionKey}`,
    ],
    expectedOutcome: `Resolve missing evidence (${selection.missingEvidenceTarget}) via bounded action ${selection.actionKey}.`,
    executionReadiness:
      gate.authorized && shouldQueueSpecificBoundedResearchActionByKey(input.metadata, selection.actionKey)
        ? "ready"
        : "blocked",
    missingPrerequisites: gate.authorized ? [] : ["Bounded research authorization unavailable"],
  }
}

export type GrowthBoundedResearchCompletionRecord = {
  actionKey: GrowthBoundedResearchActionKey
  runId: string
  missingEvidenceTarget: string
  completedAt: string
  outcome: "semantic_success" | "semantic_failure"
}

export function buildBoundedResearchCompletionMetadataPatch(input: {
  existingMetadata: Record<string, unknown>
  completion: GrowthBoundedResearchCompletionRecord
}): Record<string, unknown> {
  const completed = readCompletedBoundedResearchActionKeys(input.existingMetadata)
  const consumedRuns = readConsumedBoundedResearchRunIds(input.existingMetadata)
  const nextCompleted = completed.includes(input.completion.actionKey)
    ? completed
    : [...completed, input.completion.actionKey]
  const nextConsumedRuns = consumedRuns.includes(input.completion.runId)
    ? consumedRuns
    : [...consumedRuns, input.completion.runId]

  const priorPassesUsed =
    typeof input.existingMetadata.admission_targeted_research_passes_used === "number" &&
    Number.isFinite(input.existingMetadata.admission_targeted_research_passes_used)
      ? Math.max(0, input.existingMetadata.admission_targeted_research_passes_used)
      : 0

  const shouldConsumePass =
    input.completion.outcome === "semantic_success" &&
    !consumedRuns.includes(input.completion.runId) &&
    !completed.includes(input.completion.actionKey)

  const completionLog = readStringArray(input.existingMetadata.admission_bounded_action_completion_log)
  const nextCompletionLog = [
    ...completionLog,
    JSON.stringify({
      actionKey: input.completion.actionKey,
      runId: input.completion.runId,
      missingEvidenceTarget: input.completion.missingEvidenceTarget,
      completedAt: input.completion.completedAt,
      outcome: input.completion.outcome,
    }),
  ]

  return {
    admission_bounded_actions_completed: nextCompleted,
    admission_bounded_research_runs_consumed: nextConsumedRuns,
    admission_targeted_research_passes_used: shouldConsumePass
      ? priorPassesUsed + 1
      : priorPassesUsed,
    admission_bounded_action_in_progress: null,
    admission_bounded_action_completion_log: nextCompletionLog.slice(-20),
    investment_propagation_1b_execution_closure_qa_marker:
      GROWTH_INVESTMENT_PROPAGATION_1B_EXECUTION_CLOSURE_QA_MARKER,
  }
}

export function buildBoundedResearchInProgressMetadataPatch(
  selection: GrowthBoundedResearchExecutionSelection,
  runId?: string | null,
): Record<string, unknown> {
  return {
    admission_bounded_action_in_progress: {
      actionKey: selection.actionKey,
      missingEvidenceTarget: selection.missingEvidenceTarget,
      displayLabel: selection.displayLabel,
      runId: runId ?? null,
      queuedAt: new Date().toISOString(),
    },
  }
}

export function buildBoundedResearchFailureMetadataPatch(): Record<string, unknown> {
  return {
    admission_bounded_action_in_progress: null,
  }
}

export function buildBoundedResearchCompletionMetadataPatchForRun(input: {
  existingMetadata: Record<string, unknown>
  run: {
    id: string
    status: string
    signals?: Record<string, unknown> | null
  }
  outcome?: "semantic_success" | "semantic_failure"
}): Record<string, unknown> | null {
  const policyRead = resolveLegacyAdmissionPolicyRead({
    admissionState: null,
    metadata: input.existingMetadata,
  })
  if (!policyRead.hasPolicyMetadata) return null

  if (input.run.status === "failed") {
    return buildBoundedResearchFailureMetadataPatch()
  }
  if (input.run.status !== "completed") return null

  const actionKey = resolveBoundedResearchActionKeyFromRun(input.run, input.existingMetadata)
  if (!actionKey) return null

  const consumedRuns = readConsumedBoundedResearchRunIds(input.existingMetadata)
  if (consumedRuns.includes(input.run.id)) return null

  const definition = GROWTH_BOUNDED_RESEARCH_ACTION_DEFINITIONS[actionKey]
  return buildBoundedResearchCompletionMetadataPatch({
    existingMetadata: input.existingMetadata,
    completion: {
      actionKey,
      runId: input.run.id,
      missingEvidenceTarget: definition.missingEvidenceTarget,
      completedAt: new Date().toISOString(),
      outcome: input.outcome ?? "semantic_success",
    },
  })
}

export function resolveTargetedResearchPassesUsedForReconcile(input: {
  existingMetadata: Record<string, unknown>
  researchRun?: {
    id?: string | null
    status?: string | null
    signals?: Record<string, unknown> | null
  } | null
}): number {
  const priorPassesUsed =
    typeof input.existingMetadata.admission_targeted_research_passes_used === "number" &&
    Number.isFinite(input.existingMetadata.admission_targeted_research_passes_used)
      ? Math.max(0, input.existingMetadata.admission_targeted_research_passes_used)
      : 0

  const policyRead = resolveLegacyAdmissionPolicyRead({
    admissionState: null,
    metadata: input.existingMetadata,
  })

  if (
    policyRead.hasPolicyMetadata &&
    input.researchRun?.id &&
    (input.researchRun.status === "completed" || input.researchRun.status === "failed")
  ) {
    const completionPatch = buildBoundedResearchCompletionMetadataPatchForRun({
      existingMetadata: input.existingMetadata,
      run: {
        id: input.researchRun.id,
        status: input.researchRun.status,
        signals: input.researchRun.signals ?? null,
      },
    })
    if (completionPatch && typeof completionPatch.admission_targeted_research_passes_used === "number") {
      return completionPatch.admission_targeted_research_passes_used
    }
    if (policyRead.sufficiencyDecision === "targeted_research_required") {
      return priorPassesUsed
    }
  }

  if (policyRead.hasPolicyMetadata) {
    return priorPassesUsed
  }

  return priorPassesUsed + 1
}

export function buildBoundedResearchOperatorProjection(
  metadata: Record<string, unknown> | null | undefined,
): {
  authorized: boolean
  currentActionKey: GrowthBoundedResearchActionKey | null
  currentActionLabel: string | null
  missingEvidenceTarget: string | null
  passesRemaining: number
  passesUsed: number
  exhausted: boolean
} {
  const raw = asRecord(metadata) ?? {}
  const auth = resolveBoundedResearchAuthorizationFromMetadata(raw)
  const selection = selectNextBoundedResearchAction(raw)
  return {
    authorized: auth.authorized,
    currentActionKey: selection?.actionKey ?? null,
    currentActionLabel: selection?.displayLabel ?? null,
    missingEvidenceTarget: selection?.missingEvidenceTarget ?? null,
    passesRemaining: auth.investmentRemaining,
    passesUsed: auth.investmentConsumed,
    exhausted: auth.investmentRemaining <= 0 || auth.authorizedActions.length === 0,
  }
}

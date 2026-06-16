/** Growth Engine S5-G — runtime reconciliation preview types (client-safe). */

import type { GrowthAutomationRuntimeArtifactPreview } from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER =
  "growth-automation-runtime-reconciliation-s5g-v1" as const

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_STATUSES = [
  "draft",
  "previewed",
  "blocked",
  "failed",
] as const
export type GrowthAutomationRuntimeReconciliationStatus =
  (typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_STATUSES)[number]

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "blocked",
] as const
export type GrowthAutomationRuntimeReconciliationRiskLevel =
  (typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_RISK_LEVELS)[number]

export type GrowthAutomationRuntimeReconciliationDiff = {
  nodesAdded: string[]
  nodesRemoved: string[]
  nodesChanged: string[]
  edgesAdded: string[]
  edgesRemoved: string[]
  edgesChanged: string[]
  triggersChanged: string[]
  actionsChanged: string[]
  conditionsChanged: string[]
  waitsChanged: string[]
  approvalGatesChanged: string[]
  riskLevel: GrowthAutomationRuntimeReconciliationRiskLevel
  requiresHumanReview: boolean
}

export type GrowthAutomationRuntimeReconciliationPlanItem = {
  artifactKind: string
  previewId: string
  semanticKey: string
  summary: string
  writeEnabled: false
}

export type GrowthAutomationRuntimeReconciliationCleanupPlanItem = {
  artifactKind: string
  previewId: string
  semanticKey: string
  reason: string
  action: "archive_preview" | "detach_preview"
}

export type GrowthAutomationRuntimeReconciliationRollbackPlanItem = {
  step: number
  action: string
  targetVersionId: string | null
  detail: string
}

export type GrowthAutomationRuntimeReconciliationResult = {
  reconciliationId: string
  flowId: string
  versionId: string
  previousPublishedVersionId: string | null
  candidateVersionId: string
  status: GrowthAutomationRuntimeReconciliationStatus
  diff: GrowthAutomationRuntimeReconciliationDiff
  createPlan: GrowthAutomationRuntimeReconciliationPlanItem[]
  updatePlan: GrowthAutomationRuntimeReconciliationPlanItem[]
  archivePlan: GrowthAutomationRuntimeReconciliationPlanItem[]
  cleanupPlan: GrowthAutomationRuntimeReconciliationCleanupPlanItem[]
  rollbackPlan: GrowthAutomationRuntimeReconciliationRollbackPlanItem[]
  warnings: GrowthAutomationValidationIssue[]
  errors: GrowthAutomationValidationIssue[]
  artifactPreview: GrowthAutomationRuntimeArtifactPreview | null
  safety: typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS
  createdAt: string
}

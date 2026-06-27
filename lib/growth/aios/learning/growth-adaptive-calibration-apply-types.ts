/** GE-AI-3D-PROD-3 — Controlled calibration apply types (client-safe). */

import type { GrowthAdaptiveCalibrationTargetSystem } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"

export const GROWTH_AIOS_GE_AI_3D_PROD_3_PHASE = "GE-AI-3D-PROD-3" as const

export const GROWTH_CALIBRATION_APPLY_QA_MARKER =
  "growth-ge-ai-3d-prod-3-calibration-apply-v1" as const

export const GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION =
  "20271001250000_growth_ai_3d_prod_3_calibration_apply.sql" as const

export const GROWTH_CALIBRATION_APPLY_RULE =
  "Controlled calibration apply updates approved configuration overlays only — never code, models, Growth Autonomy, Core, transport, or outbound execution." as const

/** Targets that may receive applied configuration changes. */
export const GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS = [
  "communication_engine",
  "meta_recommender",
  "priority_engine",
  "research_agent",
  "qualification_agent",
  "forecasting",
  "campaign_optimization",
] as const

export type GrowthCalibrationApplyTargetSystem = (typeof GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS)[number]

export const GROWTH_CALIBRATION_VERSION_KINDS = ["apply", "rollback"] as const
export type GrowthCalibrationVersionKind = (typeof GROWTH_CALIBRATION_VERSION_KINDS)[number]

export const GROWTH_CALIBRATION_VERSION_STATUSES = ["applied", "rolled_back", "superseded"] as const
export type GrowthCalibrationVersionStatus = (typeof GROWTH_CALIBRATION_VERSION_STATUSES)[number]

export type GrowthCalibrationConfigSnapshot = Record<string, number | string | boolean>

export type GrowthCalibrationAppliedVersion = {
  id: string
  organizationId: string
  proposalId: string | null
  targetSystem: GrowthCalibrationApplyTargetSystem
  versionNumber: number
  versionKind: GrowthCalibrationVersionKind
  status: GrowthCalibrationVersionStatus
  configSnapshotBefore: GrowthCalibrationConfigSnapshot
  configSnapshotAfter: GrowthCalibrationConfigSnapshot
  rollbackToken: string
  previousVersionId: string | null
  appliedByUserId: string | null
  appliedAt: string
  confidence: number
  impact: number
  eventCorrelationId: string | null
  createdAt: string
}

export type GrowthCalibrationActiveConfig = {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  config: GrowthCalibrationConfigSnapshot
  activeVersionId: string | null
  updatedAt: string
}

export const GROWTH_CALIBRATION_APPLY_EVENT_TYPES = {
  versionCreated: "growth.adaptive_calibration.version_created",
  calibrationApplied: "growth.adaptive_calibration.calibration_applied",
  calibrationRolledBack: "growth.adaptive_calibration.calibration_rolled_back",
  calibrationApplyFailed: "growth.adaptive_calibration.calibration_apply_failed",
} as const

export type GrowthCalibrationApplyReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_CALIBRATION_APPLY_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_CALIBRATION_APPLY_RULE
  schemaReady: boolean
  activeVersions: GrowthCalibrationActiveConfig[]
  recentVersions: GrowthCalibrationAppliedVersion[]
  summary: {
    activeCalibrationCount: number
    readyToApplyCount: number
    rollbackAvailableCount: number
    lastAppliedAt: string | null
    lastAppliedByUserId: string | null
    lastAppliedTargetSystem: GrowthCalibrationApplyTargetSystem | null
    lastAppliedConfidence: number | null
  }
}

export type GrowthCalibrationVersionAdvisory = {
  activeVersion: GrowthCalibrationAppliedVersion | null
  pendingApplyProposalIds: string[]
  rollbackAvailable: boolean
  lastApplied: GrowthCalibrationAppliedVersion | null
  lastOperatorUserId: string | null
  lastConfidence: number | null
}

export function isCalibrationApplyTargetAllowed(
  target: GrowthAdaptiveCalibrationTargetSystem,
): target is GrowthCalibrationApplyTargetSystem {
  return (GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS as readonly string[]).includes(target)
}

export function buildCalibrationApplyIdempotencyKey(input: {
  organizationId: string
  proposalId: string
}): string {
  return `calibration-apply:${input.organizationId}:${input.proposalId}`
}

export function buildCalibrationRollbackIdempotencyKey(input: {
  organizationId: string
  rollbackToken: string
}): string {
  return `calibration-rollback:${input.organizationId}:${input.rollbackToken}`
}

export function generateCalibrationRollbackToken(input: {
  organizationId: string
  proposalId: string
  occurredAt: string
}): string {
  return `rollback:${input.organizationId}:${input.proposalId}:${Date.parse(input.occurredAt)}`
}

export function isCalibrationProposalReadyToApply(status: string): boolean {
  return status === "approved"
}

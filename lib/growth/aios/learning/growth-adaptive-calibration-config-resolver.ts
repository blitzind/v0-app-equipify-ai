/** GE-AI-3D-PROD-3 — Resolve effective calibration config for ranking engines (client-safe). */

import {
  clearPlatformInMemoryCalibrationConfigForTests,
  resolvePlatformCalibrationWeight,
  resolvePlatformCommunicationEngineWeights,
  resolvePlatformEffectiveCalibrationConfig,
  resolvePlatformMetaRecommenderCoefficients,
  resolvePlatformPriorityEngineMetaMultiplier,
  setPlatformInMemoryCalibrationConfigForTests,
} from "@fuzor/configuration"

import type {
  GrowthCalibrationApplyTargetSystem,
  GrowthCalibrationConfigSnapshot,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export function setInMemoryCalibrationConfig(input: {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  config: GrowthCalibrationConfigSnapshot
}): void {
  setPlatformInMemoryCalibrationConfigForTests(input)
}

export function clearInMemoryCalibrationConfig(): void {
  clearPlatformInMemoryCalibrationConfigForTests()
}

export function resolveEffectiveCalibrationConfig(input: {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): GrowthCalibrationConfigSnapshot {
  return resolvePlatformEffectiveCalibrationConfig(input)
}

export function resolveCalibrationWeight(input: {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  key: string
  defaultValue: number
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): number {
  return resolvePlatformCalibrationWeight(input)
}

export function resolveCommunicationEngineWeights(input: {
  organizationId: string
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): {
  engagement: number
  readiness: number
  policy: number
  signal: number
} {
  return resolvePlatformCommunicationEngineWeights(input)
}

export function resolveMetaRecommenderCoefficients(input: {
  organizationId: string
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): {
  impact: number
  urgency: number
  confidence: number
  effort: number
} {
  return resolvePlatformMetaRecommenderCoefficients(input)
}

export function resolvePriorityEngineMetaMultiplier(input: {
  organizationId: string
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): number {
  return resolvePlatformPriorityEngineMetaMultiplier(input)
}

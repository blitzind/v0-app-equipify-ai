/** GE-AI-3D-PROD-3 — Resolve effective calibration config for ranking engines (client-safe). */

import { getDefaultCalibrationConfig } from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-registry"
import type {
  GrowthCalibrationApplyTargetSystem,
  GrowthCalibrationConfigSnapshot,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

const inMemoryOverrides = new Map<string, GrowthCalibrationConfigSnapshot>()

function memoryKey(organizationId: string, targetSystem: GrowthCalibrationApplyTargetSystem): string {
  return `${organizationId}:${targetSystem}`
}

export function setInMemoryCalibrationConfig(input: {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  config: GrowthCalibrationConfigSnapshot
}): void {
  inMemoryOverrides.set(memoryKey(input.organizationId, input.targetSystem), { ...input.config })
}

export function clearInMemoryCalibrationConfig(): void {
  inMemoryOverrides.clear()
}

export function resolveEffectiveCalibrationConfig(input: {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): GrowthCalibrationConfigSnapshot {
  const defaults = getDefaultCalibrationConfig(input.targetSystem)
  const memory = inMemoryOverrides.get(memoryKey(input.organizationId, input.targetSystem))
  const active = input.activeConfig ?? memory ?? null
  if (!active) return defaults
  return { ...defaults, ...active }
}

export function resolveCalibrationWeight(input: {
  organizationId: string
  targetSystem: GrowthCalibrationApplyTargetSystem
  key: string
  defaultValue: number
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): number {
  const config = resolveEffectiveCalibrationConfig({
    organizationId: input.organizationId,
    targetSystem: input.targetSystem,
    activeConfig: input.activeConfig,
  })
  const value = config[input.key]
  return typeof value === "number" ? value : input.defaultValue
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
  const config = resolveEffectiveCalibrationConfig({
    organizationId: input.organizationId,
    targetSystem: "communication_engine",
    activeConfig: input.activeConfig,
  })
  return {
    engagement: typeof config.engagement_weight === "number" ? config.engagement_weight : 0.3,
    readiness: typeof config.readiness_weight === "number" ? config.readiness_weight : 0.25,
    policy: typeof config.policy_weight === "number" ? config.policy_weight : 0.25,
    signal: typeof config.signal_weight === "number" ? config.signal_weight : 0.2,
  }
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
  const config = resolveEffectiveCalibrationConfig({
    organizationId: input.organizationId,
    targetSystem: "meta_recommender",
    activeConfig: input.activeConfig,
  })
  return {
    impact: typeof config.impact_coefficient === "number" ? config.impact_coefficient : 0.35,
    urgency: typeof config.urgency_coefficient === "number" ? config.urgency_coefficient : 0.25,
    confidence: typeof config.confidence_coefficient === "number" ? config.confidence_coefficient : 0.25,
    effort: typeof config.effort_coefficient === "number" ? config.effort_coefficient : 0.15,
  }
}

export function resolvePriorityEngineMetaMultiplier(input: {
  organizationId: string
  activeConfig?: GrowthCalibrationConfigSnapshot | null
}): number {
  return resolveCalibrationWeight({
    organizationId: input.organizationId,
    targetSystem: "priority_engine",
    key: "meta_score_multiplier",
    defaultValue: 0.15,
    activeConfig: input.activeConfig,
  })
}

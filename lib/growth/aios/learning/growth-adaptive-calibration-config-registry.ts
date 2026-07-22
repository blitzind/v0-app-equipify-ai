/** GE-AI-3D-PROD-3 — Default calibration configuration registry (client-safe). */

import {
  PLATFORM_CALIBRATION_DEFAULT_CONFIG,
  getPlatformDefaultCalibrationConfig,
  resolvePlatformCalibrationConfigKey,
} from "@fuzor/configuration"

import type {
  GrowthCalibrationApplyTargetSystem,
  GrowthCalibrationConfigSnapshot,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export const GROWTH_CALIBRATION_DEFAULT_CONFIG = PLATFORM_CALIBRATION_DEFAULT_CONFIG

export function getDefaultCalibrationConfig(
  targetSystem: GrowthCalibrationApplyTargetSystem,
): GrowthCalibrationConfigSnapshot {
  return getPlatformDefaultCalibrationConfig(targetSystem)
}

export function resolveCalibrationConfigKey(
  targetSystem: GrowthCalibrationApplyTargetSystem,
  proposedKey: string,
): string {
  return resolvePlatformCalibrationConfigKey(targetSystem, proposedKey)
}

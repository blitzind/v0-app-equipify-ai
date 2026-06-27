/** GE-AI-3D-PROD-3 — Default calibration configuration registry (client-safe). */

import type {
  GrowthCalibrationApplyTargetSystem,
  GrowthCalibrationConfigSnapshot,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export const GROWTH_CALIBRATION_DEFAULT_CONFIG: Record<
  GrowthCalibrationApplyTargetSystem,
  GrowthCalibrationConfigSnapshot
> = {
  communication_engine: {
    engagement_weight: 0.3,
    readiness_weight: 0.25,
    policy_weight: 0.25,
    signal_weight: 0.2,
    sms_engagement_weight: 0.3,
    email_engagement_weight: 0.3,
  },
  meta_recommender: {
    impact_coefficient: 0.35,
    urgency_coefficient: 0.25,
    confidence_coefficient: 0.25,
    effort_coefficient: 0.15,
  },
  priority_engine: {
    meta_score_multiplier: 0.15,
  },
  research_agent: {
    evidence_weight: 0.4,
    utilization_weight: 0.35,
    freshness_weight: 0.25,
  },
  qualification_agent: {
    fit_score_weight: 0.45,
    signal_weight: 0.35,
    compliance_weight: 0.2,
  },
  forecasting: {
    pace_weight: 0.5,
    pipeline_weight: 0.3,
    confidence_weight: 0.2,
  },
  campaign_optimization: {
    audience_weight: 0.25,
    creative_weight: 0.25,
    timing_weight: 0.25,
    readiness_weight: 0.25,
  },
}

export function getDefaultCalibrationConfig(
  targetSystem: GrowthCalibrationApplyTargetSystem,
): GrowthCalibrationConfigSnapshot {
  return { ...GROWTH_CALIBRATION_DEFAULT_CONFIG[targetSystem] }
}

export function resolveCalibrationConfigKey(
  targetSystem: GrowthCalibrationApplyTargetSystem,
  proposedKey: string,
): string {
  if (proposedKey in GROWTH_CALIBRATION_DEFAULT_CONFIG[targetSystem]) return proposedKey
  return proposedKey
}

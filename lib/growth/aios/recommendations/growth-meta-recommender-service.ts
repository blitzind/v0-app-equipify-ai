/** GE-AI-2F — Meta-Recommender read service (server-only). */

import "server-only"

import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import {
  synthesizeGrowthMetaRecommenderReadModel,
  type GrowthMetaRecommenderInput,
} from "@/lib/growth/aios/recommendations/growth-meta-recommender-engine"
import type { GrowthCalibrationActiveConfig } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import { resolveMetaRecommenderCoefficients } from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-resolver"

export function buildGrowthMetaRecommenderReadModel(input: {
  organizationId: string
  generatedAt: string
  commandCenter: Omit<
    AiOsCommandCenterReadModel,
    "dailyBriefing" | "operationsDashboard" | "autonomyPolicy" | "metaRecommender"
  >
  autonomyPolicy?: GrowthAiOsAutonomyPolicyReadModel
  calibrationActiveConfigs?: GrowthCalibrationActiveConfig[]
  topLimit?: number
  totalLimit?: number
}): GrowthMetaRecommenderReadModel {
  const metaConfig = input.calibrationActiveConfigs?.find((row) => row.targetSystem === "meta_recommender")
  const coefficients = resolveMetaRecommenderCoefficients({
    organizationId: input.organizationId,
    activeConfig: metaConfig?.config,
  })

  const engineInput: GrowthMetaRecommenderInput = {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    commandCenter: input.commandCenter,
    topLimit: input.topLimit,
    totalLimit: input.totalLimit,
    metaCoefficients: coefficients,
    policyContext: input.autonomyPolicy
      ? {
          emergencyStopActive: input.autonomyPolicy.emergencyStopActive,
          autonomyEnabled: input.autonomyPolicy.autonomyEnabled,
          controlPlaneHref: input.autonomyPolicy.controlPlaneHref,
        }
      : undefined,
  }

  return synthesizeGrowthMetaRecommenderReadModel(engineInput)
}

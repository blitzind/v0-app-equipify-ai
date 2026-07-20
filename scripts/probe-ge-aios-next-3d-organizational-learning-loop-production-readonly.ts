/**
 * GE-AIOS-NEXT-3D — Read-only Production validation for recommendation accountability.
 * Run: pnpm probe:ge-aios-next-3d-organizational-learning-loop-production-readonly
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { loadGrowthHomeAvaRecommendationAccountabilityFromProduction } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-production-loader-next-3d"
import { GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"

export const GE_AIOS_NEXT_3D_PRODUCTION_EVIDENCE_QA_MARKER =
  "ge-aios-next-3d-organizational-learning-loop-production-evidence-v1" as const

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("production_bootstrap_failed")
  const organizationId = getGrowthEngineAiOrgId() || EQUIPIFY_PRODUCTION_ORG_ID

  const result = await loadGrowthHomeAvaRecommendationAccountabilityFromProduction({
    admin: boot.admin,
    organizationId,
    outboundDisabled: true,
  })

  const { accountability } = result
  if (accountability.qaMarker !== GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER) {
    throw new Error("accountability_qa_marker_mismatch")
  }
  if (!accountability.history) throw new Error("missing_history_record")
  if (!accountability.organizationalLearningLine) throw new Error("missing_organizational_learning_line")

  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_NEXT_3D_PRODUCTION_EVIDENCE_QA_MARKER,
        readOnly: true,
        organizationId,
        accountabilityQaMarker: accountability.qaMarker,
        primaryTopic: accountability.primaryTopic,
        confidenceEvolution: accountability.confidenceEvolution,
        organizationalLearningLine: accountability.organizationalLearningLine,
        currentStatus: accountability.history.currentStatus,
        stages: accountability.history.stages.map((stage) => ({
          stage: stage.stage,
          status: stage.status,
        })),
        outcomeLinkage: accountability.outcomeLinkage,
        learningModel: accountability.learningModel,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

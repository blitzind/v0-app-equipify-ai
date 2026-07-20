/**
 * GE-AIOS-NEXT-3E — Read-only Production validation for organizational learning certification.
 * Run: pnpm probe:ge-aios-next-3e-organizational-learning-certification-production-readonly
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { loadGrowthOrganizationalLearningCertificationFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-production-loader-next-3e"
import { GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER } from "@/lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"

export const GE_AIOS_NEXT_3E_PRODUCTION_EVIDENCE_QA_MARKER =
  "ge-aios-next-3e-organizational-learning-certification-production-evidence-v1" as const

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("production_bootstrap_failed")
  const organizationId = getGrowthEngineAiOrgId() || EQUIPIFY_PRODUCTION_ORG_ID

  const result = await loadGrowthOrganizationalLearningCertificationFromProduction({
    admin: boot.admin,
    organizationId,
    outboundDisabled: true,
  })

  const { certification, productionConclusions } = result
  if (certification.qaMarker !== GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER) {
    throw new Error("certification_qa_marker_mismatch")
  }
  if (certification.certificationVerdict === "fail") {
    throw new Error(`unsupported_learning_claim:${certification.certificationDetail}`)
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_NEXT_3E_PRODUCTION_EVIDENCE_QA_MARKER,
        readOnly: true,
        organizationId,
        certificationQaMarker: certification.qaMarker,
        certificationVerdict: certification.certificationVerdict,
        certificationDetail: certification.certificationDetail,
        architectureVerdict: certification.architectureVerdict,
        architectureGaps: certification.architectureGaps,
        primaryTopic: certification.primaryTopic,
        primaryTopicCredibility: certification.primaryTopicCredibility,
        attributionWindows: certification.attributionWindows.map((window) => ({
          topic: window.topic,
          maturity: window.maturity,
          implementationAt: window.implementationAt,
        })),
        periodComparisons: certification.periodComparisons.map((row) => ({
          metricId: row.metricId,
          direction: row.direction,
          windowMaturity: row.windowMaturity,
          relativeDeltaPct: row.relativeDeltaPct,
        })),
        learningLoop: certification.learningLoop,
        learningPromotion: certification.learningPromotion,
        productionConclusions,
        organizationalLearningLine: certification.organizationalLearningLine,
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

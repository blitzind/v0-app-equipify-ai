/**
 * GE-AIOS-NEXT-3B — Read-only Production evidence for evidence completeness.
 *
 * Run via Vercel Production env:
 *   pnpm probe:ge-aios-next-3b-evidence-completeness-production-readonly
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { loadGrowthOrganizationalEvidenceCompletenessFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b"
import { GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"

export const GE_AIOS_NEXT_3B_PRODUCTION_EVIDENCE_QA_MARKER =
  "ge-aios-next-3b-evidence-completeness-production-evidence-v1" as const

const OBSERVATION_HOURS = Number(process.env.GE_AIOS_NEXT_3B_OBSERVATION_HOURS ?? "24")

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("production_bootstrap_failed")
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId() || EQUIPIFY_PRODUCTION_ORG_ID

  const result = await loadGrowthOrganizationalEvidenceCompletenessFromProduction({
    admin,
    organizationId,
    observationHours: OBSERVATION_HOURS,
  })

  const { snapshot } = result

  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_NEXT_3B_PRODUCTION_EVIDENCE_QA_MARKER,
        readOnly: true,
        organizationId,
        observationHours: OBSERVATION_HOURS,
        snapshotQaMarker: snapshot.qaMarker,
        executiveConfidenceSummary: snapshot.executiveConfidenceSummary,
        gapsClosed: snapshot.gapsClosed,
        remainingGaps: snapshot.remainingGaps,
        admissionEvidence: snapshot.admissionEvidence,
        decisionMakerReadiness: snapshot.decisionMakerReadiness,
        researchDuration: snapshot.researchDuration,
        operatorDecisionHistory: snapshot.operatorDecisionHistory,
        recommendationOutcomes: snapshot.recommendationOutcomes,
        completenessMatrix: snapshot.completenessMatrix,
        baselineStatus: snapshot.baselineSnapshot.baselineStatus,
        highestConfidenceBottleneck: snapshot.baselineSnapshot.highestConfidenceBottleneck,
      },
      null,
      2,
    ),
  )

  if (snapshot.qaMarker !== GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER) {
    throw new Error("snapshot_qa_marker_mismatch")
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * GE-AIOS-NEXT-3A — Read-only Production evidence for organizational effectiveness baseline.
 *
 * Run via Vercel Production env:
 *   pnpm probe:ge-aios-next-3a-organizational-effectiveness-baseline-production-readonly
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { loadGrowthOrganizationalEffectivenessBaselineFromProduction } from "@/lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-production-loader-next-3a"
import { GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER } from "@/lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types"

export const GE_AIOS_NEXT_3A_PRODUCTION_EVIDENCE_QA_MARKER =
  "ge-aios-next-3a-organizational-effectiveness-production-evidence-v1" as const

const OBSERVATION_HOURS = Number(process.env.GE_AIOS_NEXT_3A_OBSERVATION_HOURS ?? "24")

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("production_bootstrap_failed")
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId() || EQUIPIFY_PRODUCTION_ORG_ID

  const result = await loadGrowthOrganizationalEffectivenessBaselineFromProduction({
    admin,
    organizationId,
    observationHours: OBSERVATION_HOURS,
  })

  const output = {
    qaMarker: GE_AIOS_NEXT_3A_PRODUCTION_EVIDENCE_QA_MARKER,
    readOnly: true,
    organizationId,
    observationHours: OBSERVATION_HOURS,
    snapshotQaMarker: result.snapshot.qaMarker,
    baselineStatus: result.snapshot.baselineStatus,
    improvementTrend: result.snapshot.improvementTrend,
    dataCompletenessSummary: result.snapshot.dataCompletenessSummary,
    highestConfidenceBottleneck: result.snapshot.highestConfidenceBottleneck,
    bottleneckCandidates: result.snapshot.bottleneckCandidates,
    dimensions: result.snapshot.dimensions.map((dim) => ({
      id: dim.id,
      label: dim.label,
      availability: dim.availability,
      confidence: dim.confidence,
      summaryLine: dim.summaryLine,
      metrics: dim.metrics.map((m) => ({
        id: m.id,
        label: m.label,
        value: m.value,
        availability: m.availability,
        qualificationNote: m.qualificationNote,
      })),
    })),
    unavailableMeasurements: result.snapshot.unavailableMeasurements,
    measurementPeriod: result.snapshot.measurementPeriod,
    comparisonPeriod: result.snapshot.comparisonPeriod,
    canonicalDefinitions: result.snapshot.canonicalDefinitions,
    admissionAnalysisMarker: result.admissionAnalysis?.qa_marker ?? null,
    outboundDisabled: result.rawEvidence.outreach.outboundDisabled,
    outboundMessagesInPeriod: result.rawEvidence.outreach.outboundMessagesInPeriod,
    schedulerRuns: result.rawEvidence.runtime.schedulerRuns,
    schedulerSuccessRate: result.rawEvidence.runtime.schedulerSuccessRate,
    errors: null,
  }

  if (result.snapshot.qaMarker !== GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER) {
    throw new Error("snapshot_qa_marker_mismatch")
  }

  console.log(JSON.stringify(output, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

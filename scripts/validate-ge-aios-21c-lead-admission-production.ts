/**
 * GE-AIOS-21C-4 — Lead Admission Production Validation (read-only).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-21c-lead-admission-production.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import {
  analyzeGrowthLeadAdmissionProductionPool,
  GROWTH_LEAD_ADMISSION_PRODUCTION_ANALYSIS_QA_MARKER,
  formatAdmissionDeploymentStatusMessage,
  summarizeGrowthLeadAdmissionDeploymentStatus,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { GROWTH_LEAD_ADMISSION_21C_QA_MARKER } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export const GE_AIOS_21C_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-21c-lead-admission-production-validation-v1" as const

const PHASE = "GE-AIOS-21C-4" as const

async function main(): Promise<void> {
  console.log(`[${PHASE}] Lead Admission Production Validation (read-only)`)
  console.log(`QA marker: ${GE_AIOS_21C_PRODUCTION_VALIDATION_QA_MARKER}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    console.error("GROWTH_ENGINE_AI_ORG_ID not configured")
    process.exit(1)
  }

  console.log(`  ✓ org: ${organizationId}`)
  console.log(`  ✓ admission QA marker: ${GROWTH_LEAD_ADMISSION_21C_QA_MARKER}`)

  const profile = await getActiveApprovedBusinessProfile(admin, organizationId)
  console.log(
    profile
      ? `  ✓ approved profile: ${profile.companyName}`
      : "  ! no approved Company Profile — evaluator will route to review",
  )

  const analysis = await analyzeGrowthLeadAdmissionProductionPool({
    admin,
    organizationId,
  })

  console.log(`\n--- Production Admission Counts ---`)
  console.log(`Analysis marker: ${GROWTH_LEAD_ADMISSION_PRODUCTION_ANALYSIS_QA_MARKER}`)
  console.log(`Generated at: ${analysis.generatedAt}`)
  const deployStatus = summarizeGrowthLeadAdmissionDeploymentStatus(analysis)
  console.log(`\n--- 21C Deployment vs Historical Migration ---`)
  console.log(`  Deployment active (≥1 lead with admission_qa_marker): ${deployStatus.deploymentActive}`)
  console.log(
    `  Leads with admission metadata: ${deployStatus.leadsWithAdmissionMetadata}/${deployStatus.totalActiveLeads}`,
  )
  console.log(`  Legacy leads missing metadata: ${deployStatus.legacyLeadsMissingMetadata}`)
  console.log(`  Status: ${formatAdmissionDeploymentStatusMessage(deployStatus)}`)
  console.log(JSON.stringify(analysis.counts, null, 2))

  console.log(`\n--- Queue Membership by Evaluated Admission State ---`)
  console.log(JSON.stringify(analysis.queueByAdmissionState, null, 2))

  console.log(`\n--- Research Runs by Evaluated Admission State ---`)
  console.log(JSON.stringify(analysis.researchRunsByAdmissionState, null, 2))

  console.log(`\n--- Admission Drift Summary ---`)
  const driftSummary = analysis.driftRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.driftClassification] = (acc[row.driftClassification] ?? 0) + 1
    return acc
  }, {})
  console.log(JSON.stringify(driftSummary, null, 2))

  console.log(`\n--- Representative Samples (contact redacted) ---`)
  console.log(JSON.stringify(analysis.samples, null, 2))

  const driftCount = analysis.counts.storedVsEvaluatedDrift
  const consumerWebsites = analysis.counts.consumerDomainWebsites
  const queueViolations = analysis.counts.invalidRejectedInActiveQueue

  console.log(`\n--- Validation Verdict ---`)
  if (deployStatus.deploymentActive && deployStatus.legacyLeadsMissingMetadata > 0) {
    console.log(
      `[${PHASE}] PASS with legacy migration pending — 21C deployment active; ${deployStatus.legacyLeadsMissingMetadata} historical row(s) lack admission metadata (run 21C cleanup dry-run)`,
    )
  } else if (consumerWebsites > 0 || queueViolations > 0) {
    console.log(
      `[${PHASE}] WARN — legacy pool needs operator-reviewed cleanup (${consumerWebsites} consumer websites, ${queueViolations} invalid/rejected in active queue, ${driftCount} drift rows)`,
    )
  } else if (driftCount > 0) {
    console.log(`[${PHASE}] PASS with drift — ${driftCount} leads differ from fresh evaluator (metadata backfill recommended)`)
  } else {
    console.log(`[${PHASE}] PASS — production pool aligns with canonical admission evaluator`)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

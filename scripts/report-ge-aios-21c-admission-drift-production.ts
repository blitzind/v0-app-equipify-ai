/**
 * GE-AIOS-21C-4 — Admission drift report (read-only).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/report-ge-aios-21c-admission-drift-production.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  analyzeGrowthLeadAdmissionProductionPool,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"

export const GE_AIOS_21C_ADMISSION_DRIFT_REPORT_QA_MARKER =
  "ge-aios-21c-admission-drift-report-v1" as const

const PHASE = "GE-AIOS-21C-4" as const

function parseLimit(argv: string[]): number {
  const match = argv.find((arg) => arg.startsWith("--limit="))
  if (!match) return 200
  const parsed = Number.parseInt(match.split("=")[1] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Admission Drift Report (read-only)`)
  console.log(`QA marker: ${GE_AIOS_21C_ADMISSION_DRIFT_REPORT_QA_MARKER}`)

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

  const limit = parseLimit(process.argv)
  const analysis = await analyzeGrowthLeadAdmissionProductionPool({
    admin,
    organizationId,
    limit,
  })

  const driftOnly = analysis.driftRows.filter(
    (row) => row.driftClassification !== "unchanged",
  )

  const report = driftOnly.map((row) => ({
    leadId: row.leadId,
    companyName: row.companyName,
    storedState: row.storedState,
    evaluatedState: row.evaluatedState,
    reasons: row.reasons.slice(0, 6),
    proposedAction: row.proposedAction,
    driftClassification: row.driftClassification,
    queueMembership: row.queueMembership,
    researchEligibility: row.researchEligibility,
    outreachEligibility: row.outreachEligibility,
  }))

  console.log(
    JSON.stringify(
      {
        qa_marker: GE_AIOS_21C_ADMISSION_DRIFT_REPORT_QA_MARKER,
        generated_at: analysis.generatedAt,
        organization_id: organizationId,
        total_leads_analyzed: analysis.counts.totalActiveLeads,
        drift_rows: report.length,
        summary: report.reduce<Record<string, number>>((acc, row) => {
          acc[row.driftClassification] = (acc[row.driftClassification] ?? 0) + 1
          return acc
        }, {}),
        rows: report,
      },
      null,
      2,
    ),
  )

  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

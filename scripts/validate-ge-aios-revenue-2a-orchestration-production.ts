/**
 * GE-AIOS-REVENUE-2A — Production orchestration certification (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2a-orchestration-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER } from "@/lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"
import { evaluateGrowthPipelinePromotionIntegrity } from "@/lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export const GE_AIOS_REVENUE_2A_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2a-orchestration-production-validation-v1" as const

const PHASE = "GE-AIOS-REVENUE-2A" as const

const DOWNSTREAM_DM_STATES = new Set(["waiting_for_dm", "waiting_for_contact_verification"])
const DOWNSTREAM_PACKAGE_STATES = new Set([
  "waiting_for_personalization",
  "waiting_for_generation",
  "draft_ready",
  "waiting_for_approval",
])

type ViolationRow = {
  leadId: string
  dfState: string
  admissionState: string | null
  violation: string
  earliestIncompleteStage: string | null
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production orchestration certification (read-only)`)
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2A_PRODUCTION_VALIDATION_QA_MARKER}`)
  console.log(`  Integrity marker: ${GROWTH_PIPELINE_PROMOTION_INTEGRITY_2A_QA_MARKER}`)

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

  const { data: dfRows, error: dfError } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, earliest_incomplete_stage, paused_reason, updated_at")
    .eq("organization_id", organizationId)
    .limit(5000)
  if (dfError) {
    console.error(`Draft Factory query failed: ${dfError.message}`)
    process.exit(1)
  }

  const leadIds = [...new Set((dfRows ?? []).map((row) => String((row as { lead_id: string }).lead_id)))]
  const { data: leads, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata")
    .in("id", leadIds.length > 0 ? leadIds : ["00000000-0000-0000-0000-000000000000"])
  if (leadError) {
    console.error(`Leads query failed: ${leadError.message}`)
    process.exit(1)
  }

  const metadataByLead = new Map(
    (leads ?? []).map((row) => [
      String((row as { id: string }).id),
      ((row as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>,
    ]),
  )

  const dmViolations: ViolationRow[] = []
  const packageViolations: ViolationRow[] = []
  const admittedPortfolioPaused: ViolationRow[] = []

  for (const row of dfRows ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    const dfState = String((row as { state: string }).state)
    const earliestIncompleteStage =
      ((row as { earliest_incomplete_stage?: string | null }).earliest_incomplete_stage ?? null)
    const metadata = metadataByLead.get(leadId) ?? null
    const admissionState = resolveLeadAdmissionStateFromMetadata(metadata)

    if (DOWNSTREAM_DM_STATES.has(dfState)) {
      const integrity = evaluateGrowthPipelinePromotionIntegrity({
        metadata,
        boundary: "decision_maker",
      })
      if (!integrity.ok) {
        dmViolations.push({
          leadId,
          dfState,
          admissionState,
          violation: integrity.violation ?? "unknown",
          earliestIncompleteStage,
        })
      }
    }

    if (DOWNSTREAM_PACKAGE_STATES.has(dfState)) {
      const integrity = evaluateGrowthPipelinePromotionIntegrity({
        metadata,
        boundary: "package",
      })
      if (!integrity.ok) {
        packageViolations.push({
          leadId,
          dfState,
          admissionState,
          violation: integrity.violation ?? "unknown",
          earliestIncompleteStage,
        })
      }
    }

    if (
      dfState === "paused" &&
      (earliestIncompleteStage === "portfolio" || (row as { paused_reason?: string }).paused_reason === "portfolio_deferred") &&
      admissionState === "accepted"
    ) {
      admittedPortfolioPaused.push({
        leadId,
        dfState,
        admissionState,
        violation: "admitted_paused_at_portfolio",
        earliestIncompleteStage,
      })
    }
  }

  const { count: bcRecentCount } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  const admissionCounts = { accepted: 0, review: 0, rejected: 0, invalid: 0, unset: 0 }
  for (const metadata of metadataByLead.values()) {
    const state = resolveLeadAdmissionStateFromMetadata(metadata)
    if (state === "accepted") admissionCounts.accepted += 1
    else if (state === "review") admissionCounts.review += 1
    else if (state === "rejected") admissionCounts.rejected += 1
    else if (state === "invalid") admissionCounts.invalid += 1
    else admissionCounts.unset += 1
  }

  const dfStateCounts: Record<string, number> = {}
  for (const row of dfRows ?? []) {
    const state = String((row as { state: string }).state)
    dfStateCounts[state] = (dfStateCounts[state] ?? 0) + 1
  }

  console.log("\n--- Before/After Orchestration Snapshot ---")
  console.log("Admission metadata (DF lead pool):")
  console.log(JSON.stringify(admissionCounts, null, 2))
  console.log("Draft Factory durable states:")
  console.log(JSON.stringify(dfStateCounts, null, 2))

  console.log("\n--- Promotion Integrity (production state) ---")
  console.log(`Rejected/review in Decision Maker stages: ${dmViolations.length}`)
  if (dmViolations.length > 0) {
    console.log(JSON.stringify(dmViolations.slice(0, 10), null, 2))
  }
  console.log(`Rejected/review in Package stages: ${packageViolations.length}`)
  if (packageViolations.length > 0) {
    console.log(JSON.stringify(packageViolations.slice(0, 10), null, 2))
  }
  console.log(`Admitted leads paused at portfolio (eligible for due wake): ${admittedPortfolioPaused.length}`)
  if (admittedPortfolioPaused.length > 0) {
    console.log(JSON.stringify(admittedPortfolioPaused.slice(0, 10), null, 2))
  }
  console.log(`Buying Committee jobs (7d): ${bcRecentCount ?? 0}`)

  console.log("\n--- Pipeline Flow (canonical gates) ---")
  console.log("Admission → Research → Qualification → Portfolio → Decision Maker → Package → Approval")
  console.log("- Qualification: admitted === accepted only (review/rejected terminal)")
  console.log("- Portfolio: due scheduler selects accepted + paused@portfolio via cheap_validation class")
  console.log("- Decision Maker: BC enqueue wired from research CI promotion + Datamoon after portfolio")
  console.log("- Package/Outbound: integrity assertions block non-accepted admission")

  const blockingViolations = dmViolations.length + packageViolations.length

  console.log("\n--- Certification Verdict ---")
  if (blockingViolations > 0) {
    console.log(
      `FAIL — ${blockingViolations} canonical promotion integrity violation(s) in production durable state.`,
    )
    console.log(
      "Historical rows may remain until the next scheduler reconcile tick; new advances must not add violations.",
    )
    process.exit(1)
  }

  console.log("PASS — no rejected/review leads in downstream DM or Package durable states.")
  console.log(
    admittedPortfolioPaused.length > 0
      ? `INFO — ${admittedPortfolioPaused.length} accepted lead(s) awaiting portfolio due wake (expected pre-tick).`
      : "INFO — no admitted portfolio-deferred leads in durable store.",
  )
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

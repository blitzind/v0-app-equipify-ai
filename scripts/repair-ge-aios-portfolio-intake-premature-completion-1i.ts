/**
 * GE-AIOS-PORTFOLIO-INTAKE-PUSH-REVALIDATION-FIX-1I / KEYWORD-DEFERRAL-1K — Targeted production recovery (dry-run default).
 *
 * Run dry-run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/repair-ge-aios-portfolio-intake-premature-completion-1i.ts
 *
 * Mutate (explicit confirmation required):
 *   CONFIRM_GE_AIOS_PORTFOLIO_INTAKE_1I_RECOVERY=1 ... repair script
 *
 * Override recovery attempt cap (explicit):
 *   CONFIRM_GE_AIOS_PORTFOLIO_INTAKE_1K_RECOVERY_OVERRIDE=1
 */
import { fetchDatamoonAudienceImportRunById } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  patchAutonomousRunIntakeMetadataForRecovery,
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-portfolio-intake-disposition-1i"
import { GROWTH_EXTERNAL_DISCOVERY_KEYWORD_DEFERRAL_PRODUCTION_CLOSURE_1K_QA_MARKER } from "@/lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k"
import { loadPortfolioIntakeSurvivorsFromProduction } from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"
import { runPortfolioIntakeEnrichmentSmokeTestForRun } from "@/lib/growth/training/portfolio-intake-enrichment-smoke-test-1k"

const TARGET_RUNS = [
  "66dc98a4-35f7-48dd-8fa2-9e26be81c556",
  "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a",
] as const

const MAX_RECOVERY_ATTEMPTS = 2
const FIX_QA_MARKER = GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER

async function main() {
  const confirm = process.env.CONFIRM_GE_AIOS_PORTFOLIO_INTAKE_1I_RECOVERY === "1"
  const overrideAttemptCap = process.env.CONFIRM_GE_AIOS_PORTFOLIO_INTAKE_1K_RECOVERY_OVERRIDE === "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  const admin = boot.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const approved = await getActiveApprovedBusinessProfile(admin, orgId)
  if (!approved?.profile) throw new Error("no_profile")

  const survivorLoad = await loadPortfolioIntakeSurvivorsFromProduction({ admin, organizationId: orgId })
  const actions = []

  for (const runId of TARGET_RUNS) {
    const run = await fetchDatamoonAudienceImportRunById(admin, runId)
    if (!run) {
      actions.push({ runId, action: "skip", reason: "run_not_found" })
      continue
    }

    const intake = readAutonomousRunIntakeLifecycleFields(run)
    const survivors = survivorLoad.survivors.filter((row) => row.runId === runId)
    const bugSurvivors = survivors.filter((row) => {
      const canonicalFirst = survivorLoad.survivors.find(
        (s) => s.canonicalCompanyKey === row.canonicalCompanyKey,
      )
      return canonicalFirst?.survivorKey === row.survivorKey
    })

    if (intake.intake_completed !== true) {
      actions.push({ runId, action: "skip", reason: "intake_not_completed" })
      continue
    }

    if (bugSurvivors.length === 0) {
      actions.push({ runId, action: "skip", reason: "no_undisposed_first_canonical_survivors" })
      continue
    }

    const attemptCount = intake.intake_recovery_attempt_count ?? 0
    if (attemptCount >= MAX_RECOVERY_ATTEMPTS && !overrideAttemptCap) {
      actions.push({
        runId,
        action: "skip",
        reason: "recovery_attempt_cap_reached",
        attemptCount,
      })
      continue
    }

    const smoke = await runPortfolioIntakeEnrichmentSmokeTestForRun(admin, {
      organizationId: orgId,
      runId,
      profile: approved.profile,
      companyName: approved.companyName,
    })
    if (!smoke.eligibleForRecovery) {
      actions.push({
        runId,
        action: "skip",
        reason: smoke.ineligibleReason ?? "enrichment_smoke_test_failed",
        smoke,
      })
      continue
    }

    const recoveryAudit = {
      qa_marker: FIX_QA_MARKER,
      keyword_deferral_qa_marker: GROWTH_EXTERNAL_DISCOVERY_KEYWORD_DEFERRAL_PRODUCTION_CLOSURE_1K_QA_MARKER,
      recovered_at: new Date().toISOString(),
      undisposed_survivor_count: bugSurvivors.length,
      survivor_keys: bugSurvivors.map((row) => row.survivorKey),
      enrichment_smoke_test: smoke,
      dry_run: !confirm,
    }

    if (!confirm) {
      actions.push({ runId, action: "would_recover", recoveryAudit })
      continue
    }

    await patchAutonomousRunIntakeMetadataForRecovery(admin, runId, {
      intake_completed: false,
      intake_completed_at: null,
      intake_pending: true,
      intake_pending_at: new Date().toISOString(),
      intake_promotion_started_at: null,
      intake_zero_survivor_reason: null,
      intake_enrichment_diagnostic: null,
      intake_recovery_audit: recoveryAudit,
      intake_recovery_attempt_count: attemptCount + 1,
      intake_recovery_last_attempt_at: new Date().toISOString(),
    })
    actions.push({ runId, action: "recovered", recoveryAudit })
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: FIX_QA_MARKER,
        keywordDeferralQaMarker: GROWTH_EXTERNAL_DISCOVERY_KEYWORD_DEFERRAL_PRODUCTION_CLOSURE_1K_QA_MARKER,
        mode: confirm ? "mutate" : "dry_run",
        organizationId: orgId,
        maxRecoveryAttempts: MAX_RECOVERY_ATTEMPTS,
        overrideAttemptCap,
        actions,
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

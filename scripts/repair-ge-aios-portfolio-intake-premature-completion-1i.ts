/**
 * GE-AIOS-PORTFOLIO-INTAKE-PUSH-REVALIDATION-FIX-1I — Targeted production recovery (dry-run default).
 *
 * Run dry-run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/repair-ge-aios-portfolio-intake-premature-completion-1i.ts
 *
 * Mutate (explicit confirmation required):
 *   CONFIRM_GE_AIOS_PORTFOLIO_INTAKE_1I_RECOVERY=1 ... repair script
 */
import { fetchDatamoonAudienceImportRunById } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  patchAutonomousRunIntakeMetadataForRecovery,
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-portfolio-intake-disposition-1i"
import { loadPortfolioIntakeSurvivorsFromProduction } from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"

const TARGET_RUNS = [
  "66dc98a4-35f7-48dd-8fa2-9e26be81c556",
  "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a",
] as const

const FIX_QA_MARKER = GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER

async function main() {
  const confirm = process.env.CONFIRM_GE_AIOS_PORTFOLIO_INTAKE_1I_RECOVERY === "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  const admin = boot.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
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

    const recoveryAudit = {
      qa_marker: FIX_QA_MARKER,
      recovered_at: new Date().toISOString(),
      undisposed_survivor_count: bugSurvivors.length,
      survivor_keys: bugSurvivors.map((row) => row.survivorKey),
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
      intake_recovery_audit: recoveryAudit,
    })
    actions.push({ runId, action: "recovered", recoveryAudit })
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: FIX_QA_MARKER,
        mode: confirm ? "mutate" : "dry_run",
        organizationId: orgId,
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

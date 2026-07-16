/**
 * GE-AIOS-PORTFOLIO-INTAKE-PUSH-REVALIDATION-FIX-1I — Production replay probe (read-only).
 */
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import {
  buildProspectSearchFiltersFromBusinessProfile,
  buildProspectSearchQueryFromBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveProspectSearchCompanyResultsForPush } from "@/lib/growth/prospect-search/prospect-search-repository"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import { GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-portfolio-intake-disposition-1i"
import { loadPortfolioIntakeSurvivorsFromProduction } from "@/lib/growth/training/portfolio-intake-survivor-loader-1d"

const TARGET_RUNS = [
  { audience: "6062", runId: "66dc98a4-35f7-48dd-8fa2-9e26be81c556" },
  { audience: "6059", runId: "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a" },
] as const

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const approved = await getActiveApprovedBusinessProfile(admin, orgId)
  if (!approved?.profile) throw new Error("no_profile")
  const query = buildProspectSearchQueryFromBusinessProfile(approved.profile, null)
  const filters = buildProspectSearchFiltersFromBusinessProfile(approved.profile)
  const survivorLoad = await loadPortfolioIntakeSurvivorsFromProduction({ admin, organizationId: orgId })
  const reports = []

  for (const spec of TARGET_RUNS) {
    const auditSurvivors = survivorLoad.survivors.filter((row) => row.runId === spec.runId)
    const selected = auditSurvivors.map((row) => ({
      source_type: row.company.source_type,
      id: row.company.id,
      company_name: row.company.company_name,
    }))
    const resolved = await resolveProspectSearchCompanyResultsForPush(admin, {
      query,
      filters,
      discovery_mode: "discover_external",
      selected,
      autonomous_push_context: {
        organization_id: orgId,
        approved_profile: approved.profile,
        discovery_authority: "autonomous_portfolio",
        datamoon_run_id: spec.runId,
      },
    })
    reports.push({
      runId: spec.runId,
      audience: spec.audience,
      selectedCount: selected.length,
      resolveMatchCount: selected.filter((ref) => resolved.has(prospectSearchSelectionKey(ref))).length,
      perCompany: selected.map((ref) => ({
        company: ref.company_name,
        resolved: resolved.has(prospectSearchSelectionKey(ref)),
      })),
    })
  }

  console.log(
    JSON.stringify({ qaMarker: GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER, reports }, null, 2),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

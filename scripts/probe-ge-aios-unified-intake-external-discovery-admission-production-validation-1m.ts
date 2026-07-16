/**
 * GE-AIOS-UNIFIED-INTAKE-EXTERNAL-DISCOVERY-ADMISSION-CLOSURE-1M — Production post-tick validation.
 */
import assert from "node:assert/strict"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { fetchDatamoonAudienceImportRunById } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  findLatestIntakePendingAutonomousProspectSearchDatamoonRun,
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { runPortfolioIntakeEnrichmentSmokeTestForRun } from "@/lib/growth/training/portfolio-intake-enrichment-smoke-test-1k"

const QA_MARKER = "ge-aios-unified-intake-external-discovery-admission-closure-1m-v1" as const
const EXCLUDED_RUNS = new Set([
  "66dc98a4-35f7-48dd-8fa2-9e26be81c556",
  "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a",
  "7a8a9e74-a753-4f01-a4b8-753b6079e9b8",
])
const TARGET_RUN = process.argv[2] ?? null
const SINCE_MINUTES = Number(process.env.GE_AIOS_1M_VALIDATION_SINCE_MINUTES ?? "30")

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const approved = await getActiveApprovedBusinessProfile(admin, orgId)
  if (!approved?.profile) throw new Error("no_profile")

  const since = Date.now() - SINCE_MINUTES * 60_000
  const { data: recentLeads } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, status, metadata, source_kind, source_detail, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .gte("created_at", new Date(since).toISOString())
    .order("created_at", { ascending: false })
    .limit(50)

  const externalDiscoveryLeads = (recentLeads ?? []).filter((lead) => {
    const metadata = (lead.metadata as Record<string, unknown> | null) ?? {}
    const siteKey = metadata.intake_site_key ?? metadata.intakeSiteKey
    return siteKey === "prospect_search_external_discovery"
  })

  const pending = TARGET_RUN
    ? await fetchDatamoonAudienceImportRunById(admin, TARGET_RUN)
    : await findLatestIntakePendingAutonomousProspectSearchDatamoonRun(admin, orgId)

  const runId = TARGET_RUN ?? pending?.id ?? null
  const run = runId ? await fetchDatamoonAudienceImportRunById(admin, runId) : null
  const intake = run ? readAutonomousRunIntakeLifecycleFields(run) : null
  const smoke =
    run && !EXCLUDED_RUNS.has(run.id)
      ? await runPortfolioIntakeEnrichmentSmokeTestForRun(admin, {
          organizationId: orgId,
          runId: run.id,
          profile: approved.profile,
          companyName: approved.companyName,
        })
      : null

  const ledger = externalDiscoveryLeads.map((lead) => {
    const metadata = (lead.metadata as Record<string, unknown> | null) ?? {}
    const unifiedSource =
      typeof metadata.unified_intake_source === "string" ? metadata.unified_intake_source : null
    const reasons = Array.isArray(metadata.admission_reasons)
      ? metadata.admission_reasons.filter((value): value is string => typeof value === "string")
      : []
    return {
      company: lead.company_name,
      leadId: lead.id,
      createdAt: lead.created_at,
      unifiedIntakeSource: unifiedSource,
      intakeSiteKey: metadata.intake_site_key ?? metadata.intakeSiteKey ?? null,
      admissionState: resolveLeadAdmissionStateFromMetadata(metadata),
      admissionReasons: reasons,
      externalDiscoverySource: isExternalDiscoveryLeadIntakeSource(unifiedSource),
      pendingKeywordValidation: reasons.includes("pending_operational_keyword_validation"),
      researchRunId: lead.latest_prospect_research_run_id,
      lastResearchedAt: lead.last_prospect_researched_at,
      sourceKind: lead.source_kind,
      sourceDetail: lead.source_detail,
    }
  })

  const report = {
    qaMarker: QA_MARKER,
    capturedAt: new Date().toISOString(),
    targetRunId: runId,
    excludedRegressionRuns: [...EXCLUDED_RUNS],
    runIntake: intake,
    smoke,
    recentExternalDiscoveryLeadCount: externalDiscoveryLeads.length,
    ledger,
    checks: {
      hasRecentExternalDiscoveryLead: externalDiscoveryLeads.length > 0,
      allUnifiedSourceDatamoon:
        externalDiscoveryLeads.length === 0 ||
        ledger.every((row) => row.unifiedIntakeSource === "datamoon"),
      allAdmissionReviewOrRejected:
        externalDiscoveryLeads.length === 0 ||
        ledger.every((row) => row.admissionState === "review" || row.admissionState === "rejected"),
      noneAcceptedBeforeResearch:
        externalDiscoveryLeads.length === 0 ||
        ledger.every((row) => row.admissionState !== "accepted"),
      allPendingKeywordValidation:
        externalDiscoveryLeads.length === 0 ||
        ledger.every((row) => row.pendingKeywordValidation),
    },
  }

  console.log(JSON.stringify(report, null, 2))

  if (externalDiscoveryLeads.length > 0) {
    assert.equal(report.checks.allUnifiedSourceDatamoon, true, "unified_intake_source must be datamoon")
    assert.equal(report.checks.noneAcceptedBeforeResearch, true, "manufacturers must not be accepted pre-research")
    assert.equal(report.checks.allPendingKeywordValidation, true, "pending_operational_keyword_validation required")
    assert.equal(report.checks.allAdmissionReviewOrRejected, true, "admission must be review or rejected pre-research")
    console.log(`\nPASS ${QA_MARKER} — production admission validation`)
  } else {
    console.log(`\nINFO ${QA_MARKER} — no recent external-discovery leads in window; inspect run state manually`)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

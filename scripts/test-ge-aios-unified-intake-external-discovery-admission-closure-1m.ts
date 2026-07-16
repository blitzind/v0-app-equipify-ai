/**
 * GE-AIOS-UNIFIED-INTAKE-EXTERNAL-DISCOVERY-ADMISSION-CLOSURE-1M — Certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import {
  evaluateGrowthOperationalKeywordValidation,
  GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
  isExternalDiscoveryLeadIntakeSource,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"

const QA_MARKER = "ge-aios-unified-intake-external-discovery-admission-closure-1m-v1" as const
const ROOT = process.cwd()
const PRODUCTION_VALIDATION = process.argv.includes("--production")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function inboxInput(siteKey: string) {
  return {
    site_key: siteKey,
    candidate_type: "identified" as const,
    candidate_priority: "normal" as const,
    intent_score: 0,
    intent_grade: "C" as const,
    candidate_confidence: 0.75,
    pipeline_entry: "icp_targeting" as const,
    company_name: "Example Service Co",
    domain: "example.com",
    dedupe_hash: "test-dedupe-hash",
    candidate_reasoning: ["test"],
    candidate_evidence: [{ claim: "test", evidence: "test", source: "test" }],
    candidate_attribution: [{ source: "test", section: "test", signal: "test", evidence: "test" }],
    session_count: 0,
    visit_count: 0,
    intent_session_id: "test-session",
    visitor_key: "test-visitor",
  }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const bridgeSource = readSource("lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts")
  assert.match(
    bridgeSource,
    /GROWTH_UNIFIED_INTAKE_EXTERNAL_DISCOVERY_ADMISSION_CLOSURE_1M_QA_MARKER/,
  )
  assert.match(
    bridgeSource,
    /siteKey === "prospect_search_external_discovery"\) return "datamoon"/,
  )
  console.log("  ✓ Architecture guard — external discovery site_key maps to datamoon")

  const { resolveIntakeSourceFromInboxInput } = await import(
    "@/lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge"
  )

  assert.equal(
    resolveIntakeSourceFromInboxInput(inboxInput("prospect_search_external_discovery")),
    "datamoon",
  )
  assert.equal(resolveIntakeSourceFromInboxInput(inboxInput("prospect_search")), "saved_search")
  assert.equal(
    resolveIntakeSourceFromInboxInput(inboxInput("prospect_search_operator_push")),
    "saved_search",
  )
  assert.equal(resolveIntakeSourceFromInboxInput(inboxInput("growth_audience")), "saved_search")
  assert.equal(resolveIntakeSourceFromInboxInput(inboxInput("website_capture")), "website")
  console.log("  ✓ resolveIntakeSourceFromInboxInput — canonical source classification")

  const profile = buildLive1bEquipifyCompanyProfileContent()
  const requiredKeywords = buildProspectSearchFiltersFromBusinessProfile(profile).keywords ?? []
  const admissionContext = { approvedProfile: profile, activeMissionTitle: null }

  const externalIntake = normalizeLeadIntakeSource({
    source: resolveIntakeSourceFromInboxInput(inboxInput("prospect_search_external_discovery")),
    company: {
      name: "Osterwalder Ag",
      website: "https://osterwalder.com",
      domain: "osterwalder.com",
      industry: "Machinery Manufacturing",
    },
    contact: { email: "ops@example.com" },
    metadata: {
      intakeSiteKey: "prospect_search_external_discovery",
      prospect_search: { source_type: "external_discovered", source_id: "domain:osterwalder.com" },
      prospect_search_industry_gate_passed: true,
    },
  })

  assert.equal(isExternalDiscoveryLeadIntakeSource(externalIntake.source), true)
  const preResearch = evaluateGrowthLeadAdmission(externalIntake, admissionContext, {
    prospectSearchIndustryGatePassed: true,
  })
  assert.equal(preResearch.state, "review")
  assert.ok(preResearch.reasons.includes("pending_operational_keyword_validation"))
  assert.notEqual(preResearch.state, "accepted")
  console.log("  ✓ Unified Intake → Admission — external discovery deferred to review")

  const operatorIntake = normalizeLeadIntakeSource({
    source: resolveIntakeSourceFromInboxInput(inboxInput("prospect_search")),
    company: {
      name: "Operator Saved Search Co",
      website: "https://operator.example.com",
      domain: "operator.example.com",
    },
    contact: { email: "ops@operator.example.com" },
  })
  assert.equal(isExternalDiscoveryLeadIntakeSource(operatorIntake.source), false)
  const operatorAdmission = evaluateGrowthLeadAdmission(operatorIntake, admissionContext)
  assert.ok(!operatorAdmission.reasons.includes("pending_operational_keyword_validation"))
  console.log("  ✓ Operator saved_search push — unchanged admission semantics")

  const persistedLead = {
    id: "00000000-0000-4000-8000-000000000001",
    company_name: "Osterwalder Ag",
    website: "https://osterwalder.com",
    metadata: {
      unified_intake_source: "datamoon",
      admission_state: "review",
      admission_reasons: ["profile_aligned", "pending_operational_keyword_validation"],
      prospect_search_industry_gate_passed: true,
    },
  }
  const rehydrated = buildGrowthLeadAdmissionIntakeFromLead(persistedLead)
  assert.equal(rehydrated.source, "datamoon")
  assert.equal(isExternalDiscoveryLeadIntakeSource(rehydrated.source), true)

  const keywordFail = evaluateGrowthOperationalKeywordValidation({
    companyName: "Osterwalder Ag",
    industry: "Machinery Manufacturing",
    requiredKeywords: requiredKeywords,
    websiteCrawlText: "powder compaction machinery manufacturing industrial presses",
  })
  assert.equal(keywordFail.pass, false)

  const postResearch = evaluateGrowthLeadAdmission(rehydrated, admissionContext, {
    prospectSearchIndustryGatePassed: true,
    operationalKeywordValidation: keywordFail,
  })
  assert.equal(postResearch.state, "rejected")
  assert.ok(postResearch.reasons.includes("operational_keyword_validation_failed"))
  console.log("  ✓ Post-Research reconciliation path — manufacturer rejected after evidence")

  const keywordPass = evaluateGrowthOperationalKeywordValidation({
    companyName: "Thermo Fisher",
    industry: "Medical equipment service",
    requiredKeywords: requiredKeywords,
    websiteCrawlText:
      "field service technicians preventive maintenance equipment repair installation services",
  })
  const servicePostResearch = evaluateGrowthLeadAdmission(rehydrated, admissionContext, {
    prospectSearchIndustryGatePassed: true,
    operationalKeywordValidation: keywordPass,
  })
  assert.notEqual(servicePostResearch.state, "rejected")
  console.log("  ✓ Post-Research reconciliation path — service company may advance after keyword pass")

  assert.ok(
    readSource("lib/growth/revenue-workflow/growth-operational-keyword-validation-1a.ts").includes(
      GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
    ),
  )
  console.log("  ✓ Dependency closure — post-research keyword validation module present")

  if (PRODUCTION_VALIDATION) {
    const { bootstrapGrowthOperatorNotificationsCertEnv } = await import(
      "@/lib/growth/notifications/growth-notification-cert-bootstrap"
    )
    const { EQUIPIFY_PRODUCTION_ORG_ID } = await import(
      "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
    )
    const { fetchDatamoonAudienceImportRunById } = await import(
      "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
    )
    const {
      findLatestIntakePendingAutonomousProspectSearchDatamoonRun,
      readAutonomousRunIntakeLifecycleFields,
    } = await import(
      "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
    )
    const { runPortfolioIntakeEnrichmentSmokeTestForRun } = await import(
      "@/lib/growth/training/portfolio-intake-enrichment-smoke-test-1k"
    )
    const { getActiveApprovedBusinessProfile } = await import(
      "@/lib/growth/business-profile/business-profile-repository"
    )

    const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
    if (!boot) throw new Error("bootstrap_failed")
    const admin = boot.admin
    const orgId = EQUIPIFY_PRODUCTION_ORG_ID
    const approved = await getActiveApprovedBusinessProfile(admin, orgId)
    if (!approved?.profile) throw new Error("no_profile")

    const EXCLUDED = new Set([
      "66dc98a4-35f7-48dd-8fa2-9e26be81c556",
      "6c1a3ff6-30f5-45cc-b1dc-5124e6c3055a",
      "7a8a9e74-a753-4f01-a4b8-753b6079e9b8",
    ])

    const pending = await findLatestIntakePendingAutonomousProspectSearchDatamoonRun(admin, orgId)
    if (!pending?.id || EXCLUDED.has(pending.id)) {
      throw new Error("no_eligible_intake_pending_run_for_production_validation")
    }

    const run = await fetchDatamoonAudienceImportRunById(admin, pending.id)
    if (!run) throw new Error("run_not_found")
    const intake = readAutonomousRunIntakeLifecycleFields(run)
    if (intake.intake_completed === true) throw new Error("run_already_completed")

    const smoke = await runPortfolioIntakeEnrichmentSmokeTestForRun(admin, {
      organizationId: orgId,
      runId: pending.id,
      profile: approved.profile,
      companyName: approved.companyName,
    })
    assert.ok(smoke.postFilterSurvivorCount > 0, "expected survivors on validation run")

    const { data: leadsBefore } = await admin
      .schema("growth")
      .from("leads")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    console.log(`  ↷ Production validation cohort: ${pending.id} (${smoke.postFilterSurvivorCount} survivors)`)
    console.log("  ↷ Trigger scheduler tick via: vercel crons run /api/cron/growth-objective-runtime-scheduler")
    console.log(`  ↷ Pre-tick lead count sample: ${(leadsBefore ?? []).length}`)
    console.log("  ↷ Re-run with production post-tick inspection after deploy + tick")
  } else {
    console.log("  ↷ Production validation skipped (pass --production after deploy + tick)")
  }

  console.log(`\nPASS — unified intake external discovery admission closure certified`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

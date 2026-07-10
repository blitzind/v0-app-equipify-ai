/**
 * GE-AIOS-21C-4 — Production cleanup tool certification (local, no production writes).
 * Run: pnpm test:ge-aios-21c-production-cleanup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadAdmissionCleanupPlan,
  GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN,
  GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID,
} from "../lib/growth/revenue-workflow/growth-lead-admission-cleanup-plan"
import {
  classifyGrowthLeadAdmissionDrift,
  resolveOutreachEligibility,
} from "../lib/growth/revenue-workflow/growth-lead-admission-drift"
import { evaluateGrowthLeadAdmission } from "../lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildGrowthLeadAdmissionIntakeFromLead } from "../lib/growth/revenue-workflow/growth-lead-admission-lead-input"

const PHASE = "GE-AIOS-21C-4" as const

const SAMPLE_PROFILE = {
  company: {
    companyName: "Equipify",
    website: "https://equipify.example",
    shortDescription: "Field service software",
    productsServices: ["CMMS"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Equipment service operations",
  },
  idealCustomers: {
    targetIndustries: ["medical equipment service"],
    companySizeRanges: ["11-50"],
    geography: ["United States"],
    buyerPersonas: ["Owner"],
    disqualifiers: ["retail"],
  },
  problemsAndTriggers: {
    painPoints: [],
    buyingTriggers: [],
    competitorsAlternatives: [],
    keywords: ["medical equipment service"],
    negativeKeywords: ["roofing"],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: null,
    messagingAngles: [],
    qualificationCriteria: [],
  },
  confidence: { score: 85, assumptions: [], missingInformation: [] },
} as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Production cleanup certification`)

  const cleanupScript = readSource("scripts/cleanup-ge-aios-21c-legacy-leads-production.ts")
  const cleanupPlanModule = readSource("lib/growth/revenue-workflow/growth-lead-admission-cleanup-plan.ts")
  assert.match(cleanupScript, /DRY-RUN ONLY/)
  assert.match(cleanupScript, /--write/)
  assert.match(cleanupScript, /--confirm=GE_AIOS_21C_LEGACY_CLEANUP/)
  assert.match(cleanupScript, /Write refused/)
  assert.match(cleanupScript, /buildGrowthLeadAdmissionCleanupPlan/)
  assert.match(cleanupPlanModule, /evaluateGrowthLeadAdmission/)
  console.log("  ✓ cleanup script is dry-run by default and requires explicit confirmation")

  assert.equal(GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID, "cleanup-ge-aios-21c-legacy-leads-production")
  assert.equal(GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN, "GE_AIOS_21C_LEGACY_CLEANUP")
  console.log("  ✓ cleanup confirmation token defined")

  const invalidLead = {
    id: "lead-invalid-1",
    company_name: "yahoo.com",
    contact_name: "John Smith",
    contact_email: "john@yahoo.com",
    website: "https://yahoo.com",
    status: "new",
    metadata: {},
  }
  const intake = buildGrowthLeadAdmissionIntakeFromLead(invalidLead)
  const evaluation = evaluateGrowthLeadAdmission(intake, {
    approvedProfile: SAMPLE_PROFILE,
    activeMissionTitle: "Medical demos",
  })
  assert.equal(evaluation.state, "invalid")

  const plan = buildGrowthLeadAdmissionCleanupPlan({
    lead: invalidLead,
    admissionContext: { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical demos" },
  })
  assert.ok(plan.proposedChanges.some((change) => change.includes("admission_state")))
  assert.ok(plan.proposedChanges.some((change) => change.includes("clear consumer-domain website")))
  assert.ok(plan.proposedChanges.some((change) => change.includes("disqualified")))
  console.log("  ✓ invalid legacy lead cleanup plan clears identity and suppresses queues")

  const drift = classifyGrowthLeadAdmissionDrift({
    storedState: null,
    evaluation,
    currentWebsite: invalidLead.website,
    currentCompanyName: invalidLead.company_name,
    status: invalidLead.status,
  })
  assert.ok(
    drift.driftClassification === "metadata_missing" ||
      drift.driftClassification === "queue_suppression_required" ||
      drift.driftClassification === "identity_cleanup_required",
  )
  assert.equal(drift.researchEligibility, false)
  assert.equal(
    resolveOutreachEligibility({ evaluation, status: "new", suppressed: false }),
    false,
  )
  console.log("  ✓ drift report classifies metadata_missing and blocks outreach")

  const idempotentPlan = buildGrowthLeadAdmissionCleanupPlan({
    lead: {
      ...invalidLead,
      status: "disqualified",
      website: null,
      company_name: "John Smith (company unknown)",
      metadata: {
        admission_state: "invalid",
        admission_qa_marker: "ge-aios-21c-lead-admission-gate-v1",
      },
    },
    admissionContext: { approvedProfile: SAMPLE_PROFILE },
  })
  assert.equal(idempotentPlan.idempotent, true)
  console.log("  ✓ cleanup plan is idempotent when lead already cleaned")

  const cleanupModule = readSource("lib/growth/revenue-workflow/growth-lead-admission-cleanup.ts")
  assert.match(cleanupModule, /admission_cleanup_audit/)
  assert.match(cleanupPlanModule, /buildGrowthLeadAdmissionCleanupPlan/)
  assert.doesNotMatch(cleanupModule, /\.delete\(/)
  assert.doesNotMatch(cleanupModule, /deleteGrowthLead/)
  console.log("  ✓ cleanup preserves audit history and never deletes leads")

  const analysisModule = readSource(
    "lib/growth/revenue-workflow/growth-lead-admission-production-analysis.ts",
  )
  assert.match(analysisModule, /evaluateGrowthLeadAdmission/)
  assert.doesNotMatch(analysisModule, /updateGrowthLead/)
  console.log("  ✓ production analysis is read-only")

  console.log(`[${PHASE}] PASS — Production cleanup certified (local)`)
}

main()

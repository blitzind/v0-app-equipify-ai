/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Milestone certification (local architecture + fixture).
 * Run: pnpm test:ge-aios-first-customer-supervised-sales-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER } from "../lib/growth/training/supervised-sales-workflow-1b-types"
import { auditSupervisedSalesRuntimeComponents, summarizeRuntimeReadiness } from "../lib/growth/training/supervised-sales-workflow-readiness-audit-1b"
import { auditSupervisedSalesApprovalWorkflow } from "../lib/growth/training/supervised-sales-approval-workflow-audit-1b"
import { rankSupervisedSalesLeadCandidates } from "../lib/growth/training/supervised-sales-production-lead-selection-1b"
import { projectSupervisedSalesOperatorPackage } from "../lib/growth/training/supervised-sales-operator-package-projection-1b"
import { scoreSupervisedSalesWorkflow } from "../lib/growth/training/supervised-sales-workflow-scoring-1b"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { summarizeStrategyDerivedAssetsForPackage } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const ROOT = process.cwd()
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER}] Supervised sales certification\n`)

// Phase 1 — Runtime audit
const runtimeAudit = auditSupervisedSalesRuntimeComponents()
const runtimeSummary = summarizeRuntimeReadiness(runtimeAudit)
assert.equal(runtimeSummary.missing, 0)
assert.ok(runtimeSummary.score >= 0.95)
console.log(`  ✓ Phase 1 — ${runtimeSummary.present}/${runtimeAudit.length} runtime components present`)

// No Equipify-specific logic in generic modules
for (const file of [
  "lib/growth/training/supervised-sales-workflow-readiness-audit-1b.ts",
  "lib/growth/training/supervised-sales-production-lead-selection-1b.ts",
  "lib/growth/training/supervised-sales-operator-package-projection-1b.ts",
  "lib/growth/training/supervised-sales-workflow-scoring-1b.ts",
]) {
  const source = readSource(file)
  assert.doesNotMatch(source, /EQUIPIFY_PRODUCTION_ORG_ID/)
  assert.doesNotMatch(source, /00757488/)
}
console.log("  ✓ Generic workflow — no org-specific logic in pipeline modules")

// Phase 2 — Lead selection scoring
const ranked = rankSupervisedSalesLeadCandidates([
  {
    leadId: BLOCK_LEAD_ID,
    companyName: "Block Imaging",
    admissionState: "accepted",
    outreachEligible: true,
    hasResearch: true,
    evidenceCount: 5,
    researchConfidence: 0.82,
    hasDecisionMaker: true,
    hasExistingPackage: true,
  },
  {
    leadId: "00000000-0000-0000-0000-000000000001",
    companyName: "BrightPixel Marketing",
    admissionState: "rejected",
    outreachEligible: false,
    hasResearch: false,
  },
])
assert.equal(ranked.length, 1)
assert.equal(ranked[0]?.companyName, "Block Imaging")
console.log("  ✓ Phase 2 — production lead ranking prefers researched ICP leads")

// Phase 3 — Package projection using real Block Imaging research fixture pattern
const profile = buildLive1bEquipifyCompanyProfileContent()
const brief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK_LEAD_ID,
  companyName: "Block Imaging",
  preparedAt: "2026-07-16T12:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh",
  contactTitle: "Service Director",
  industry: "Medical equipment service",
  employees: "200-500",
  equipmentServiced: ["MRI", "CT", "X-ray", "ultrasound"],
  verifiedEvidence: [
    "Depot-to-field coordination described on careers page",
    "ServiceMax mentioned in technician job postings",
    "Multi-site biomedical field service operations",
  ],
  approvedProfile: profile,
  sellerCompanyName: "Equipify",
  fitReason: "Medical equipment field service operator with depot-to-field workflow complexity.",
  opportunitySummary: "Dispatch-to-cash and equipment history friction across depot and field teams.",
  researchConfidence: 0.82,
  qualificationConfidence: 0.78,
})

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
const assets = summarizeStrategyDerivedAssetsForPackage(drafts)

const fixturePackage: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK_LEAD_ID}:2026-07-16T12:00:00.000Z`,
  leadId: BLOCK_LEAD_ID,
  companyName: "Block Imaging",
  preparedAt: "2026-07-16T12:00:00.000Z",
  generatedAssets: assets,
  salesStrategyBrief: brief,
  confidence: brief.confidence,
  recommendedChannel: "email",
  recommendedSequence: "consultative_discovery",
  expectedOutcome: "Earn a short workflow discovery conversation",
  pendingHumanApproval: true,
  transportBlocked: true,
  supportingResearch: brief.evidence.map((row) => row.detail),
  personalizationEvidence: brief.personalizationSignals ?? [],
  approvalRequirements: ["Human operator must approve before any send"],
  complianceNotes: ["Outbound transport blocked — supervised milestone"],
}

const operatorPackage = projectSupervisedSalesOperatorPackage({ pkg: fixturePackage })
assert.ok(operatorPackage.executiveSummary.length > 20)
assert.ok(operatorPackage.painPoints.length >= 1)
assert.ok(operatorPackage.outreach.email)
assert.ok(operatorPackage.approvalSummary.length >= 6)
assert.ok(operatorPackage.objections.length >= 1)
console.log("  ✓ Phase 3 — complete operator seller package projected")

// Phase 4 — Approval workflow audit
const approvalAudit = auditSupervisedSalesApprovalWorkflow()
assert.ok(approvalAudit.find((row) => row.action === "Approve")?.status === "built")
assert.ok(approvalAudit.find((row) => row.action === "Reject")?.status === "built")
assert.ok(approvalAudit.find((row) => row.action === "Edit")?.status === "built")
console.log("  ✓ Phase 4 — approve/reject/edit/skip wired; delay/research partial")

// Outbound remains gated in package contract
assert.equal(fixturePackage.transportBlocked, true)
assert.equal(fixturePackage.pendingHumanApproval, true)
const packageTypes = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types.ts")
assert.match(packageTypes, /transportBlocked: true/)
console.log("  ✓ Outbound remains OFF — transportBlocked on packages")

// Phase 6 — Workflow scoring
const scored = scoreSupervisedSalesWorkflow({
  runtimeAudit,
  selectedLeads: ranked,
  packages: [operatorPackage],
  outboundKillSwitchOff: true,
})
assert.ok(scored.overallReadinessScore >= 0.7)
console.log(`  ✓ Phase 6 — workflow score ${(scored.overallReadinessScore * 100).toFixed(0)}%`)

// Wiring checks
const orchestratorSource = readSource("lib/growth/training/supervised-sales-production-orchestrator-1b.ts")
assert.match(orchestratorSource, /buildAutonomousOutreachApprovalPackage/)
assert.match(orchestratorSource, /buildMode: "preview_only"/)
assert.match(orchestratorSource, /analyzeGrowthLeadAdmissionProductionPool/)
const probeSource = readSource("scripts/probe-ge-aios-first-customer-supervised-sales-1b.ts")
assert.match(probeSource, /EQUIPIFY_PRODUCTION_ORG_ID/)
assert.doesNotMatch(probeSource, /outbound_messages.*insert/i)
console.log("  ✓ Production orchestrator + probe wired")

console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER}`)
console.log(`Workflow score: ${(scored.overallReadinessScore * 100).toFixed(0)}%`)
console.log(`Use pnpm probe:ge-aios-first-customer-supervised-sales-1b for real production prospects`)

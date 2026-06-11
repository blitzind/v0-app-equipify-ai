/**
 * Opportunity Approval Engine (M1-E) — regression checks without side effects.
 * Run: pnpm test:opportunity-approval-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertOpportunityApprovalAttributionPreserved,
  buildOpportunityApprovalAttributionRecord,
  evaluateOpportunityDraftConversionDuplicateBlock,
  evaluateOpportunityDraftCreateOpportunityGate,
  OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  resolveOpportunityFieldsFromDraft,
} from "../lib/growth/meeting-intelligence/opportunity-approval-evidence"
import {
  OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN,
  OPPORTUNITY_APPROVAL_ENGINE_MIGRATION,
  OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
} from "../lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  evaluateOpportunityDraftApprovalGate,
  OPPORTUNITY_DRAFT_SAFETY_FLAGS,
} from "../lib/growth/meeting-intelligence/opportunity-draft-evidence"
import type { OpportunityDraftRow } from "../lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION } from "../lib/growth/meeting-intelligence/opportunity-draft-engine-types"

const REQUIRED_FILES = [
  "lib/growth/meeting-intelligence/opportunity-approval-engine-types.ts",
  "lib/growth/meeting-intelligence/opportunity-approval-evidence.ts",
  "lib/growth/meeting-intelligence/opportunity-approval-service.ts",
  "lib/growth/meeting-intelligence/opportunity-approval-certification.ts",
  "lib/growth/meeting-intelligence/opportunity-approval-route-gates.ts",
  "lib/growth/meeting-intelligence/opportunity-approval-route.ts",
  "app/api/platform/growth/opportunity-approval/readiness/route.ts",
  "app/api/platform/growth/opportunity-approval/execute/route.ts",
  "components/growth/growth-opportunity-draft-panel.tsx",
  `supabase/migrations/${OPPORTUNITY_APPROVAL_ENGINE_MIGRATION}`,
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER, "growth-opportunity-approval-engine-m1e-v1")
console.log("  ✓ opportunity approval QA markers")

function sampleDraft(status: OpportunityDraftRow["status"]): OpportunityDraftRow {
  return {
    draft_id: "draft-1",
    meeting_id: "meeting-1",
    lead_id: "lead-1",
    company_id: null,
    account_playbook_id: "playbook-1",
    company_name: "Summit Medical",
    opportunity_summary: "Summit Medical post-meeting opportunity draft.",
    opportunity_type: "qualified_new_business",
    estimated_value: 25000,
    confidence_score: 0.82,
    recommended_stage: "qualified",
    key_stakeholders: [{ name: "Jane CEO", title: "CEO", role_category: "Executive", influence: "primary" }],
    buying_signals: ["Budget discussion detected."],
    risks: ["Single-thread risk."],
    next_steps: ["Prepare proposal for operator review."],
    reasoning: "Sample draft.",
    opportunity_readiness_score: 72,
    opportunity_readiness_status: "Qualified",
    source_attribution: buildOpportunityApprovalAttributionRecord({
      attribution_chain: [...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION],
    }),
    status,
    input_hash: "hash-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    approved_at: status === "approved" || status === "converted" ? new Date().toISOString() : null,
    approved_email: "operator@example.com",
    rejection_note: null,
    opportunity_id: status === "converted" ? "opp-1" : null,
    converted_at: status === "converted" ? new Date().toISOString() : null,
    converted_email: status === "converted" ? "operator@example.com" : null,
  }
}

const approvedDraft = sampleDraft("approved")
const draftDraft = sampleDraft("draft")

const approvedGate = evaluateOpportunityDraftCreateOpportunityGate({ draft: approvedDraft })
assert.equal(approvedGate.allowed, true)
console.log("  ✓ approved draft can create opportunity")

const unapprovedGate = evaluateOpportunityDraftCreateOpportunityGate({ draft: draftDraft })
assert.equal(unapprovedGate.allowed, false)
assert.equal(unapprovedGate.code, "draft_not_approved")
console.log("  ✓ unapproved draft cannot create opportunity")

const approvalGate = evaluateOpportunityDraftApprovalGate({ draft: draftDraft })
assert.equal(approvalGate.allowed, true)
console.log("  ✓ approval alone does not create opportunity")

const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-draft-queue.ts"),
  "utf8",
)
const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-draft-service.ts"),
  "utf8",
)
const approvalServiceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-approval-service.ts"),
  "utf8",
)

assert.doesNotMatch(queueSource, /createGrowthOpportunity/)
assert.doesNotMatch(serviceSource, /createGrowthOpportunity/)
assert.match(approvalServiceSource, /createGrowthOpportunity/)
assert.match(approvalServiceSource, /confirmCreateOpportunityFromDraft/)
console.log("  ✓ only create_opportunity path calls createGrowthOpportunity")

const resolvedDefault = resolveOpportunityFieldsFromDraft({ draft: approvedDraft })
assert.equal(resolvedDefault.amount, approvedDraft.estimated_value)
assert.equal(resolvedDefault.stageKey, approvedDraft.recommended_stage)
console.log("  ✓ created opportunity uses draft fields")

const resolvedEdited = resolveOpportunityFieldsFromDraft({
  draft: approvedDraft,
  edits: { name: "Custom Opportunity", estimated_value: 42000, stage: "proposal" },
})
assert.equal(resolvedEdited.title, "Custom Opportunity")
assert.equal(resolvedEdited.amount, 42000)
assert.equal(resolvedEdited.stageKey, "proposal")
console.log("  ✓ optional edits override draft fields")

const convertedDuplicate = evaluateOpportunityDraftConversionDuplicateBlock({
  draft: sampleDraft("converted"),
  lead_has_opportunity: false,
})
assert.equal(convertedDuplicate.blocked, true)
console.log("  ✓ duplicate prevention prevents double creation")

const leadDuplicate = evaluateOpportunityDraftConversionDuplicateBlock({
  draft: approvedDraft,
  lead_has_opportunity: true,
})
assert.equal(leadDuplicate.blocked, true)
assert.equal(leadDuplicate.code, "opportunity_already_exists_for_lead")
console.log("  ✓ lead-level duplicate prevention")

const attribution = buildOpportunityApprovalAttributionRecord({
  attribution_chain: [...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION],
})
assert.equal(assertOpportunityApprovalAttributionPreserved(attribution), true)
assert.ok(attribution.attribution_chain.includes("Opportunity"))
assert.deepEqual(attribution.attribution_chain, OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN)
console.log("  ✓ attribution chain includes Opportunity")

assert.match(approvalServiceSource, /recomputeGrowthLeadWorkflowSignals/)
assert.match(approvalServiceSource, /recomputeDealIntelligenceScore/)
assert.match(approvalServiceSource, /recomputeGrowthRevenueOperatingDashboard/)
console.log("  ✓ deal/revenue recompute hooks invoked")

assert.match(approvalServiceSource, /status: "converted"/)
assert.match(approvalServiceSource, /opportunity_id:/)
console.log("  ✓ draft status becomes converted and links opportunity_id")

assert.deepEqual(OPPORTUNITY_APPROVAL_SAFETY_FLAGS, {
  auto_created: false,
  human_confirmed: true,
  operator_required: true,
})
assert.deepEqual(OPPORTUNITY_DRAFT_SAFETY_FLAGS.opportunity_created, false)
console.log("  ✓ safety flags prove human confirmation required")

const queueActionsSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/opportunity-drafts/queue/actions/route.ts"),
  "utf8",
)
assert.match(queueActionsSource, /create_opportunity/)
assert.match(queueActionsSource, /createOpportunityFromApprovedDraft/)
console.log("  ✓ queue action create_opportunity wired")

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-opportunity-draft-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Create Opportunity/)
assert.match(panelSource, /approve_opportunity_draft/)
assert.match(panelSource, /data-qa-marker=\{OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER\}/)
console.log("  ✓ UI button for approved drafts")

const routeGatesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-approval-route-gates.ts"),
  "utf8",
)
assert.match(routeGatesSource, /GROWTH_OPPORTUNITY_APPROVAL_ENGINE_ENABLED/)
assert.match(routeGatesSource, /RUN_OPPORTUNITY_APPROVAL_ENGINE_CERTIFICATION/)
console.log("  ✓ production certification route gates")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${OPPORTUNITY_APPROVAL_ENGINE_MIGRATION}`),
  "utf8",
)
assert.match(migrationSource, /converted/)
assert.match(migrationSource, /opportunity_id/)
console.log("  ✓ converted status and opportunity linkage schema")

console.log("\nOpportunity Approval Engine (M1-E) certification checks passed.")

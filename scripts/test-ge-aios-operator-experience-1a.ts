/**
 * GE-AIOS-OPERATOR-EXPERIENCE-1A — Canonical operator workspace certification.
 * Run: pnpm test:ge-aios-operator-experience-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { projectGrowthCanonicalOperatorDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
  buildCanonicalOperatorWaitingSummary,
  projectCanonicalLeadOpportunityNarrative,
  resolveCanonicalApprovalQueueCount,
  resolveCanonicalOutreachDraftCount,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import {
  humanizeOperatorDecisionTitle,
  humanizeOperatorFacingLine,
  stripInternalEngineTerms,
} from "../lib/growth/aios/operator-experience/growth-operator-language-1a"
import { buildAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { buildGrowthReviewPackageHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"
import { formatOperatorPriorityRecommendedNextStep } from "../lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function outreachHacItem(overrides?: Partial<GrowthHumanApprovalItem>): GrowthHumanApprovalItem {
  return {
    id: "hac-outreach-block-imaging",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    source: "outreach_package",
    actionType: "approve_outreach_package",
    status: "needs_review",
    title: "Outreach package — Block Imaging",
    summary: "Email sequence prepared for Block Imaging",
    subjectType: "lead",
    subjectId: BLOCK_LEAD,
    channel: "email",
    riskLevel: "medium",
    priorityScore: 92,
    createdAt: "2026-07-14T10:00:00.000Z",
    route: `/growth/os/pilot/lead-research/${BLOCK_LEAD}?packageId=pkg-block-imaging-001`,
    evidence: [
      { source: "outreach_preparation_pilot", label: "Assets", value: 2 },
      { source: "outreach_preparation_pilot", label: "Recommended channel", value: "email" },
    ],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "autonomous_outreach_preparation_pilot",
      blockedReason: "Transport blocked — draft only until human approval.",
    },
    ...overrides,
  }
}

function blockImagingPackage(): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: "pkg-block-imaging-001",
    leadId: BLOCK_LEAD,
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    preparedAt: "2026-07-14T10:00:00.000Z",
    pendingHumanApproval: true,
    packageApprovalDecision: null,
    generatedAssets: [
      { channel: "email", label: "Intro email", prepared: true },
      { channel: "email", label: "Follow-up email", prepared: true },
    ],
    approvalRequirements: ["Operator review before send"],
    salesStrategyBrief: null,
    expectedOutcome: "Book first meeting",
  } as GrowthAutonomousOutreachApprovalPackage
}

function decisionInput(): GrowthCanonicalDecisionInput {
  return {
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    leadId: BLOCK_LEAD,
    generatedAt: "2026-07-14T10:00:00.000Z",
    companyName: "Block Imaging",
    contactName: "Josh",
    memoryBundle: null,
    relationshipAssessment: null,
    revenueStrategy: "proceed",
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee: null,
    replyState: null,
    postCall: null,
    meeting: null,
    packageState: { packageId: "pkg-block-imaging-001", status: "pending_approval", purpose: "Intro sequence" },
    draftFactoryStatus: null,
    approvalState: { pendingOperatorReview: true, pendingPackageApproval: true, label: "Awaiting review" },
    sourceVersions: {
      memoryVersion: "none",
      relationshipVersion: null,
      revenueVersion: "proceed",
      packageVersion: "pkg-block-imaging-001",
      meetingVersion: null,
      approvalVersion: "pending",
      materialEventId: null,
    },
  }
}

console.log(`[GE-AIOS-OPERATOR-EXPERIENCE-1A] ${GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER}`)

assert.match(
  humanizeOperatorFacingLine("I concluded: Qualification: research."),
  /Research this account before outreach/,
)
assert.equal(
  humanizeOperatorDecisionTitle("Sequence type: revalidation", "research"),
  "Contact verification still required",
)
assert.ok(!stripInternalEngineTerms("Canonical decision fingerprint materialization").includes("fingerprint"))
console.log("  ✓ operator language removes engine terminology")

const pkg = blockImagingPackage()
const snapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [outreachHacItem()],
  packagesById: new Map([[pkg.packageId, pkg]]),
})
assert.equal(snapshot.outreachPackageCount, 1)
assert.equal(snapshot.outreachDraftCount, 2)
assert.equal(snapshot.topPackage?.companyName, "Block Imaging")
assert.equal(snapshot.topPackage?.reviewHref, buildGrowthReviewPackageHref(pkg.packageId))
console.log("  ✓ canonical approval snapshot counts packages and drafts consistently")

const decision = buildGrowthCanonicalNextBestDecision(decisionInput())
const projection = projectGrowthCanonicalOperatorDecision({ decision })
const narrative = projectCanonicalLeadOpportunityNarrative({
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  decision: projection,
  approvalSnapshot: snapshot,
  hacItem: outreachHacItem(),
})
assert.equal(narrative.packageCount, 1)
assert.equal(narrative.draftCount, 2)
assert.equal(narrative.approvalRequired, true)
assert.equal(narrative.currentFocus, "Review opportunity package for Block Imaging")
assert.equal(narrative.blockedBy, "Ready for review")
console.log("  ✓ lead opportunity narrative matches approval + decision state")

const task = buildCanonicalOperatorTask({
  approvalSnapshot: snapshot,
  decision: projection,
  teammateName: "Ava",
})
assert.ok(task)
assert.match(task!.title, /Block Imaging/)
assert.equal(task!.draftCount, 2)
assert.equal(task!.packageCount, 1)
assert.equal(task!.href, buildGrowthReviewPackageHref(pkg.packageId))
assert.equal(task!.whatHappensNext, formatOperatorPriorityRecommendedNextStep())
console.log("  ✓ canonical operator task collapses duplicate home priorities")

const waitingSummary = buildCanonicalOperatorWaitingSummary({ approvalSnapshot: snapshot })
assert.match(waitingSummary, /1 opportunity package ready for your review/)
assert.match(waitingSummary, /Once you've reviewed them/)
console.log("  ✓ waiting summary uses one canonical draft count")

const dashboard = buildGrowthHomeExecutiveBriefingCertDashboard()
const aiOsUx = buildAiOsUxViewModel({
  dashboard,
  executiveBrief: {
    greeting: "Good morning",
    todaysPriority: "Review outreach",
    primaryCta: { label: "Review", href: "/growth/os/approvals" },
    secondaryCta: { label: "Queue", href: "/growth/leads" },
    biggestWin: null,
    biggestRisk: null,
    completedOutcomes: [],
  },
  waitingOnYou: [
    { id: "legacy-1", label: "Legacy waiting item", detail: "Should collapse", href: "/growth/campaigns/sequences", priority: "high" },
    { id: "legacy-2", label: "Another legacy item", detail: null, href: "/growth/campaigns/sequences", priority: "medium" },
  ],
  waitingOnYouOverflow: 1,
  needsReview: { totalCount: 8, reviewHref: "/growth/campaigns/sequences", items: [] },
  canonicalApprovalSnapshot: snapshot,
  canonicalOperatorTask: task,
})
assert.equal(aiOsUx.approveItemsCount, resolveCanonicalApprovalQueueCount(snapshot, 8))
assert.equal(aiOsUx.waitingOnYou.length, 1)
assert.equal(aiOsUx.waitingOnYou[0]?.label, task!.title)
assert.equal(aiOsUx.canonicalOperatorTask?.packageCount, 1)
console.log("  ✓ home ai-os ux collapses waiting sections to one canonical task")

assert.equal(resolveCanonicalOutreachDraftCount(snapshot, 99), 2)
console.log("  ✓ draft count resolver prefers canonical snapshot")

const homeSource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
assert.ok(homeSource.includes("loadCanonicalOperatorApprovalSnapshot"))
assert.ok(homeSource.includes("canonicalOperatorApproval"))
const leadSource = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
assert.ok(leadSource.includes("operator_opportunity_narrative"))
assert.ok(leadSource.includes("projectCanonicalLeadOpportunityNarrative"))
const completedWorkSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx")
assert.ok(completedWorkSource.includes("buildCanonicalOperatorApprovalSnapshot"))
const decisionCardSource = readSource("components/growth/growth-canonical-decision-card.tsx")
assert.ok(!decisionCardSource.includes("Send Plane blocked"))
assert.ok(decisionCardSource.includes("Ready for review"))
console.log("  ✓ wiring present across Home, Lead Workspace, Completed Work, decision card")

console.log(`\n[GE-AIOS-OPERATOR-EXPERIENCE-1A] PASS ${GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER}`)

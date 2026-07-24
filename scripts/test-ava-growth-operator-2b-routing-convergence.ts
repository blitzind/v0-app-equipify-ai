/**
 * AVA-GROWTH-OPERATOR-2B — Executive approval routing convergence certification.
 * Run: pnpm test:ava-growth-operator-2b-routing-convergence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { collectOutreachPackageApprovalItems } from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import { buildCanonicalMission } from "../lib/growth/aios/missions/growth-canonical-mission-1a"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
  resolveCanonicalWaitingOnYouItems,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildCanonicalOperatorFocus } from "../lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "../lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  AVA_GROWTH_OPERATOR_2B_ROUTING_CONVERGENCE_QA_MARKER,
} from "../lib/growth/workspace/ux-2b/review/growth-executive-approval-routing-2b"
import {
  buildCustomerPackageReviewHref,
  buildGrowthReviewHref,
  buildGrowthReviewPackageHref,
  GROWTH_REVIEW_PAGE_HREF,
  remapLegacyHrefToGrowthReview,
  resolveOperatorPackageReviewHref,
} from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const ROOT = process.cwd()
const PACKAGE_ID = "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-19T17:23:44.080Z"
const LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const EXECUTIVE_PACKAGE_HREF = buildGrowthReviewPackageHref(PACKAGE_ID)
const REVIEW_QUEUE_HREF = buildGrowthReviewHref({ tab: "packages" })
const CRM_VIEW_LEAD_HREF = buildCustomerPackageReviewHref(LEAD_ID)

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function mockApprovalPackage() {
  return {
    packageId: PACKAGE_ID,
    leadId: LEAD_ID,
    companyName: "Block Imaging",
    preparedAt: new Date().toISOString(),
    generatedAssets: [{ channel: "email", label: "Email", preview: "Hello", draftOnly: true }],
    pendingHumanApproval: true,
    expectedOutcome: "Open a workflow conversation",
    recommendedChannel: "email",
    confidence: 0.74,
  }
}

function mockHacItems() {
  return collectOutreachPackageApprovalItems({
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    generatedAt: new Date().toISOString(),
    approvalWorkOrders: [],
    executionPlanReviewQueue: [],
    needsAttention: [],
    metaRecommendations: [],
    priorityBindings: [],
    revenueOperatorOrchestrations: [],
    geV15Inbox: [],
    automationApprovals: [],
    sequenceJobs: [],
    aiVoiceSessions: [],
    humanExecutionApprovals: [],
    outreachPreparationRuns: [
      {
        runId: "run-1",
        leadId: LEAD_ID,
        companyName: "Block Imaging",
        wakeCondition: "execution_completed",
        outcome: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1000,
        packageId: PACKAGE_ID,
        workflowType: "outreach_generation",
        confidence: 0.74,
        skipReason: null,
        blockReason: null,
        revenueOperatorHandoff: null,
        approvalPackage: mockApprovalPackage(),
      },
    ],
    meetingPreparationRuns: [],
  })
}

console.log(`[${AVA_GROWTH_OPERATOR_2B_ROUTING_CONVERGENCE_QA_MARKER}] Executive approval routing convergence`)

// R2 — package-first resolver
assert.equal(
  resolveOperatorPackageReviewHref({ leadId: LEAD_ID, packageId: PACKAGE_ID }),
  EXECUTIVE_PACKAGE_HREF,
)
assert.equal(resolveOperatorPackageReviewHref(null), REVIEW_QUEUE_HREF)
assert.doesNotMatch(EXECUTIVE_PACKAGE_HREF, /\/leads\/crm/)
console.log("  ✓ resolveOperatorPackageReviewHref targets executive package (not CRM)")

// Legacy remap converges to review queue
assert.equal(
  remapLegacyHrefToGrowthReview(`/growth/os/approvals?packageId=${encodeURIComponent(PACKAGE_ID)}`),
  EXECUTIVE_PACKAGE_HREF,
)
assert.equal(remapLegacyHrefToGrowthReview(CRM_VIEW_LEAD_HREF), REVIEW_QUEUE_HREF)
assert.equal(remapLegacyHrefToGrowthReview(`/admin/growth/leads/${LEAD_ID}`), REVIEW_QUEUE_HREF)
console.log("  ✓ legacy approval hrefs remap to executive review queue")

// R3 — View Lead remains CRM-only
assert.equal(CRM_VIEW_LEAD_HREF, `/growth/leads/crm?open=${LEAD_ID}`)
const packageCard = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
assert.match(packageCard, /View lead/)
assert.match(packageCard, /view\.links\.leadHref/)
console.log("  ✓ View Lead retains CRM drawer entry")

// HAC → Executive Package
const hacItems = mockHacItems()
assert.equal(hacItems[0]?.route, EXECUTIVE_PACKAGE_HREF)
console.log("  ✓ HAC review opens Executive Package")

// Canonical snapshot / task / waiting-on-you
const snapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems,
  packagesById: new Map([[PACKAGE_ID, mockApprovalPackage()]]),
})
assert.equal(snapshot.topPackage?.reviewHref, EXECUTIVE_PACKAGE_HREF)

const task = buildCanonicalOperatorTask({ approvalSnapshot: snapshot })
assert.equal(task?.href, EXECUTIVE_PACKAGE_HREF)
console.log("  ✓ Waiting On You / Recommendation canonical task opens Executive Package")

const waiting = resolveCanonicalWaitingOnYouItems({
  approvalSnapshot: snapshot,
  legacyItems: [],
})
assert.equal(waiting[0]?.href, EXECUTIVE_PACKAGE_HREF)
console.log("  ✓ Waiting On You item review opens Executive Package")

// Operator focus
const focus = buildCanonicalOperatorFocus({ approvalSnapshot: snapshot })
assert.equal(focus?.href, EXECUTIVE_PACKAGE_HREF)
console.log("  ✓ Operator focus approval href opens Executive Package")

// R4 — Mission with pending approval opens executive package
const mission = buildCanonicalMission({
  organizationId: "org-1",
  leadId: LEAD_ID,
  companyName: "Block Imaging",
  approvalSnapshot: snapshot,
  hacItems,
  packagePreview: snapshot.topPackage,
})
assert.equal(mission.workspaceHref, EXECUTIVE_PACKAGE_HREF)
assert.equal(mission.approvalsHref, EXECUTIVE_PACKAGE_HREF)
console.log("  ✓ Mission Open Mission opens Executive Package when approval pending")

// Runtime Trust → review queue
assert.equal(GROWTH_HOME_STARTUP_STEP_PATHS.approvals, REVIEW_QUEUE_HREF)
console.log("  ✓ Runtime Trust review path targets executive review queue")

// Home Review Package uses topPackage.reviewHref from canonical snapshot
assert.equal(snapshot.topPackage?.reviewHref, EXECUTIVE_PACKAGE_HREF)
const homeSynthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts")
assert.match(homeSynthesizer, /topPackage\?\.reviewHref/)
console.log("  ✓ Home Review Package opens Executive Package")

// Source wiring — no approval path should prefer CRM drawer
const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
assert.match(hero, /remapLegacyHrefToGrowthReview/)
assert.doesNotMatch(hero, /resolveCustomerPackageReviewHref/)
const reviewLayout = readSource("components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout.tsx")
assert.match(reviewLayout, /projectExecutiveApprovalPackage1D/)
const reviewDrawer = readSource("components/growth/workspace/ux-1a/review/growth-review-package-drawer.tsx")
assert.match(reviewDrawer, /GrowthAvaCompletedOutreachPackageCard/)
const leadDrawer = readSource("components/growth/growth-lead-drawer.tsx")
assert.doesNotMatch(leadDrawer, /GrowthAvaCompletedOutreachPackageCard/)
assert.doesNotMatch(leadDrawer, /GrowthAvaPackageProgressiveReviewLayout/)
console.log("  ✓ CRM drawer is not the executive approval surface")

assert.match(readSource("lib/growth/workspace/ux-1a/review/growth-review-routes.ts"), /growth-executive-approval-routing-2b/)
console.log("  ✓ QA marker exported from review routes")

// Regression suites
console.log(`[${AVA_GROWTH_OPERATOR_2B_ROUTING_CONVERGENCE_QA_MARKER}] prior milestone regression...`)
execSync("pnpm test:ava-growth-operator-2a-executive-experience", { stdio: "inherit", cwd: ROOT })
execSync("pnpm test:ava-growth-operator-1f-platform-consolidation", { stdio: "inherit", cwd: ROOT })

console.log(`[${AVA_GROWTH_OPERATOR_2B_ROUTING_CONVERGENCE_QA_MARKER}] PASS`)

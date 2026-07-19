/**
 * GE-AIOS-OPERATOR-UX-1A — Canonical package review entry path certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { collectOutreachPackageApprovalItems } from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildGrowthReviewHref,
  buildGrowthReviewPackageHref,
  remapLegacyHrefToGrowthReview,
  resolveOperatorPackageReviewHref,
} from "../lib/growth/workspace/ux-1a/review/growth-review-routes"
import {
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS,
  GROWTH_OPERATOR_PACKAGE_REVIEW_ENTRY_1A_QA_MARKER,
} from "../lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"

const ROOT = process.cwd()
const PACKAGE_ID = "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-19T17:23:44.080Z"
const LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_OPERATOR_PACKAGE_REVIEW_ENTRY_1A_QA_MARKER}] Operator package review entry tests`)

const canonicalHref = buildGrowthReviewPackageHref(PACKAGE_ID)
assert.equal(resolveOperatorPackageReviewHref(PACKAGE_ID), canonicalHref)
assert.equal(resolveOperatorPackageReviewHref(null), buildGrowthReviewHref({ tab: "packages" }))
console.log("  ✓ resolveOperatorPackageReviewHref builds canonical review drawer URL")

const pilotLegacy = `/growth/os/pilot/lead-research/${LEAD_ID}?packageId=${encodeURIComponent(PACKAGE_ID)}`
assert.equal(remapLegacyHrefToGrowthReview(pilotLegacy), canonicalHref)
assert.equal(
  remapLegacyHrefToGrowthReview(`/growth/os/approvals?packageId=${encodeURIComponent(PACKAGE_ID)}`),
  canonicalHref,
)
assert.equal(remapLegacyHrefToGrowthReview("/growth/os/approvals"), buildGrowthReviewHref({ tab: "packages" }))
console.log("  ✓ legacy pilot and approvals hrefs remap to Review package drawer")

const hacItems = collectOutreachPackageApprovalItems({
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
      approvalPackage: {
        packageId: PACKAGE_ID,
        leadId: LEAD_ID,
        companyName: "Block Imaging",
        preparedAt: new Date().toISOString(),
        generatedAssets: [{ channel: "email", label: "Email", preview: "Hello", draftOnly: true }],
        pendingHumanApproval: true,
        expectedOutcome: "Open a workflow conversation",
        recommendedChannel: "email",
        confidence: 0.74,
      },
    },
  ],
  meetingPreparationRuns: [],
})
assert.equal(hacItems[0]?.route, canonicalHref)
assert.doesNotMatch(hacItems[0]?.route ?? "", /pilot\/lead-research/)
console.log("  ✓ HAC outreach package items route to canonical Review URL")

const snapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems,
  packagesById: new Map([
    [
      PACKAGE_ID,
      {
        packageId: PACKAGE_ID,
        leadId: LEAD_ID,
        companyName: "Block Imaging",
        preparedAt: new Date().toISOString(),
        generatedAssets: [{ channel: "email", label: "Email", preview: "Hello", draftOnly: true }],
        pendingHumanApproval: true,
        expectedOutcome: "Open a workflow conversation",
        recommendedChannel: "email",
        confidence: 0.74,
      },
    ],
  ]),
})
const task = buildCanonicalOperatorTask({ approvalSnapshot: snapshot })
assert.equal(task?.href, canonicalHref)
assert.equal(task?.whatHappensNext, GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PROMISE_TASK)
assert.doesNotMatch(task?.whatHappensNext ?? "", /send the sequence/i)
console.log("  ✓ canonical operator task uses Review href and accurate authorize promise")

const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
assert.match(hero, /remapLegacyHrefToGrowthReview/)
const hacEngine = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.match(hacEngine, /buildGrowthReviewPackageHref\(pkg\.packageId\)/)
assert.doesNotMatch(hacEngine, /route: `\/growth\/os\/pilot\/lead-research\/\$\{pkg\.leadId\}\?packageId=/)
const approvalsPage = readSource("app/(growth)/growth/os/approvals/page.tsx")
assert.match(approvalsPage, /remapLegacyHrefToGrowthReview/)
const packageCard = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
assert.match(packageCard, /GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS/)
assert.match(packageCard, /GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS/)
assert.match(packageCard, /Authorize/)
assert.doesNotMatch(packageCard, /Approving this package does not send/)
console.log("  ✓ source wiring points Home/HAC/legacy approvals to canonical Review card")

const workspace = readSource("components/growth/ai-os/growth-ava-operator-approval-workspace.tsx")
assert.match(workspace, /Authorize/)
assert.doesNotMatch(workspace, /Approve Package/)
assert.match(workspace, /GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS/)
console.log("  ✓ diagnostics workspace uses Authorize terminology without send promise")

console.log("\nAll operator package review entry tests passed.")

/**
 * GE-AIOS-HOTFIX — Canonical package authority (Home ↔ Review convergence).
 * Run: pnpm test:ge-aios-hotfix-canonical-package-authority
 */
import assert from "node:assert/strict"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  parsePackageIdFromApprovalRoute,
  projectAvaCompletedWork,
} from "../lib/growth/aios/approvals/ava-completed-work-projection"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
  resolveCanonicalApprovalQueueCount,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildPrimaryDecisionFromWorkManager } from "../lib/growth/work-manager/home/build-primary-decision-work"
import { buildAvaPrimaryDecision } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { buildAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import {
  projectReviewPackageDecisionItems,
  synthesizeGrowthReviewDecisionQueue,
} from "../lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"
import { buildGrowthReviewPackageHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

function outreachItem(input: {
  id: string
  company: string
  leadId: string
  packageId: string
  route: string
}): GrowthHumanApprovalItem {
  return {
    id: input.id,
    organizationId: "org-1",
    source: "outreach_package",
    actionType: "approve_outreach_package",
    status: "needs_review",
    title: `Outreach package — ${input.company}`,
    summary: "Prepared for review",
    subjectType: "lead",
    subjectId: input.leadId,
    channel: "email",
    riskLevel: "medium",
    priorityScore: 90,
    createdAt: "2026-07-19T12:00:00.000Z",
    route: input.route,
    evidence: [{ source: "outreach_preparation_pilot", label: "Assets", value: 2 }],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "autonomous_outreach_preparation_pilot",
      blockedReason: null,
    },
  }
}

console.log("[ge-aios-hotfix-canonical-package-authority-v1] certification")

const canonicalRoute = buildGrowthReviewPackageHref("pkg-block-imaging")
assert.equal(parsePackageIdFromApprovalRoute(canonicalRoute), "pkg-block-imaging")
console.log("  ✓ Fix A — ?item= routes parse for Review projection")

assert.equal(
  parsePackageIdFromApprovalRoute(
    "/growth/os/pilot/lead-research/lead-1?packageId=outreach-prep%3Alead-1%3A2026-07-12",
  ),
  "outreach-prep:lead-1:2026-07-12",
)
console.log("  ✓ Fix A — legacy ?packageId= routes still parse")

const block = outreachItem({
  id: "hac-block",
  company: "Block Imaging",
  leadId: "lead-block",
  packageId: "pkg-block-imaging",
  route: buildGrowthReviewPackageHref("pkg-block-imaging"),
})
const blitz = outreachItem({
  id: "hac-blitz",
  company: "Blitz Industries",
  leadId: "lead-blitz",
  packageId: "pkg-blitz-industries",
  route: buildGrowthReviewPackageHref("pkg-blitz-industries"),
})
const followUp = outreachItem({
  id: "hac-follow-up",
  company: "Calibration notice",
  leadId: "lead-cal",
  packageId: "ignored",
  route: "/growth/review?tab=packages&item=ignored",
})
followUp.source = "meta_recommender"
followUp.actionType = "review_recommendation"

const snapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [block, blitz, followUp],
})
assert.equal(snapshot.outreachPackageCount, 2)
assert.equal(snapshot.pendingApprovalCount, 2)
assert.notEqual(snapshot.pendingApprovalCount, 3)
console.log("  ✓ Fix B — package-facing pendingApprovalCount uses outreach packages only")

const projected = projectAvaCompletedWork({ items: [block, blitz] }).items
const reviewQueue = synthesizeGrowthReviewDecisionQueue({
  packageItems: projected,
  sendJobs: [],
})
const homePending = resolveCanonicalApprovalQueueCount(snapshot, 0)
assert.equal(homePending, reviewQueue.packageCount)
assert.equal(reviewQueue.packageCount, 2)
assert.equal(reviewQueue.totalActionable, 2)
console.log("  ✓ Home package count matches Review package count on canonical HAC data")

const task = buildCanonicalOperatorTask({ approvalSnapshot: snapshot })
assert.ok(task)
const aiOsUxWithPackages = buildAiOsUxViewModel({
  dashboard: buildGrowthHomeExecutiveBriefingCertDashboard(),
  executiveBrief: {
    greeting: "Good morning",
    todaysPriority: "Review outreach",
    primaryCta: { label: "Review", href: "/growth/review?tab=packages" },
    secondaryCta: { label: "Queue", href: "/growth/leads" },
    biggestWin: null,
    biggestRisk: null,
    completedOutcomes: [],
  },
  waitingOnYou: [],
  waitingOnYouOverflow: 0,
  needsReview: { totalCount: 0, reviewHref: "/growth/review?tab=packages", items: [] },
  canonicalApprovalSnapshot: snapshot,
  canonicalOperatorTask: task,
})
const heroDecision = buildAvaPrimaryDecision(aiOsUxWithPackages)
assert.equal(aiOsUxWithPackages.approveItemsCount, 2)
assert.equal(aiOsUxWithPackages.waitingOnYouOverflow, 1)
assert.equal(heroDecision.additionalDecisionCount, 1)
assert.ok(heroDecision.primaryDecision)
console.log("  ✓ Ready For Review card shows top package plus N additional packages")

const workManagerFallback = buildPrimaryDecisionFromWorkManager(
  {
    qaMarker: "ge-aios-11a-work-manager-v1",
    operator_queue: [],
    active_work: null,
    work_plan: [],
    all_work_items: [],
    completed_today: [],
    specialist_orchestrator_result: null,
  },
  aiOsUxWithPackages,
)
assert.equal(workManagerFallback.additionalDecisionCount, 0)
console.log("  ✓ Work Manager fallback remains unchanged when operator queue is empty")

const dashboard = buildGrowthHomeExecutiveBriefingCertDashboard()
dashboard.dailyRevenueWorkQueueEnabled = true
dashboard.dailyRevenueWorkQueueDisplay = {
  blocked_count: 2,
  waiting_count: 2,
  top_items: [
    {
      lead_id: "lead-block",
      company_name: "Block Imaging",
      action_label: "Review package",
      channel_label: "Email",
      reasoning: "Waiting",
      priority: "high",
      confidence: 90,
      estimated_minutes: 5,
      requires_human_approval: true,
    },
    {
      lead_id: "lead-blitz",
      company_name: "Blitz Industries",
      action_label: "Review package",
      channel_label: "Email",
      reasoning: "Waiting",
      priority: "high",
      confidence: 88,
      estimated_minutes: 5,
      requires_human_approval: true,
    },
  ],
} as never
dashboard.dailyRevenueWorkQueue = {
  blocked: [{ leadId: "lead-block", taskKey: "t1", reasoning: ["blocked"] }],
  waiting: [{ leadId: "lead-blitz", taskKey: "t2", reasoning: ["waiting"] }],
  critical: [],
  high: [],
  medium: [],
  low: [],
} as never

const withoutCanonical = buildAiOsUxViewModel({
  dashboard,
  executiveBrief: {
    greeting: "Good morning",
    todaysPriority: "Review",
    primaryCta: { label: "Review", href: "/growth/review" },
    secondaryCta: { label: "Queue", href: "/growth/leads" },
    biggestWin: null,
    biggestRisk: null,
    completedOutcomes: [],
  },
  waitingOnYou: [],
  waitingOnYouOverflow: 0,
  needsReview: { totalCount: 99, reviewHref: "/growth/review", items: [] },
  canonicalApprovalSnapshot: null,
})
assert.equal(withoutCanonical.approveItemsCount, 0)
console.log("  ✓ Fix C — missing canonical snapshot does not inflate package counts from daily queue")

const reviewRows = projectReviewPackageDecisionItems(projected)
assert.equal(reviewRows.length, 2)
assert.equal(reviewRows[0]?.companyName, "Block Imaging")
console.log("  ✓ Review package rows materialize from canonical HAC item= routes")

console.log("\nPASS ge-aios-hotfix-canonical-package-authority-v1")

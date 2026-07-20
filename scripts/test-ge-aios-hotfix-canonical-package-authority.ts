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
  emptyCanonicalOperatorApprovalSnapshot,
  resolveCanonicalApprovalQueueCount,
  resolveCanonicalWaitingOnYouItems,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { formatOperatorPriorityPackageTitle } from "../lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { HOME_LIVING_WAITING_EMPTY_MESSAGE } from "../lib/growth/home/growth-home-living-experience-18e"
import { buildPrimaryDecisionFromWorkManager } from "../lib/growth/work-manager/home/build-primary-decision-work"
import { buildAvaPrimaryDecision } from "../lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { buildAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import {
  projectReviewPackageDecisionItems,
  synthesizeGrowthReviewDecisionQueue,
} from "../lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"
import { buildGrowthLeadHref } from "../lib/growth/navigation/growth-workspace-operator-links"
import {
  buildCustomerPackageReviewHref,
  parseLeadIdFromPackageReviewRoute,
  resolveCustomerPackageReviewHref,
  resolveOperatorPackageReviewHref,
} from "../lib/growth/workspace/ux-1a/review/growth-review-routes"
import { buildGrowthReviewPackageHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

function hasWaitingSectionItems(input: {
  approveItemsCount: number
  replyCount?: number
}): boolean {
  return input.approveItemsCount > 0 || (input.replyCount ?? 0) > 0
}

function assertHomeApprovalAuthoritySync(input: {
  label: string
  snapshot: ReturnType<typeof buildCanonicalOperatorApprovalSnapshot>
  aiOsUx: ReturnType<typeof buildAiOsUxViewModel>
  operatorTasksPendingApprovals: number
  reviewPackageCount: number
}) {
  const heroDecision = buildAvaPrimaryDecision(input.aiOsUx)
  assert.equal(
    input.operatorTasksPendingApprovals,
    input.snapshot.pendingApprovalCount,
    `${input.label}: operatorTasks must mirror snapshot count`,
  )
  assert.equal(
    input.aiOsUx.approveItemsCount,
    input.snapshot.pendingApprovalCount,
    `${input.label}: approveItemsCount must mirror snapshot count`,
  )
  assert.equal(
    input.aiOsUx.waitingOnYou.filter((row) => row.id.startsWith("approval:")).length,
    input.snapshot.packages.length,
    `${input.label}: package waiting rows must mirror snapshot packages`,
  )
  assert.equal(
    input.reviewPackageCount,
    input.snapshot.pendingApprovalCount,
    `${input.label}: review count must mirror snapshot count`,
  )
  assert.equal(
    hasWaitingSectionItems({ approveItemsCount: input.aiOsUx.approveItemsCount }),
    input.snapshot.pendingApprovalCount > 0,
    `${input.label}: waiting section visibility must mirror package count`,
  )
  if (input.snapshot.pendingApprovalCount > 0) {
    assert.ok(heroDecision.primaryDecision, `${input.label}: hero card required when packages exist`)
    assert.equal(
      heroDecision.additionalDecisionCount,
      Math.max(0, input.snapshot.pendingApprovalCount - 1),
      `${input.label}: hero overflow must mirror package count`,
    )
  } else {
    assert.equal(
      input.aiOsUx.canonicalOperatorTask,
      null,
      `${input.label}: package operator task must be absent when snapshot empty`,
    )
  }
}

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

function buildAiOsUxForSnapshot(input: {
  snapshot: ReturnType<typeof buildCanonicalOperatorApprovalSnapshot>
  dashboard?: ReturnType<typeof buildGrowthHomeExecutiveBriefingCertDashboard>
}) {
  const task = buildCanonicalOperatorTask({ approvalSnapshot: input.snapshot })
  return buildAiOsUxViewModel({
    dashboard: input.dashboard ?? buildGrowthHomeExecutiveBriefingCertDashboard(),
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
    canonicalApprovalSnapshot: input.snapshot,
    canonicalOperatorTask: task,
  })
}

console.log("[ge-aios-hotfix-canonical-package-authority-v2] certification")

const LEAD_BLOCK = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const LEAD_BLITZ = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const customerHref = buildCustomerPackageReviewHref(LEAD_BLOCK)
assert.equal(customerHref, `/growth/leads/crm?open=${LEAD_BLOCK}`)
assert.equal(
  resolveCustomerPackageReviewHref({ route: `/admin/growth/leads/${LEAD_BLOCK}` }),
  customerHref,
)
assert.equal(
  resolveCustomerPackageReviewHref({ route: `/growth/leads/crm?open=${LEAD_BLOCK}` }),
  customerHref,
)
assert.equal(
  resolveCustomerPackageReviewHref({
    route: `/growth/review?tab=packages&item=${LEAD_BLOCK}`,
  }),
  customerHref,
)
assert.equal(parseLeadIdFromPackageReviewRoute(`/admin/growth/leads/${LEAD_BLOCK}`), LEAD_BLOCK)
assert.equal(resolveCustomerPackageReviewHref({ leadId: null, route: "https://evil.example/leak" }), null)
console.log("  ✓ customer package review routes normalize to CRM lead drawer")

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
  leadId: LEAD_BLOCK,
  packageId: "pkg-block-imaging",
  route: buildGrowthReviewPackageHref("pkg-block-imaging"),
})
const blitz = outreachItem({
  id: "hac-blitz",
  company: "Blitz Industries",
  leadId: LEAD_BLITZ,
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

const multiSnapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [block, blitz, followUp],
})
assert.equal(multiSnapshot.outreachPackageCount, 2)
assert.equal(multiSnapshot.pendingApprovalCount, 2)
console.log("  ✓ Fix B — package-facing pendingApprovalCount uses outreach packages only")

const projected = projectAvaCompletedWork({ items: [block, blitz] }).items
const reviewQueue = synthesizeGrowthReviewDecisionQueue({
  packageItems: projected,
  sendJobs: [],
})

const multiAiOsUx = buildAiOsUxForSnapshot({ snapshot: multiSnapshot })
assertHomeApprovalAuthoritySync({
  label: "multi-package",
  snapshot: multiSnapshot,
  aiOsUx: multiAiOsUx,
  operatorTasksPendingApprovals: multiSnapshot.pendingApprovalCount,
  reviewPackageCount: reviewQueue.packageCount,
})
assert.equal(multiAiOsUx.waitingOnYou[0]?.label, formatOperatorPriorityPackageTitle("Block Imaging"))
assert.equal(multiAiOsUx.waitingOnYou[1]?.label, formatOperatorPriorityPackageTitle("Blitz Industries"))
assert.equal(multiAiOsUx.waitingOnYou[0]?.href, buildCustomerPackageReviewHref(LEAD_BLOCK))
assert.equal(multiAiOsUx.waitingOnYou[1]?.href, buildCustomerPackageReviewHref(LEAD_BLITZ))
assert.ok(multiSnapshot.packages.every((pkg) => !pkg.reviewHref.startsWith("/admin/")))
console.log("  ✓ Test D — multi-package snapshot stays synchronized across Home and Review")

const singleSnapshot = buildCanonicalOperatorApprovalSnapshot({ hacItems: [blitz] })
const singleProjected = projectAvaCompletedWork({ items: [blitz] }).items
const singleReviewQueue = synthesizeGrowthReviewDecisionQueue({
  packageItems: singleProjected,
  sendJobs: [],
})
const singleAiOsUx = buildAiOsUxForSnapshot({ snapshot: singleSnapshot })
assertHomeApprovalAuthoritySync({
  label: "single-package",
  snapshot: singleSnapshot,
  aiOsUx: singleAiOsUx,
  operatorTasksPendingApprovals: singleSnapshot.pendingApprovalCount,
  reviewPackageCount: singleReviewQueue.packageCount,
})
assert.equal(singleAiOsUx.waitingOnYou[0]?.label, formatOperatorPriorityPackageTitle("Blitz Industries"))
assert.equal(singleAiOsUx.waitingOnYou[0]?.href, buildCustomerPackageReviewHref(LEAD_BLITZ))
const adminRouteSnapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [
    outreachItem({
      id: "hac-admin-route",
      company: "Admin Route Co",
      leadId: LEAD_BLOCK,
      packageId: "pkg-admin-route",
      route: `/admin/growth/leads/${LEAD_BLOCK}`,
    }),
  ],
})
assert.equal(adminRouteSnapshot.packages[0]?.reviewHref, buildCustomerPackageReviewHref(LEAD_BLOCK))
console.log("  ✓ Test A — single package synchronizes hero, waiting, and review")

const emptySnapshot = emptyCanonicalOperatorApprovalSnapshot()
const emptyAiOsUx = buildAiOsUxForSnapshot({ snapshot: emptySnapshot })
assertHomeApprovalAuthoritySync({
  label: "zero-package",
  snapshot: emptySnapshot,
  aiOsUx: emptyAiOsUx,
  operatorTasksPendingApprovals: 0,
  reviewPackageCount: 0,
})
assert.match(HOME_LIVING_WAITING_EMPTY_MESSAGE, /No packages are waiting for review/)
console.log("  ✓ Test B — zero packages keeps all Home surfaces empty")

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

const degradedAiOsUx = buildAiOsUxViewModel({
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
  canonicalApprovalSnapshot: emptySnapshot,
})
const staleDashboardPendingApprovals = 1
assert.equal(degradedAiOsUx.approveItemsCount, 0)
assert.equal(
  resolveCanonicalApprovalQueueCount(emptySnapshot, staleDashboardPendingApprovals),
  0,
)
assert.equal(degradedAiOsUx.waitingOnYou.length, 0)
assert.equal(degradedAiOsUx.canonicalOperatorTask, null)
assert.equal(
  hasWaitingSectionItems({ approveItemsCount: degradedAiOsUx.approveItemsCount }),
  false,
)
assert.equal(
  degradedAiOsUx.waitingOnYou.filter((row) => row.id.startsWith("approval:")).length,
  0,
)
console.log("  ✓ Test C — unavailable canonical approval degrades to zero across Home surfaces")

const taskOnlyRows = resolveCanonicalWaitingOnYouItems({
  approvalSnapshot: null,
  legacyItems: [],
})
assert.equal(taskOnlyRows.length, 0)
console.log("  ✓ unavailable snapshot does not synthesize package rows from operator task fallback")

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
  multiAiOsUx,
)
assert.equal(workManagerFallback.additionalDecisionCount, 0)
console.log("  ✓ Work Manager fallback remains unchanged when operator queue is empty")

const reviewRows = projectReviewPackageDecisionItems(projected)
assert.equal(reviewRows.length, 2)
assert.equal(reviewRows[0]?.companyName, "Block Imaging")
console.log("  ✓ Review package rows materialize from canonical HAC item= routes")

console.log("\nPASS ge-aios-hotfix-canonical-package-authority-v2")

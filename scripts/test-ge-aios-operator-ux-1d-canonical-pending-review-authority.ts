/**
 * GE-AIOS-OPERATOR-UX-1D — Canonical pending review authority certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorWaitingSummary,
  resolveCanonicalApprovalQueueCount,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildDailyActivityWaitingLines,
  buildAvaDailyActivityNarrative,
} from "../lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import { synthesizeGrowthReviewDecisionQueue } from "../lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"
import { buildPrimaryDecisionFromWorkManager } from "../lib/growth/work-manager/home/build-primary-decision-work"
import { projectSupervisedSalesProgressNarrative } from "../lib/growth/aios/operator-experience/growth-supervised-sales-progress-narrative-1b"
import type { AvaWorkManagerResult } from "../lib/growth/work-manager/types"
import type { GrowthHomeAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GROWTH_HOME_AI_OS_UX_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function mockWorkManagerWithApprovalQueue(count: number): AvaWorkManagerResult {
  return {
    qaMarker: "ge-aios-11a-work-manager-v1",
    operator_queue: Array.from({ length: count }, (_, index) => ({
      id: `approval-${index}`,
      type: "approval" as const,
      title: `Review outreach draft ${index + 1}`,
      description: "Operator approval required",
      status: "ready" as const,
      priority: 90,
      source: "decision_engine" as const,
      created_at: "2026-07-19T12:00:00.000Z",
      updated_at: "2026-07-19T12:00:00.000Z",
      estimated_minutes: 5,
      estimated_revenue_impact: 80,
      requires_operator: true,
      can_execute_autonomously: false,
      depends_on: [],
      blocked_by: [],
      next_action: null,
      decision_score: 90,
      confidence: 0.8,
      href: "/growth/review?tab=packages",
      company_name: "Acme Imaging",
      decision_source_id: `approval-${index}`,
      relationship_graph: null,
    })),
    active_work: null,
    work_plan: [],
    all_work_items: [],
    completed_today: [],
    specialist_orchestrator_result: null,
  }
}

function mockAiOsUx(approveItemsCount: number): GrowthHomeAiOsUxViewModel {
  return {
    qaMarker: GROWTH_HOME_AI_OS_UX_QA_MARKER,
    hero: {
      greeting: "Good afternoon.",
      statusLabel: "Working",
      expectedOutcomeToday: null,
      todayAtAGlance: [],
    },
    waitingOnYou: [],
    waitingOnYouOverflow: 0,
    approveItemsHref: "/growth/review?tab=packages",
    approveItemsCount,
    canonicalOperatorTask: null,
    canonicalApprovalSnapshot: null,
    canonicalActiveMissions: null,
    canonicalOperatorFocus: null,
    canonicalOperatorProgress: null,
    liveStatus: null,
    dailyWorkQueueBuckets: [],
    dailyWorkQueue: [],
    throughput: null,
    mailboxDomainHealth: null,
    autonomousReadiness: null,
  }
}

function authorizedPackageHacItem(): GrowthHumanApprovalItem {
  return {
    id: "hac-authorized",
    organizationId: "org-1",
    source: "outreach_package",
    actionType: "approve_outreach_package",
    status: "approved",
    title: "Outreach package — Acme Imaging",
    summary: "Authorized package",
    subjectType: "lead",
    subjectId: "lead-1",
    channel: "email",
    riskLevel: "medium",
    priorityScore: 90,
    createdAt: "2026-07-19T10:00:00.000Z",
    route: "/growth/review?tab=packages&item=pkg-1",
    evidence: [{ source: "outreach_preparation_pilot", label: "Assets", value: 4 }],
    policy: {
      requiresHumanApproval: false,
      enforcementSource: "autonomous_outreach_preparation_pilot",
      blockedReason: null,
    },
    packageApprovalDecision: "approved",
  } as GrowthHumanApprovalItem
}

console.log("[ge-aios-operator-ux-1d-canonical-pending-review-authority-v1] UX-1D certification")

const authorizedSnapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [authorizedPackageHacItem()],
})
assert.equal(authorizedSnapshot.pendingApprovalCount, 0)
assert.equal(authorizedSnapshot.outreachPackageCount, 0)
assert.equal(authorizedSnapshot.outreachDraftCount, 0)
console.log("  ✓ authorized packages do not contribute to canonical pending approval count")

const waitingSummary = buildCanonicalOperatorWaitingSummary({
  approvalSnapshot: {
    ...authorizedSnapshot,
    outreachDraftCount: 4,
    outreachPackageCount: 0,
  },
})
assert.match(waitingSummary, /No packages are waiting for review/i)
console.log("  ✓ draft-only orphan counts no longer emit waiting copy")

const reviewQueue = synthesizeGrowthReviewDecisionQueue({
  packageItems: [],
  sendJobs: [],
})
assert.equal(reviewQueue.packageCount, 0)
assert.equal(reviewQueue.totalActionable, 0)
assert.equal(reviewQueue.isCaughtUp, true)

const homePending = resolveCanonicalApprovalQueueCount(authorizedSnapshot, 99)
assert.equal(homePending, 0)
assert.equal(homePending, reviewQueue.totalActionable)
console.log("  ✓ Home canonical pending count matches Review queue totalActionable")

const workResult = mockWorkManagerWithApprovalQueue(4)
const waitingLinesCanonicalZero = buildDailyActivityWaitingLines({
  workResult,
  salesDailySummary: { approvals_pending: 0, outreach_prepared: 4, researched: 0, qualified: 0 },
  pendingApprovalCount: 0,
})
assert.equal(waitingLinesCanonicalZero.length, 0)
console.log("  ✓ daily activity waiting lines defer to canonical pending count over Work Manager queue")

const waitingLinesStaleSales = buildDailyActivityWaitingLines({
  workResult,
  salesDailySummary: { approvals_pending: 0, outreach_prepared: 4, researched: 0, qualified: 0 },
})
assert.equal(waitingLinesStaleSales.length, 0)
console.log("  ✓ sales daily summary canonical zero suppresses stale Work Manager approval queue")

const narrative = buildAvaDailyActivityNarrative({
  memorySummary: null,
  salesDailySummary: { approvals_pending: 0, outreach_prepared: 4, researched: 0, qualified: 0 },
  pendingApprovalCount: 0,
  workResult,
  operatingRhythm: {
    qaMarker: "ge-aios-13a-operating-rhythm-v1",
    active_cycle: null,
    cycles: [],
    next_phase_hint: null,
  },
  hour: 14,
})
assert.ok(
  !narrative.waiting_on_you.some((line) =>
    /opportunity packages ready for your review|packages ready for your review/i.test(line),
  ),
)
console.log("  ✓ hero daily activity narrative suppresses stale approval blocking copy when canonical pending is zero")

const heroDecision = buildPrimaryDecisionFromWorkManager(workResult, mockAiOsUx(0))
assert.equal(heroDecision.primaryDecision, null)
assert.equal(heroDecision.reviewAllHref, null)
console.log("  ✓ hero priority card suppresses Work Manager approval fallback when canonical pending is zero")

const staleMissionDrafts = projectSupervisedSalesProgressNarrative({
  approvalSnapshot: authorizedSnapshot,
  missionDiscovery: {
    qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
    missionId: "mission-1",
    lifecycleState: "monitoring",
    activityLabel: "Monitoring",
    counters: {
      newCompaniesFound: 0,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 4,
      pendingApprovals: 0,
    },
    searchSummary: null,
    audienceName: null,
    recordsImported: 0,
    newCompaniesFound: 0,
    leadPoolVisible: 0,
    leadPoolHasMore: false,
    pipelineLow: false,
    lastEventSummary: null,
    discoveryAction: "monitoring",
    startupDiscoveryReady: true,
  },
})
assert.notEqual(staleMissionDrafts.primaryStage, "package_ready")
assert.equal(staleMissionDrafts.operatorAttentionRequired, false)
console.log("  ✓ supervised sales progress ignores stale mission draft counters when Review queue is empty")

const narrativeSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative.ts")
assert.match(narrativeSource, /pendingApprovalCount/)
assert.match(narrativeSource, /salesDailySummary\?\.approvals_pending/)
console.log("  ✓ narrative engine wired to canonical pending approval count")

const briefingSource = readSource("lib/growth/ava-home/narrative/engine/build-ava-daily-briefing.ts")
assert.match(briefingSource, /pendingApprovalCount/)
console.log("  ✓ daily briefing passes canonical pending approval count")

const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
assert.match(heroSource, /pendingApprovalCount:\s*input\.aiOsUx\.approveItemsCount/)
console.log("  ✓ home hero passes aiOsUx approveItemsCount into briefing stack")

const waitingSection = readSource(
  "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
)
assert.match(waitingSection, /approveItemsCount > 0 \|\| replyCount > 0/)
console.log("  ✓ What I need from you section keys off canonical approval/reply counts")

const workManagerBridge = readSource("lib/growth/work-manager/home/build-primary-decision-work.ts")
assert.match(workManagerBridge, /approveItemsCount === 0/)
console.log("  ✓ Work Manager primary decision bridge respects canonical approval count")

const canonicalWorkspace = readSource(
  "lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a.ts",
)
assert.doesNotMatch(canonicalWorkspace, /if \(drafts > 0\) \{\s*return formatCanonicalDraftCount/)
console.log("  ✓ canonical waiting summary no longer treats orphan draft totals as pending work")

console.log("\nPASS — Home and Review share one canonical pending-review authority.")

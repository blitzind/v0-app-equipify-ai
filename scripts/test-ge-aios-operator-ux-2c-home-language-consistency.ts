/**
 * GE-AIOS-OPERATOR-UX-2C — Home operator language & consistency certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildCanonicalOperatorWaitingSummary,
  buildCanonicalOperatorTask,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import {
  formatLivingWaitingSummary,
  HOME_LIVING_WAITING_EMPTY_MESSAGE,
} from "../lib/growth/home/growth-home-living-experience-18e"
import { buildDailyActivityWaitingLines } from "../lib/growth/ava-home/narrative/engine/build-ava-daily-activity-narrative"
import {
  formatOperatorPackagesReadySummary,
  GROWTH_OPERATOR_REVIEW_CTA_LABEL,
} from "../lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_TITLE } from "../lib/growth/workspace/ux-1a/growth-workspace-priority-feed-copy"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function snapshot(count: number): GrowthCanonicalOperatorApprovalSnapshot {
  return {
    qaMarker: "ge-aios-operator-experience-1a-v1",
    outreachPackageCount: count,
    outreachDraftCount: count * 2,
    pendingApprovalCount: count,
    waitingForOperator: count > 0,
    packages: count > 0
      ? [
          {
            itemId: "pkg-1",
            packageId: "package-1",
            leadId: "lead-1",
            companyName: "Blitz Industries",
            channelLabel: "Email sequence",
            draftCount: 2,
            reviewHref: "/growth/review?tab=packages&item=package-1",
            preparedAgoLabel: "Prepared 5 minutes ago",
          },
        ]
      : [],
    topPackage:
      count > 0
        ? {
            itemId: "pkg-1",
            packageId: "package-1",
            leadId: "lead-1",
            companyName: "Blitz Industries",
            channelLabel: "Email sequence",
            draftCount: 2,
            reviewHref: "/growth/review?tab=packages&item=package-1",
            preparedAgoLabel: "Prepared 5 minutes ago",
          }
        : null,
  }
}

console.log("GE-AIOS-OPERATOR-UX-2C — Home language consistency")

const waitingSummary = formatLivingWaitingSummary({ approvalCount: 2 })
assert.match(waitingSummary, /2 opportunity packages ready for your review/)
assert.doesNotMatch(waitingSummary, /outreach drafts/i)
assert.doesNotMatch(waitingSummary, /human approval/i)

const canonicalWaiting = buildCanonicalOperatorWaitingSummary({
  approvalSnapshot: snapshot(2),
})
assert.match(canonicalWaiting, /2 opportunity packages ready for your review/)
assert.match(canonicalWaiting, /Once you've reviewed them/i)

const dailyWaiting = buildDailyActivityWaitingLines({
  workResult: {
    qaMarker: "ge-aios-11a-work-manager-v1",
    operator_queue: [{ id: "a1", type: "approval" } as never, { id: "a2", type: "approval" } as never],
    active_work: null,
    work_plan: [],
    all_work_items: [],
    completed_today: [],
    specialist_orchestrator_result: null,
  },
  pendingApprovalCount: 2,
})
assert.ok(dailyWaiting.some((line) => /2 opportunity packages ready for your review/i.test(line)))
assert.ok(!dailyWaiting.some((line) => /outreach drafts/i.test(line)))

const task = buildCanonicalOperatorTask({ approvalSnapshot: snapshot(1) })
assert.ok(task)
assert.match(task!.title, /Review opportunity package — Blitz Industries/)
assert.match(task!.whatHappensNext ?? "", /proposed outreach strategy/i)

assert.match(HOME_LIVING_WAITING_EMPTY_MESSAGE, /No packages are waiting for review/)
assert.match(GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_TITLE, /No packages are waiting for review/)
assert.equal(GROWTH_OPERATOR_REVIEW_CTA_LABEL, "Review package")

const livingSource = readSource("lib/growth/home/growth-home-living-experience-18e.ts")
assert.match(livingSource, /formatOperatorPackagesReadySummary/)

const heroSource = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
assert.match(heroSource, /GROWTH_OPERATOR_REVIEW_CTA_LABEL/)

const queueSource = readSource("lib/growth/daily-work-queue/daily-revenue-work-queue-engine.ts")
assert.doesNotMatch(queueSource, /Human approval waiting/)

console.log("  ✓ unified package vocabulary on Home waiting surfaces")
console.log("  ✓ Review CTA standardized")
console.log("  ✓ human approval wording removed from queue reasoning")
console.log("PASS — GE-AIOS-OPERATOR-UX-2C")

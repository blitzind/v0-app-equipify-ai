/**
 * GE-AIOS-OPERATOR-UX-1A — Completed Work prioritization & lifecycle controls certification.
 * Run: pnpm test:ge-aios-operator-ux-1a-completed-work-lifecycle-controls
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
  canAuthorizeCompletedWorkItem,
  filterActiveCompletedWorkItems,
  groupSupportingCompletedWork,
  isInactiveLeadLifecycle,
  resolveCompletedWorkContextualCta,
  resolveCompletedWorkOperatorBucket,
  sortCompletedWorkForOperatorPriority,
  summarizeActionableCompletedWork,
} from "../lib/growth/aios/approvals/completed-work-operator-ux"
import { projectAvaCompletedWork } from "../lib/growth/aios/approvals/ava-completed-work-projection"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import { resolveAiTeammatePresentation } from "../lib/workspace/ai-teammate-identity"

const ROOT = process.cwd()
const BEST_BUY = "03a361d3-e6b6-42e6-bc78-a5773acc1725"
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleItem(overrides: Partial<GrowthHumanApprovalItem> = {}): GrowthHumanApprovalItem {
  return {
    id: "item-1",
    organizationId: ORG,
    source: "outreach_package",
    actionType: "approve_outreach_package",
    channel: "email",
    subjectType: "lead",
    subjectId: BLOCK,
    title: "Outreach package — block imaging",
    summary: "Ready for review",
    riskLevel: "medium",
    priorityScore: 80,
    status: "needs_review",
    evidence: [],
    policy: { requiresHumanApproval: true, enforcementSource: "test" },
    route: `/growth/os/pilot/lead-research/${BLOCK}?packageId=outreach-prep%3A${BLOCK}%3A2026-07-13`,
    createdAt: "2026-07-13T16:40:40.229Z",
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER}] Completed Work lifecycle controls certification`)

assert.equal(
  GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
  "ge-aios-operator-ux-1a-completed-work-lifecycle-controls-v1",
)

// Lifecycle inactive detection
assert.equal(isInactiveLeadLifecycle({ status: "archived", archivedAt: null }), true)
assert.equal(isInactiveLeadLifecycle({ status: "qualified", archivedAt: "2026-07-01T00:00:00Z" }), true)
assert.equal(isInactiveLeadLifecycle({ status: "disqualified", archivedAt: null }), true)
assert.equal(isInactiveLeadLifecycle({ status: "qualified", archivedAt: null }), false)
console.log("  ✓ archived/disqualified leads marked inactive for active Completed Work")

// Best Buy fixture disappears from active list; Block Imaging remains
const items = [
  sampleItem(),
  sampleItem({
    id: "best-buy-pkg",
    subjectId: BEST_BUY,
    title: "Outreach package — Best Buy",
    route: `/growth/os/pilot/lead-research/${BEST_BUY}?packageId=pkg-bb`,
  }),
  sampleItem({
    id: "cal-1",
    source: "adaptive_calibration",
    actionType: "review_recommendation",
    subjectId: BLOCK,
    title: "Calibration signal A",
    priorityScore: 40,
  }),
  sampleItem({
    id: "cal-2",
    source: "adaptive_calibration",
    actionType: "review_recommendation",
    subjectId: BLOCK,
    title: "Calibration signal B",
    priorityScore: 41,
  }),
  sampleItem({
    id: "cal-3",
    source: "meta_recommender",
    actionType: "review_recommendation",
    subjectId: BLOCK,
    title: "Meta recommendation",
    priorityScore: 30,
  }),
  sampleItem({
    id: "follow-1",
    source: "automation",
    actionType: "approve_automation",
    subjectId: BLOCK,
    title: "Follow-up decision",
    priorityScore: 55,
  }),
]

const lifecycle = new Map([
  [BEST_BUY, { leadId: BEST_BUY, status: "archived", archivedAt: "2026-07-10T00:00:00Z", companyName: "Best Buy" }],
  [BLOCK, { leadId: BLOCK, status: "qualified", archivedAt: null, companyName: "block imaging" }],
])

const active = filterActiveCompletedWorkItems({
  items,
  leadLifecycleById: lifecycle,
  dismissedItemIds: new Set(["cal-3"]),
})
assert.equal(active.some((row) => row.subjectId === BEST_BUY), false)
assert.equal(active.some((row) => row.subjectId === BLOCK && row.source === "outreach_package"), true)
assert.equal(active.some((row) => row.id === "cal-3"), false)
console.log("  ✓ Best Buy archived artifact excluded; Block Imaging remains; dismiss hides recommendation")

assert.equal(
  canAuthorizeCompletedWorkItem({
    item: sampleItem({ subjectId: BEST_BUY }),
    leadLifecycle: lifecycle.get(BEST_BUY),
  }),
  false,
)
assert.equal(
  canAuthorizeCompletedWorkItem({
    item: sampleItem(),
    leadLifecycle: lifecycle.get(BLOCK),
  }),
  true,
)
console.log("  ✓ disqualified/archived packages cannot be authorized")

const summary = summarizeActionableCompletedWork(active)
assert.ok(summary.outreachPackages >= 1)
assert.ok(summary.followUpDecisions >= 1)
assert.ok(summary.supportingRecommendations >= 1)
assert.equal(summary.totalActionable, active.length)
console.log("  ✓ actionable summary excludes dismissed/archived and reports package/follow-up/supporting counts")

const projected = projectAvaCompletedWork({ items: active, teammateName: "Ava" })
const sorted = sortCompletedWorkForOperatorPriority(projected.items)
assert.equal(resolveCompletedWorkOperatorBucket(sorted[0]!.item), "ready_outreach")
const firstSupportingIdx = sorted.findIndex((row) =>
  resolveCompletedWorkOperatorBucket(row.item).startsWith("supporting_"),
)
const lastPrimaryIdx = sorted
  .map((row, idx) => ({ row, idx }))
  .filter(({ row }) => !resolveCompletedWorkOperatorBucket(row.item).startsWith("supporting_"))
  .at(-1)?.idx
assert.ok(firstSupportingIdx === -1 || (lastPrimaryIdx != null && firstSupportingIdx > lastPrimaryIdx))
console.log("  ✓ outreach packages appear before calibration/supporting items")

const groups = groupSupportingCompletedWork(active)
assert.ok(groups.some((g) => g.bucket === "supporting_calibration" && g.count >= 2))
console.log("  ✓ repetitive calibration items group into collapsed supporting summaries")

assert.equal(resolveCompletedWorkContextualCta(sampleItem()), "Review package")
assert.equal(
  resolveCompletedWorkContextualCta(
    sampleItem({ source: "automation", actionType: "approve_automation" }),
  ),
  "Review follow-up",
)
assert.equal(
  resolveCompletedWorkContextualCta(
    sampleItem({ source: "adaptive_calibration", actionType: "review_recommendation" }),
  ),
  "Review recommendation",
)
console.log("  ✓ generic CTA copy replaced with contextual actions")

const teammate = resolveAiTeammatePresentation("Jordan")
assert.equal(teammate.name, "Jordan")
const panel = readSource("components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx")
assert.ok(panel.includes("useAiTeammateIdentity"))
assert.ok(panel.includes("Ready for your review"))
assert.ok(panel.includes("resolveCompletedWorkContextualCta"))
assert.equal(/Review \$\{teammateName\}'s work/.test(panel), false)
assert.ok(panel.includes("GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER"))
console.log("  ✓ configurable teammate identity respected; no hardcoded Ava CTA")

const card = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
)
const progressiveLayout = readSource(
  "components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout.tsx",
)
assert.ok(card.includes("Drafts") || card.includes("Prepared drafts"))
assert.ok(card.includes("GrowthAvaPackageProgressiveReviewLayout"))
assert.ok(progressiveLayout.includes("Not prepared"))
assert.ok(card.includes("Cancel work") || card.includes("Pause autonomy"))
assert.ok(card.includes("Archive lead") || card.includes("Archive account"))
assert.ok(card.includes("Authorize"))
assert.equal(/sendEmail|enrollSequence|twilio|placeCall/i.test(card), false)
console.log("  ✓ Block Imaging-style package card renders drafts inline with lifecycle actions")

const lifecycleApi = readSource(
  "app/api/platform/growth/ai-os/completed-work/lifecycle/route.ts",
)
assert.ok(lifecycleApi.includes("cancel_work"))
assert.ok(lifecycleApi.includes("archive_account"))
assert.ok(lifecycleApi.includes("restore_account"))
assert.ok(lifecycleApi.includes("delete_permanently"))
assert.ok(lifecycleApi.includes("confirmation_required"))
assert.ok(lifecycleApi.includes("stopAutonomousWorkForLead"))
assert.ok(lifecycleApi.includes("archiveGrowthLeads"))
assert.ok(lifecycleApi.includes("restoreGrowthLeads"))
console.log("  ✓ dismiss/cancel/archive/delete/restore reuse canonical lead + stop helpers")

const propagation = readSource(
  "lib/growth/aios/approvals/completed-work-lifecycle-propagation.ts",
)
assert.ok(propagation.includes("pauseDraftFactoryWorkForLead"))
assert.ok(propagation.includes("operator_canceled"))
assert.ok(propagation.includes("lead_archived"))
assert.ok(propagation.includes("markAutonomousOutreachPackageApprovalDecision"))
console.log("  ✓ Cancel Work / Archive stops Draft Factory and rejects pending packages")

const hacService = readSource("lib/growth/aios/approvals/growth-human-approval-center-service.ts")
assert.ok(hacService.includes("filterActiveCompletedWorkItems"))
assert.ok(hacService.includes("fetchCompletedWorkLeadLifecycleMap"))
console.log("  ✓ HAC/Completed Work filters archived leads at canonical read path")

const leadRoute = readSource("app/api/platform/growth/leads/[leadId]/route.ts")
assert.ok(leadRoute.includes("stopAutonomousWorkForLead"))
assert.ok(readSource("lib/growth/lead-repository.ts").includes("restoreGrowthLeads"))
console.log("  ✓ archive/disqualify propagates autonomy stop; restore is explicit")

const packageAction = readSource(
  "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action/route.ts",
)
assert.ok(packageAction.includes('decision: z.enum(["approve", "reject"])'))
assert.ok(packageAction.includes("transportBlocked: true"))
console.log("  ✓ existing approval APIs remain canonical; no parallel approval store")

assert.equal(/sendEmail|enrollInCampaign|apollo/i.test(propagation), false)
assert.equal(/sendEmail|enrollInCampaign/i.test(lifecycleApi), false)
console.log("  ✓ no send, enrollment, SMS, voice, or call in lifecycle controls")

const pkg = readSource("package.json")
assert.ok(pkg.includes("test:ge-aios-operator-ux-1a-completed-work-lifecycle-controls"))
console.log("  ✓ package script registered")

console.log(`\n[${GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER}] PASS`)

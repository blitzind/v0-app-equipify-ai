/**
 * GE-AIOS-UX-1A Phase 3 — Review Human Decision Queue certification.
 * Run: pnpm test:ge-aios-ux-1a-review-human-decision-queue
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { GrowthAvaCompletedWorkItem } from "../lib/growth/aios/approvals/ava-completed-work-projection"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG,
  GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_ENABLED,
  GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG,
  isGrowthWorkspaceFirstUx1aEnabled,
  isGrowthWorkspaceFirstUx1aEnabledClient,
} from "../lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import type { GrowthSequenceExecutionJobView } from "../lib/growth/sequences/execution/sequence-execution-types"
import {
  containsReviewForbiddenOperatorTerm,
  findReviewDecisionItem,
  projectReviewPackageDecisionItems,
  projectReviewSendDecisionItems,
  synthesizeGrowthReviewDecisionQueue,
} from "../lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"
import { GROWTH_REVIEW_QA_MARKER } from "../lib/growth/workspace/ux-1a/review/growth-review-decision-queue-types"
import {
  buildGrowthReviewHref,
  buildGrowthReviewPackageHref,
  buildGrowthReviewSendHref,
  GROWTH_REVIEW_LEGACY_APPROVALS_HREF,
  GROWTH_REVIEW_LEGACY_SEQUENCE_HREF,
  GROWTH_REVIEW_PAGE_HREF,
  parseGrowthReviewSearchParams,
  remapLegacyHrefToGrowthReview,
  resolveUx1aReviewHref,
} from "../lib/growth/workspace/ux-1a/review/growth-review-routes"
import { remapUx1aOperatorHref } from "../lib/growth/workspace/ux-1a/growth-workspace-priority-feed-synthesizer"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_FORBIDDEN_NAV_LABELS,
  GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST,
} from "../lib/growth/navigation/growth-workspace-first-ux-1a-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const PHASE = "GE-AIOS-UX-1A-REVIEW-HUMAN-DECISION-QUEUE" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function mockApprovalItem(overrides: Partial<GrowthHumanApprovalItem> = {}): GrowthHumanApprovalItem {
  return {
    id: "approval-item-1",
    organizationId: "org-1",
    source: "outreach_package",
    actionType: "approve_outreach_package",
    status: "pending",
    subjectType: "lead",
    subjectId: "lead-1",
    riskLevel: "low",
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T12:00:00.000Z",
    title: "Outreach package ready",
    summary: "Prepared for review",
    ...overrides,
  } as GrowthHumanApprovalItem
}

function mockPackageRow(packageId: string, company = "Acme Corp"): GrowthAvaCompletedWorkItem {
  return {
    item: mockApprovalItem(),
    category: "outreach_packages",
    outreachCard: {
      itemId: `item-${packageId}`,
      packageId,
      leadId: "lead-1",
      company,
      decisionMaker: "Jane Doe",
      confidence: 82,
      whySelected: "Strong ICP fit",
      businessObjective: "Expand pipeline",
      mission: "First contact",
      investmentState: "active",
      portfolioPriority: "high",
      personalizationSummary: "Tailored intro",
      expectedOutcome: "Meeting booked",
      risk: "low",
      timePrepared: "Jul 18, 12:00 PM",
      currentStage: "ready",
      recommendedChannel: "Email",
      recommendedSequence: "Cold email",
      draftAssets: [],
      explainability: {
        whyCompany: "Fit",
        whyNow: "Timing",
        whyDecisionMaker: "DM",
        whySequence: "Sequence",
        supportingEvidence: [],
        investmentDecision: "Invest",
        portfolioDecision: "Prioritize",
        knowledgeSummary: "Summary",
      },
      route: null,
      transportBlocked: true,
      pendingHumanApproval: true,
    },
  }
}

function mockSendJob(
  id: string,
  status: GrowthSequenceExecutionJobView["status"],
): GrowthSequenceExecutionJobView {
  return {
    id,
    sequenceEnrollmentId: "enroll-1",
    sequenceStepId: "step-1",
    leadId: "lead-1",
    channel: "email",
    senderAccountId: null,
    providerId: null,
    senderPoolId: null,
    allowAutoRotation: false,
    manualSenderAccountId: null,
    senderRotationDecisionId: null,
    status,
    scheduledFor: "2026-07-18T13:00:00.000Z",
    lockedAt: null,
    lockedBy: null,
    attemptCount: 0,
    lastError: null,
    deliveryAttemptId: null,
    smsDraftBody: null,
    smsToE164: null,
    smsDeliveryAttemptId: null,
    voiceDropCampaignId: null,
    voiceDropRecipientId: null,
    voiceDropDeliveryAttemptId: null,
    requiresHumanApproval: true,
    humanApprovedAt: null,
    humanApprovedBy: null,
    createdAt: "2026-07-18T12:30:00.000Z",
    updatedAt: "2026-07-18T12:30:00.000Z",
    leadLabel: "Jane Doe · Acme Corp",
    sequenceLabel: "Cold outreach",
    stepLabel: "Intro email subject line",
    providerLabel: null,
    apolloDraftApprovalBlocked: false,
  }
}

function main(): void {
  console.log(`[${PHASE}] Review Human Decision Queue Phase 3 certification`)

  assert.equal(GROWTH_REVIEW_QA_MARKER, "ge-aios-ux-1a-review-human-decision-queue-v1")
  assert.equal(GROWTH_REVIEW_PAGE_HREF, "/growth/review")
  assert.equal(isGrowthWorkspaceFirstUx1aEnabled({}), false)
  assert.equal(resolveUx1aReviewHref({}), GROWTH_REVIEW_LEGACY_APPROVALS_HREF)
  assert.equal(
    resolveUx1aReviewHref({ [GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG]: "true" }),
    GROWTH_REVIEW_PAGE_HREF,
  )

  const featureModule = readSource("lib/growth/navigation/growth-workspace-first-ux-1a-feature.ts")
  assert.doesNotMatch(
    featureModule,
    /NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG(?!\s*=)/,
    "accidental bare runtime identifier must not appear",
  )
  assert.match(featureModule, /process\.env\.NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED/)
  assert.equal(GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG, "NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_ENABLED")
  assert.equal(isGrowthWorkspaceFirstUx1aEnabled({}), false)
  assert.equal(isGrowthWorkspaceFirstUx1aEnabledClient(), false)
  assert.equal(GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_ENABLED, false)
  console.log("  ✓ hotfix 1A: absent flags resolve false without runtime ReferenceError")

  const legacyApprovals = readSource("app/(growth)/growth/os/approvals/page.tsx")
  const legacySequences = readSource("app/(growth)/growth/campaigns/sequences/page.tsx")
  assert.doesNotMatch(legacyApprovals, /NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG/)
  assert.doesNotMatch(legacySequences, /NEXT_PUBLIC_GROWTH_WORKSPACE_FIRST_UX_1A_PUBLIC_FEATURE_FLAG/)
  assert.match(legacyApprovals, /if \(ux1aActive\)/)
  assert.match(legacySequences, /if \(ux1aActive\)/)
  assert.match(legacyApprovals, /if \(!ux1aActive\) return/)
  assert.match(legacySequences, /if \(!ux1aActive\) return/)
  assert.match(legacyApprovals, /GrowthAvaCompletedWorkPanel/)
  assert.match(legacySequences, /GrowthSequenceExecutionPanels/)
  console.log("  ✓ hotfix 1A: legacy routes render normally and redirect only when flag enabled")

  console.log("  ✓ feature flag off preserves legacy review href resolution")

  assert.ok(fs.existsSync(path.join(ROOT, "app/(growth)/growth/review/page.tsx")))
  const reviewPage = readSource("components/growth/workspace/ux-1a/review/growth-review-human-decision-queue-page.tsx")
  assert.match(reviewPage, /data-section="review-human-decision-queue"/)
  assert.match(reviewPage, /Items waiting for your decision/)
  assert.match(reviewPage, /Packages/)
  assert.match(reviewPage, /Sends/)
  assert.doesNotMatch(reviewPage, /Human Approval Center|Completed Work|Sequence Execution|"Ava"/)
  console.log("  ✓ feature flag on exposes /growth/review presentation surface")

  const legacyApprovalsPage = readSource("app/(growth)/growth/os/approvals/page.tsx")
  assert.match(legacyApprovalsPage, /GrowthAvaCompletedWorkPanel/)
  assert.match(legacyApprovalsPage, /isGrowthWorkspaceFirstUx1aEnabledClient/)
  assert.match(legacyApprovalsPage, /GROWTH_REVIEW_PAGE_HREF/)
  console.log("  ✓ legacy approvals page preserved when flag off and redirects when flag on")

  const legacySequencesPage = readSource("app/(growth)/growth/campaigns/sequences/page.tsx")
  assert.match(legacySequencesPage, /GrowthSequenceExecutionPanels/)
  assert.match(legacySequencesPage, /buildGrowthReviewHref\(\{ tab: "sends" \}\)/)
  console.log("  ✓ legacy sequence execution preserved when flag off and redirects sends tab when flag on")

  const packages = projectReviewPackageDecisionItems([
    mockPackageRow("pkg-1"),
    {
      item: mockApprovalItem({ source: "meeting_prep", actionType: "approve_meeting_prep" }),
      category: "meeting_preparations",
      outreachCard: null,
    },
  ])
  assert.equal(packages.length, 1)
  assert.equal(packages[0]?.kind, "package")
  assert.equal(packages[0]?.href, buildGrowthReviewPackageHref("pkg-1"))
  console.log("  ✓ packages tab shows actionable outreach package approvals only")

  const sends = projectReviewSendDecisionItems([
    mockSendJob("job-pending", "pending_approval"),
    mockSendJob("job-sent", "sent"),
    mockSendJob("job-approved", "approved"),
  ])
  assert.equal(sends.length, 1)
  assert.equal(sends[0]?.drawerTarget.kind, "send")
  assert.equal(sends[0]?.href, buildGrowthReviewSendHref("job-pending"))
  console.log("  ✓ sends tab shows pending_approval transport jobs only")

  const queue = synthesizeGrowthReviewDecisionQueue({
    packageItems: [mockPackageRow("pkg-1"), mockPackageRow("pkg-2")],
    sendJobs: [mockSendJob("job-1", "pending_approval")],
  })
  assert.equal(queue.packageCount, 2)
  assert.equal(queue.sendCount, 1)
  assert.equal(queue.totalActionable, 3)
  assert.equal(queue.isCaughtUp, false)
  console.log("  ✓ tab counts reflect actionable items only")

  const emptyQueue = synthesizeGrowthReviewDecisionQueue({ packageItems: [], sendJobs: [] })
  assert.equal(emptyQueue.isCaughtUp, true)
  assert.equal(emptyQueue.totalActionable, 0)
  console.log("  ✓ caught-up state is accurate when queue is empty")

  const packageMatch = findReviewDecisionItem(queue, { tab: "packages", itemId: "pkg-2" })
  const sendMatch = findReviewDecisionItem(queue, { tab: "sends", itemId: "job-1" })
  assert.ok(packageMatch)
  assert.ok(sendMatch)
  assert.equal(packageMatch?.drawerTarget.kind, "package")
  assert.equal(sendMatch?.drawerTarget.kind, "send")
  console.log("  ✓ deep-link item resolution selects exact package and send drawers")

  assert.equal(parseGrowthReviewSearchParams({ get: (name) => (name === "tab" ? "sends" : name === "item" ? "job-1" : null) }).tab, "sends")
  assert.equal(
    parseGrowthReviewSearchParams({ get: (name) => (name === "item" ? "pkg-1" : null) }).itemId,
    "pkg-1",
  )
  assert.equal(
    remapUx1aOperatorHref("/growth/campaigns/sequences?job=job-1"),
    buildGrowthReviewSendHref("job-1"),
  )
  assert.equal(
    remapUx1aOperatorHref("/growth/os/approvals?packageId=pkg-1"),
    buildGrowthReviewPackageHref("pkg-1"),
  )
  assert.equal(remapLegacyHrefToGrowthReview(GROWTH_REVIEW_LEGACY_SEQUENCE_HREF), buildGrowthReviewHref({ tab: "sends" }))
  console.log("  ✓ workspace and legacy hrefs deep-link into Review tabs/items")

  const hook = readSource("components/growth/workspace/ux-1a/review/use-growth-review-decision-queue.ts")
  assert.match(hook, /\/api\/platform\/growth\/ai-os\/approvals/)
  assert.match(hook, /\/api\/platform\/growth\/ai-os\/command-center/)
  assert.match(hook, /\/api\/platform\/growth\/sequences\/execution\/dashboard/)
  assert.doesNotMatch(hook, /POST.*\/review\/approve/)
  console.log("  ✓ existing canonical read APIs are reused without new approval endpoints")

  const packageDrawer = readSource("components/growth/workspace/ux-1a/review/growth-review-package-drawer.tsx")
  assert.match(packageDrawer, /GrowthAvaCompletedOutreachPackageCard/)
  assert.doesNotMatch(packageDrawer, /execution request|enrollment|canonical decision/i)

  const sendDrawer = readSource("components/growth/workspace/ux-1a/review/growth-review-send-drawer.tsx")
  assert.match(sendDrawer, /sequences\/execution\/jobs/)
  assert.match(sendDrawer, /approve.*skip|skip.*approve/s)
  assert.match(sendDrawer, /Nothing has been sent yet/)
  assert.match(sendDrawer, /Waiting for your approval/)
  const sendOperatorCopy = [
    "Review send",
    "Nothing has been sent yet.",
    "Waiting for your approval",
    "Needs attention before this can be authorized",
    "Send authorized. Nothing has been delivered yet.",
    "Needs work",
  ].join(" ")
  assert.ok(!containsReviewForbiddenOperatorTerm(sendOperatorCopy))
  console.log("  ✓ drawers reuse canonical package card and send approve/skip actions")

  assert.match(reviewPage, /onDecided|onCompleted/)
  assert.match(reviewPage, /void reload\(\)/)
  console.log("  ✓ authorize/reject flows refresh queue without forcing navigation")

  const serialized = JSON.stringify(queue)
  assert.ok(!containsReviewForbiddenOperatorTerm(serialized))
  assert.ok(!/delivered|sent/i.test(sends[0]?.statusLabel ?? ""))
  assert.match(sendDrawer, /Nothing has been delivered yet/)
  console.log("  ✓ operator language avoids engineering terms and does not imply delivery for pending sends")

  const navManifest = readSource("lib/growth/navigation/growth-workspace-first-ux-1a-navigation.ts")
  assert.match(navManifest, /hrefOverride: GROWTH_REVIEW_PAGE_HREF/)
  const navLabels = GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST.flatMap((group) =>
    group.items.map((item) => item.label),
  )
  for (const forbidden of GROWTH_WORKSPACE_FIRST_UX_1A_FORBIDDEN_NAV_LABELS) {
    assert.ok(!navLabels.includes(forbidden), `forbidden nav label: ${forbidden}`)
  }
  console.log("  ✓ Review nav resolves to /growth/review without assistant naming")

  const synthesizer = readSource("lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer.ts")
  assert.doesNotMatch(synthesizer, /insert|update|delete|createTable|migration/)
  console.log("  ✓ presentation-only contract with no schema or engine changes")

  console.log(`[${PHASE}] passed`)
}

main()

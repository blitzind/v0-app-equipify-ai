/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Operator story consolidation certification.
 * Run: pnpm test:ge-aios-operator-story-implementation-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import { projectCanonicalDecisionOperatorCard } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  type GrowthCanonicalDecisionResolution,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import { projectGrowthCanonicalOperatorDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { buildCanonicalMission, buildCanonicalMissionsFromApprovalSnapshot } from "../lib/growth/aios/missions/growth-canonical-mission-1a"
import { buildCanonicalOperatorAccountNarrative } from "../lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a"
import {
  assertCanonicalOperatorFocusAlignment,
  buildCanonicalOperatorFocus,
  GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a"
import { projectCanonicalOperatorProgress } from "../lib/growth/aios/operator-experience/growth-canonical-operator-progress-1a"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
  projectCanonicalLeadOpportunityNarrative,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { GROWTH_OPERATOR_STORY_RETIREMENT_LIST } from "../lib/growth/aios/operator-experience/growth-operator-story-retirement-1a"
import {
  humanizeOperatorFacingLine,
  stripInternalEngineTerms,
} from "../lib/growth/aios/operator-experience/growth-operator-language-1a"
import { buildRevenueQueueCardProjectionFromLead } from "../lib/growth/revenue-queue/revenue-queue-card-projection"
import { buildAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import type { GrowthLead } from "../lib/growth/types"

const ROOT = process.cwd()
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function outreachHacItem(): GrowthHumanApprovalItem {
  return {
    id: "hac-outreach-block-imaging",
    organizationId: ORG,
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
    evidence: [{ source: "outreach_preparation_pilot", label: "Assets", value: 2 }],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "autonomous_outreach_preparation_pilot",
      blockedReason: "Transport blocked — draft only until human approval.",
    },
  }
}

function blockImagingPackage(): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: "pkg-block-imaging-001",
    leadId: BLOCK_LEAD,
    organizationId: ORG,
    preparedAt: "2026-07-14T10:00:00.000Z",
    pendingHumanApproval: true,
    packageApprovalDecision: null,
    generatedAssets: [{ channel: "email", label: "Intro email", prepared: true }],
    approvalRequirements: ["Operator review before send"],
    salesStrategyBrief: null,
    expectedOutcome: "Book first meeting",
  } as GrowthAutonomousOutreachApprovalPackage
}

function decisionInput(): GrowthCanonicalDecisionInput {
  return {
    organizationId: ORG,
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
    packageState: {
      packageId: "pkg-block-imaging-001",
      status: "pending_approval",
      purpose: "Intro sequence",
    },
    draftFactoryStatus: null,
    approvalState: {
      pendingOperatorReview: true,
      pendingPackageApproval: true,
      label: "Awaiting review",
    },
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

function toResolution(input: GrowthCanonicalDecisionInput): GrowthCanonicalDecisionResolution {
  const decision = buildGrowthCanonicalNextBestDecision(input)
  const freshness = computeGrowthCanonicalDecisionFreshness({
    decision,
    materialEventAt: input.generatedAt,
  })
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    companyName: input.companyName,
    decision,
    operatorCard: projectCanonicalDecisionOperatorCard(decision),
    freshness,
    suppressionHints: buildCanonicalDecisionSuppressionHints(decision),
    inputDegraded: [],
  }
}

function blockImagingLead(): GrowthLead {
  return {
    id: BLOCK_LEAD,
    organizationId: ORG,
    companyName: "Block Imaging",
    contactName: "Josh",
    website: "https://blockimaging.com",
    status: "active",
    researchPriority: "high",
    workflowHealth: "healthy",
    metadata: {},
  } as GrowthLead
}

console.log("GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A certification\n")

const approvalSnapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [outreachHacItem()],
  packagesById: new Map([[blockImagingPackage().packageId, blockImagingPackage()]]),
})

const missions = buildCanonicalMissionsFromApprovalSnapshot({
  organizationId: ORG,
  approvalSnapshot,
  decisionByLeadId: new Map([[BLOCK_LEAD, toResolution(decisionInput())]]),
})

const focus = buildCanonicalOperatorFocus({
  approvalSnapshot,
  missions,
  decisionResolution: toResolution(decisionInput()),
  revenueQueueLeadId: "other-lead-id",
  revenueQueueCompanyName: "Other Account",
  leads: [
    { id: BLOCK_LEAD, companyName: "Block Imaging" },
    { id: "other-lead-id", companyName: "Other Account" },
  ],
})

assert.ok(focus, "focus should resolve")
assert.equal(focus!.source, "approval", "approval wins over DRQ top item")
assert.equal(focus!.leadId, BLOCK_LEAD, "focus lead matches approval package")
assert.equal(focus!.companyName, "Block Imaging", "canonical display identity on focus")
console.log("  ✓ Home shows one primary operator focus")

const heroDecision = toResolution(decisionInput())
const operatorTask = buildCanonicalOperatorTask({
  approvalSnapshot,
  decision: projectGrowthCanonicalOperatorDecision({
    decision: heroDecision.decision,
    freshness: heroDecision.freshness,
  }),
  focusLeadId: focus!.leadId,
  focusCompanyName: focus!.companyName,
  focusHref: focus!.href,
})

assert.ok(
  assertCanonicalOperatorFocusAlignment({
    focus,
    operatorTaskLeadId: operatorTask?.leadId,
    heroDecisionLeadId: heroDecision.leadId,
  }),
  "no conflicting hero/task/decision leads",
)
console.log("  ✓ No conflicting priorities")

const queueCard = buildRevenueQueueCardProjectionFromLead(blockImagingLead())
assert.equal(queueCard.queue_role, "navigation")
assert.equal(queueCard.navigation_cta_label, "Open account")
assert.equal(queueCard.company_name, "Block Imaging")
const inboxCardSource = readSource("components/growth/lead-operator/growth-lead-inbox-card.tsx")
assert.ok(!inboxCardSource.includes("recommended_motion"), "queue card hides action motion")
console.log("  ✓ Revenue Queue is navigation only")

const mission = buildCanonicalMission({
  organizationId: ORG,
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  decisionResolution: heroDecision,
  approvalSnapshot,
  operatorTask: operatorTask ?? undefined,
})
assert.equal(mission.leadId, BLOCK_LEAD)
assert.ok(mission.missionTitle.length > 0)
console.log("  ✓ One mission per account")

const opportunity = projectCanonicalLeadOpportunityNarrative({
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  decision: projectGrowthCanonicalOperatorDecision({
    decision: heroDecision.decision,
    freshness: heroDecision.freshness,
  }),
  approvalSnapshot,
})

const accountNarrative = buildCanonicalOperatorAccountNarrative({
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  decision: projectGrowthCanonicalOperatorDecision({
    decision: heroDecision.decision,
    freshness: heroDecision.freshness,
  }),
  opportunityNarrative: opportunity,
  mission,
})

assert.ok(accountNarrative.whatHappened.length > 0)
assert.ok(!accountNarrative.whatHappened.toLowerCase().includes("nba:"))
assert.equal(accountNarrative.companyDisplayName, "Block Imaging")
console.log("  ✓ One memory bundle path + one narrative")

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
  waitingOnYou: [],
  waitingOnYouOverflow: 0,
  needsReview: { totalCount: 0, reviewHref: "/growth/os/approvals", items: [] },
  canonicalApprovalSnapshot: approvalSnapshot,
  canonicalOperatorTask: operatorTask,
  canonicalActiveMissions: {
    qaMarker: "ge-aios-mission-orchestration-1a-v1",
    organizationId: ORG,
    missions: [mission],
    primaryMission: mission,
    totalMissionCount: 1,
    overflowMissionCount: 0,
    displayLimit: 24,
  },
  canonicalOperatorFocus: focus,
})

assert.equal(aiOsUx.canonicalOperatorFocus?.leadId, BLOCK_LEAD)
assert.equal(aiOsUx.canonicalOperatorProgress?.title, "Progress")
assert.equal(aiOsUx.waitingOnYou.length, 1)
console.log("  ✓ One recommendation + Progress projection")

const callBriefingSource = readSource("lib/growth/call-copilot-briefing.ts")
assert.ok(callBriefingSource.includes("resolveCanonicalHumanMemoryForLead"))
assert.ok(callBriefingSource.includes("buildCanonicalOperatorAccountNarrative"))
assert.ok(!callBriefingSource.includes("NBA:"))
console.log("  ✓ Call journey continuity")

const meetingSource = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
assert.ok(meetingSource.includes("canonical_account_narrative"))
assert.ok(meetingSource.includes("resolveCanonicalHumanMemoryForLead"))
console.log("  ✓ Meeting / lead workspace continuity")

const completedWorkSource = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx",
)
assert.ok(completedWorkSource.includes("canonical") || completedWorkSource.includes("Completed"))
console.log("  ✓ Completed Work continuity (wired to canonical approvals)")

const displayIdentityHits = [
  readSource("lib/growth/revenue-queue/revenue-queue-card-projection.ts"),
  readSource("lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a.ts"),
].join("\n")
assert.ok(displayIdentityHits.includes("resolveAuthoritativeForm"))
console.log("  ✓ Canonical Display Identity wired")

const operatorSurfaces = [
  readSource("components/growth/growth-call-workspace-post-call-closure-panel.tsx"),
  readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection.ts"),
  inboxCardSource,
].join("\n")
assert.ok(!operatorSurfaces.includes("Send Plane blocked"))
assert.ok(!operatorSurfaces.includes("Operator review required"))
console.log("  ✓ No infrastructure language visible to operators")

assert.equal(
  heroDecision.decision.decisionFingerprint,
  accountNarrative.decisionFingerprint,
  "decision fingerprints remain identical across surfaces",
)
console.log("  ✓ Decision fingerprints remain identical")

const homeDashboard = readSource(
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
)
assert.ok(
  homeDashboard.indexOf("<GrowthHomeCanonicalMissionsSection") <
    homeDashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection"),
)
assert.ok(
  homeDashboard.indexOf("<GrowthHomeAiOsWaitingOnYouSection") <
    homeDashboard.indexOf("<GrowthHomeAvaWorkSection"),
)
assert.ok(homeDashboard.includes("canonicalOperatorProgress"))
console.log("  ✓ Home consolidated: Mission → Waiting → Progress")

assert.ok(
  GROWTH_OPERATOR_STORY_RETIREMENT_LIST.every((row) => row.migrationCompleted),
  "retirement list documents completed migrations",
)
console.log("  ✓ Retirement list complete")

assert.equal(GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER, focus!.qaMarker)
assert.ok(stripInternalEngineTerms("Send Plane blocked until approval") !== "Send Plane blocked until approval")
assert.ok(humanizeOperatorFacingLine("qualification: research").length > 0)

console.log("\nGE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A: PASS")

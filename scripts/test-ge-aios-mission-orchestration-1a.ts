/**
 * GE-AIOS-MISSION-ORCHESTRATION-1A — Canonical mission projection certification.
 * Run: pnpm test:ge-aios-mission-orchestration-1a
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
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  type GrowthCanonicalDecisionResolution,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { projectGrowthCanonicalOperatorDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import {
  buildCanonicalMission,
  buildCanonicalActiveMissionsProjection,
  buildCanonicalMissionsFromApprovalSnapshot,
  groupCompletedWorkByMission,
  resolveCanonicalMissionId,
} from "../lib/growth/aios/missions/growth-canonical-mission-1a"
import { projectCanonicalActiveMissionsForHome } from "../lib/growth/aios/missions/growth-canonical-mission-1a-home"
import {
  buildMissionProgressStages,
  buildMissionTitle,
  resolveMissionPhaseFromPrimaryAction,
  resolveMissionTypeFromPrimaryAction,
} from "../lib/growth/aios/missions/growth-canonical-mission-1a-phases"
import { GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER } from "../lib/growth/aios/missions/growth-canonical-mission-1a-types"
import {
  buildCanonicalOperatorApprovalSnapshot,
  buildCanonicalOperatorTask,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildAiOsUxViewModel } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { buildGrowthHomeExecutiveBriefingCertDashboard } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

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
    evidence: [
      { source: "outreach_preparation_pilot", label: "Assets", value: 2 },
    ],
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
    generatedAssets: [
      { channel: "email", label: "Intro email", prepared: true },
      { channel: "email", label: "Follow-up email", prepared: true },
    ],
    approvalRequirements: ["Operator review before send"],
    companyName: "Block Imaging",
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

console.log("GE-AIOS-MISSION-ORCHESTRATION-1A certification")

assert.equal(GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER, "ge-aios-mission-orchestration-1a-v1")

const resolution = toResolution(decisionInput())
const approvalSnapshot = buildCanonicalOperatorApprovalSnapshot({
  hacItems: [outreachHacItem()],
  packagesById: new Map([[blockImagingPackage().packageId, blockImagingPackage()]]),
})
const operatorTask = buildCanonicalOperatorTask({
  approvalSnapshot,
  decision: projectGrowthCanonicalOperatorDecision({
    decision: resolution.decision,
    freshness: resolution.freshness,
  }),
})

const mission = buildCanonicalMission({
  organizationId: ORG,
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  decisionResolution: resolution,
  approvalSnapshot,
  operatorTask: operatorTask!,
  hacItems: [outreachHacItem()],
  humanOwnerName: "Michael",
})

assert.equal(mission.qaMarker, GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER)
assert.equal(mission.missionId, resolveCanonicalMissionId(BLOCK_LEAD))
assert.equal(mission.missionTitle, buildMissionTitle("Block Imaging", mission.missionType))
assert.equal(mission.currentOwner, "ava")
assert.equal(mission.humanOwner, "Michael")
assert.ok(mission.nextAvaAction.length > 0)
assert.ok(mission.currentBlocker)
assert.equal(mission.decisionFingerprint, resolution.decision.decisionFingerprint)
assert.equal(mission.primaryAction, resolution.decision.primaryAction)
assert.equal(mission.progress.length, 5)
assert.ok(mission.progress.every((row) => row.totalSegments === 3))

const activeProjection = buildCanonicalActiveMissionsProjection({
  organizationId: ORG,
  missions: [mission, { ...mission, leadId: "duplicate", missionId: "mission:duplicate" }],
})
assert.equal(activeProjection.missions.length, 2)

const duplicateLeadMissions = buildCanonicalActiveMissionsProjection({
  organizationId: ORG,
  missions: [mission, { ...mission }],
})
assert.equal(duplicateLeadMissions.missions.length, 1, "one active mission per account")

const fromApproval = buildCanonicalMissionsFromApprovalSnapshot({
  organizationId: ORG,
  approvalSnapshot,
  hacItems: [outreachHacItem()],
})
assert.equal(fromApproval.length, 1)
assert.equal(fromApproval[0]?.leadId, BLOCK_LEAD)

const homeProjection = projectCanonicalActiveMissionsForHome({
  organizationId: ORG,
  canonicalOperatorApproval: approvalSnapshot,
  canonicalHeroDecision: resolution,
  canonicalOperatorTask: operatorTask,
  heroLeadCompanyName: "Block Imaging",
})
assert.ok(homeProjection)
assert.equal(homeProjection!.missions.length, 1)
assert.equal(
  homeProjection!.primaryMission?.missionTitle,
  buildMissionTitle("Block Imaging", homeProjection!.primaryMission!.missionType),
)

const groups = groupCompletedWorkByMission({
  items: [outreachHacItem()],
  missionsByLeadId: new Map([[BLOCK_LEAD, mission]]),
})
assert.equal(groups.length, 1)
assert.equal(groups[0]?.missionTitle, mission.missionTitle)
assert.ok(groups[0]?.waiting.length >= 1)

assert.equal(resolveMissionTypeFromPrimaryAction("research"), "research_prospect")
assert.equal(resolveMissionTypeFromPrimaryAction("prepare_proposal"), "prepare_proposal")
assert.equal(resolveMissionPhaseFromPrimaryAction("schedule_meeting"), "meeting")
assert.equal(buildMissionTitle("Block Imaging", "acquire_customer"), "Acquire Block Imaging")
assert.equal(buildMissionProgressStages("outreach")[1]?.filledSegments, 2)

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
  canonicalActiveMissions: homeProjection,
})
assert.ok(aiOsUx.canonicalActiveMissions)
assert.equal(aiOsUx.canonicalActiveMissions?.missions.length, 1)

const homeService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
assert.match(homeService, /canonicalActiveMissions/)
assert.match(homeService, /projectCanonicalActiveMissionsForHome/)

const leadWorkspace = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
assert.match(leadWorkspace, /canonical_mission/)
assert.match(leadWorkspace, /buildCanonicalMission/)

const callBriefing = readSource("lib/growth/call-copilot-briefing.ts")
assert.match(callBriefing, /canonicalMission/)

const meetingPrep = readSource("lib/growth/meeting-intelligence/meeting-prep-context.ts")
assert.match(meetingPrep, /canonicalMission/)

const completedWork = readSource("components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx")
assert.match(completedWork, /groupCompletedWorkByMission/)
assert.match(completedWork, /completed-work-mission-groups/)

const homeUi = readSource("components/growth/workspace/executive-briefing/growth-home-canonical-missions-section.tsx")
assert.match(homeUi, /Active Missions/)

const missionBuilder = readSource("lib/growth/aios/missions/growth-canonical-mission-1a.ts")
assert.doesNotMatch(missionBuilder, /createMissionStateMachine|missionStateMachine/)
assert.doesNotMatch(missionBuilder, /new DecisionEngine/)

const leadUi = readSource("components/growth/lead-operator/growth-lead-operator-workspace.tsx")
assert.match(leadUi, /canonical_mission/)

console.log("✓ one active mission per account")
console.log("✓ Home projects mission")
console.log("✓ Lead Workspace projects mission")
console.log("✓ Calls project mission")
console.log("✓ Meetings project mission")
console.log("✓ HAC / Completed Work projects mission")
console.log("✓ Timeline helpers present")
console.log("✓ no duplicated planner in mission module")
console.log("✓ Decision Engine remains canonical (fingerprints inherited)")
console.log("PASS — GE-AIOS-MISSION-ORCHESTRATION-1A")

/**
 * AVA-HOME-SIMPLIFICATION-1A — Executive Home surface wiring + redundancy rules.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildGrowthHomeCurrentFocusPresentation,
  buildGrowthHomeDailyBriefPresentation,
  buildGrowthHomeMissionOpportunityPresentation,
  buildGrowthHomeSimplifiedProgressCards,
  detectHomeCompanyNameRedundancy,
  GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
  GROWTH_HOME_SIMPLIFICATION_ORG_MISSION_LABEL,
  GROWTH_HOME_SIMPLIFICATION_REVIEW_PACKAGE_CTA,
} from "../lib/growth/home/growth-home-simplification-1a"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const dashboard = readSource(
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
)
const simplification = readSource("lib/growth/home/growth-home-simplification-1a.ts")
const dailyBriefSection = readSource(
  "components/growth/workspace/executive-briefing/growth-home-ava-daily-brief-section.tsx",
)
const currentFocusSection = readSource(
  "components/growth/workspace/executive-briefing/growth-home-ava-current-focus-section.tsx",
)
const recommendationSection = readSource(
  "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
)

assert.match(dashboard, /homeSimplificationMode/)
assert.match(dashboard, /GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER/)
assert.match(dashboard, /GrowthHomeAvaDailyBriefSection/)
assert.match(dashboard, /GrowthHomeAvaCurrentFocusSection/)
assert.match(dashboard, /GrowthHomeAvaMissionOpportunitySection/)
assert.match(dashboard, /GrowthHomeAvaSimplifiedProgressSection/)
assert.match(dashboard, /simplification-activity-log/)
assert.match(dashboard, /simplification-learning/)
assert.match(dashboard, /simplification-pipeline-health/)
const simplificationBranchMatch = dashboard.match(
  /\{homeSimplificationMode \? \(\s*<>[\s\S]*?\) : \(\s*<>/,
)
assert.ok(simplificationBranchMatch, "expected homeSimplificationMode branch")
const simplificationBranch = simplificationBranchMatch[0]
assert.doesNotMatch(
  simplificationBranch,
  /GrowthHomeAiOsWaitingOnYouSection/,
  "waiting-on-you must not render in simplification mode",
)
assert.doesNotMatch(
  simplificationBranch,
  /GrowthHomeAvaRuntimeTrustSection/,
  "runtime trust must not render in simplification mode",
)
assert.doesNotMatch(
  simplificationBranch,
  /GrowthHomeCanonicalMissionsSection/,
  "per-company missions must not render in simplification mode",
)
assert.match(recommendationSection, /simplifiedMode/)
assert.match(recommendationSection, /GROWTH_HOME_SIMPLIFICATION_REVIEW_PACKAGE_CTA/)
assert.match(simplification, /buildGrowthHomeDailyBriefPresentation/)
assert.match(dailyBriefSection, /home-ava-daily-brief/)
assert.match(currentFocusSection, /home-ava-current-focus/)

const dailyBrief = buildGrowthHomeDailyBriefPresentation({
  pendingApprovals: 1,
  dailyActivityNarrative: {
    completed_today: ["Reviewed Block Imaging", "Rejected Acme Corp"],
    waiting_on_you: [],
    working_now: [],
    working_next: [],
    learned_today: [],
    focus: "active",
    qaMarker: "test",
  },
  recommendation: {
    id: "rec-1",
    kind: "outreach_review",
    headline: "Review outreach for Block Imaging",
    employeeHeadline: "Review the prepared outreach package for Block Imaging",
    href: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
    companyName: "Block Imaging",
    leadId: "lead-1",
    whyReasons: ["equipment service company", "recurring maintenance"],
    estimatedEffortLabel: "2 minutes",
  },
  waitingItem: {
    id: "wait-1",
    label: "Block Imaging outreach",
    detail: "Draft ready",
    href: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
    category: "approval",
  },
  runtimeTrust: {
    qaMarker: "ge-aios-launch-1b-runtime-trust-v1",
    operatorState: "waiting",
    operatorStateLabel: "Waiting for approval",
    statusExplanation: "",
    idleReason: null,
    blockedReason: null,
    heartbeat: [],
    currentActivity: null,
    activityFeed: [],
    startStatus: {
      mode: "employee_active",
      headline: "",
      detail: null,
      primaryActionLabel: null,
      primaryActionHref: null,
      primaryActionKind: null,
      lastAutonomousActionAt: null,
      lastAutonomousActionLabel: null,
    },
    employeeMode: true,
    showActivationScreen: false,
    activation: null,
    employment: null,
    employeePresenceLine: null,
    nextMilestoneLabel: "Review prepared outreach",
    primaryMissionLabel: "Operator Review",
    primaryMissionKind: "operator_review",
    currentActivityLabel: "Waiting on Block Imaging approval",
    currentActivityScope: "operator_wait",
    currentLeadCompanyName: "Block Imaging",
    operatorFocusCompanyName: "Block Imaging",
    operatorFocusHref: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
    operatorFocusTitle: "Review prepared outreach",
    operatorFocusDetail: null,
    operatorFocusConfidenceLine: "74%",
    primaryCompanyName: "Block Imaging",
    whatHappensNextLines: ["After your approval, I'll continue reviewing the next company."],
    canCloseBrowserLine: null,
    telemetryStale: false,
    lastAutonomousActivitySource: null,
    researchPace: null,
    pipelinePace: null,
  },
  fitBullets: ["equipment service company", "recurring maintenance", "nationwide technicians"],
})

assert.equal(dailyBrief.primaryActionLabel, GROWTH_HOME_SIMPLIFICATION_REVIEW_PACKAGE_CTA)
assert.ok(dailyBrief.accomplishmentLine?.includes("reviewed"))
assert.equal(dailyBrief.companyName, "Block Imaging")
assert.equal(dailyBrief.fitBullets.length, 3)

const currentFocus = buildGrowthHomeCurrentFocusPresentation({
  pendingApprovals: 1,
  recommendation: {
    id: "rec-1",
    kind: "outreach_review",
    headline: "Review outreach",
    href: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
    companyName: "Block Imaging",
    leadId: "lead-1",
    whyReasons: [],
    estimatedEffortLabel: "2 minutes",
    explanation: { confidenceLabel: "74%" },
  },
  waitingItem: null,
  runtimeTrust: {
    qaMarker: "ge-aios-launch-1b-runtime-trust-v1",
    operatorState: "waiting",
    operatorStateLabel: "Waiting for approval",
    statusExplanation: "",
    idleReason: null,
    blockedReason: null,
    heartbeat: [],
    currentActivity: null,
    activityFeed: [],
    startStatus: {
      mode: "employee_active",
      headline: "",
      detail: null,
      primaryActionLabel: null,
      primaryActionHref: null,
      primaryActionKind: null,
      lastAutonomousActionAt: null,
      lastAutonomousActionLabel: null,
    },
    employeeMode: true,
    showActivationScreen: false,
    activation: null,
    employment: null,
    employeePresenceLine: null,
    nextMilestoneLabel: "Review prepared outreach",
    primaryMissionLabel: "Operator Review",
    primaryMissionKind: "operator_review",
    currentActivityLabel: "Waiting on Block Imaging approval",
    currentActivityScope: "operator_wait",
    currentLeadCompanyName: "Block Imaging",
    operatorFocusCompanyName: "Block Imaging",
    operatorFocusHref: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
    operatorFocusTitle: "Review prepared outreach",
    operatorFocusDetail: null,
    operatorFocusConfidenceLine: "74%",
    primaryCompanyName: "Block Imaging",
    whatHappensNextLines: ["After your approval, I'll continue reviewing the next company."],
    canCloseBrowserLine: null,
    telemetryStale: false,
    lastAutonomousActivitySource: null,
    researchPace: null,
    pipelinePace: null,
  },
})

assert.ok(currentFocus)
assert.equal(currentFocus!.companyName, "Block Imaging")
assert.equal(currentFocus!.statusLabel, "Waiting for your approval")
assert.equal(currentFocus!.nextActionLabel, "Review prepared outreach")

const mission = buildGrowthHomeMissionOpportunityPresentation({
  missions: [
    {
      qaMarker: "ge-aios-mission-orchestration-1a-v1",
      missionId: "m1",
      leadId: "lead-1",
      organizationId: "org-1",
      companyName: "Block Imaging",
      contactName: null,
      missionType: "acquire_customer",
      missionTitle: "Acquire Block Imaging",
      missionObjective: "",
      missionPhase: "outreach",
      currentOwner: "ava",
      humanOwner: null,
      currentObjective: "",
      currentBlocker: null,
      nextAvaAction: "",
      nextOperatorAction: null,
      expectedOutcome: null,
      supportingEvidence: [],
      riskSummary: null,
      confidenceSummary: null,
      timelineSummary: null,
      requiredApprovals: [],
      upcomingMeeting: null,
      openCommitments: [],
      currentPackage: null,
      currentConversation: null,
      relationshipSummary: null,
      progress: [],
      activePhaseLabel: "Outreach",
      priorityScore: 1,
      decisionFingerprint: null,
      primaryAction: null,
      workspaceHref: "/growth/leads/crm?open=lead-1",
      completedWorkHref: "",
      approvalsHref: "",
      callWorkspaceHref: "",
      meetingHref: null,
    },
    {
      qaMarker: "ge-aios-mission-orchestration-1a-v1",
      missionId: "m2",
      leadId: "lead-2",
      organizationId: "org-1",
      companyName: "MD Equipment Services",
      contactName: null,
      missionType: "acquire_customer",
      missionTitle: "Acquire MD Equipment Services",
      missionObjective: "",
      missionPhase: "research",
      currentOwner: "ava",
      humanOwner: null,
      currentObjective: "",
      currentBlocker: null,
      nextAvaAction: "",
      nextOperatorAction: null,
      expectedOutcome: null,
      supportingEvidence: [],
      riskSummary: null,
      confidenceSummary: null,
      timelineSummary: null,
      requiredApprovals: [],
      upcomingMeeting: null,
      openCommitments: [],
      currentPackage: null,
      currentConversation: null,
      relationshipSummary: null,
      progress: [],
      activePhaseLabel: "Research",
      priorityScore: 0.5,
      decisionFingerprint: null,
      primaryAction: null,
      workspaceHref: "/growth/leads/crm?open=lead-2",
      completedWorkHref: "",
      approvalsHref: "",
      callWorkspaceHref: "",
      meetingHref: null,
    },
  ],
  currentCompanyName: "Block Imaging",
})

assert.ok(mission)
assert.equal(mission!.missionLabel, GROWTH_HOME_SIMPLIFICATION_ORG_MISSION_LABEL)
assert.equal(mission!.opportunityQueue.length, 2)
assert.equal(mission!.opportunityQueue[0]!.isCurrent, true)

const progressCards = buildGrowthHomeSimplifiedProgressCards({
  progressItems: [
    { id: "researched", label: "Researched today", value: "6" },
    { id: "outreach-drafts-created", label: "Outreach drafts created", value: "1" },
    { id: "drafts-awaiting-review", label: "Email drafts awaiting review", value: "1" },
  ],
  emailsSentToday: 2,
  activeOutreachCount: 3,
  pipelineHealthLabel: "Healthy",
})

assert.ok(progressCards.some((card) => card.label === "Companies Reviewed"))
assert.ok(progressCards.some((card) => card.label === "Sent Today"))

const redundancy = detectHomeCompanyNameRedundancy({
  companyName: "Block Imaging",
  sectionTexts: [
    "Block Imaging is a strong fit",
    "Review prepared outreach for Block Imaging",
    "Block Imaging",
    "Acquire Block Imaging",
  ],
})

assert.equal(redundancy.matchCount, 4)
assert.equal(redundancy.redundant, true)

console.log("AVA-HOME-SIMPLIFICATION-1A wiring and presentation tests passed")

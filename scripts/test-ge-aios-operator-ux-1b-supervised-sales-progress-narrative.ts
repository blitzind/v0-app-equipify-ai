/**
 * GE-AIOS-OPERATOR-UX-1B — Supervised sales progress narrative certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  projectSupervisedSalesProgressNarrative,
  GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER,
} from "../lib/growth/aios/operator-experience/growth-supervised-sales-progress-narrative-1b"
import { buildGrowthReviewPackageHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "../lib/growth/home/growth-home-canonical-startup-experience-18d"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "../lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthAvaResearchLoopSummary } from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"

const ROOT = process.cwd()
const PACKAGE_ID = "outreach-prep:lead-1:2026"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function mockApprovalSnapshot(
  overrides?: Partial<GrowthCanonicalOperatorApprovalSnapshot>,
): GrowthCanonicalOperatorApprovalSnapshot {
  return {
    qaMarker: "ge-aios-operator-experience-1a-v1",
    outreachPackageCount: 0,
    outreachDraftCount: 0,
    pendingApprovalCount: 0,
    waitingForOperator: false,
    packages: [],
    topPackage: null,
    ...overrides,
  }
}

function mockMissionDiscovery(
  overrides?: Partial<GrowthHomeMissionDiscoverySnapshot>,
): GrowthHomeMissionDiscoverySnapshot {
  return {
    qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
    missionId: "mission-1",
    lifecycleState: "monitoring",
    activityLabel: "Monitoring",
    counters: {
      newCompaniesFound: 0,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 0,
      pendingApprovals: 0,
    },
    searchSummary: "medical imaging service companies",
    audienceName: "Medical imaging buyers",
    recordsImported: 0,
    newCompaniesFound: 0,
    leadPoolVisible: 12,
    leadPoolHasMore: true,
    pipelineLow: false,
    lastEventSummary: null,
    discoveryAction: "monitoring",
    startupDiscoveryReady: true,
    ...overrides,
  }
}

function mockResearchLoop(
  overrides?: Partial<GrowthAvaResearchLoopSummary>,
): GrowthAvaResearchLoopSummary {
  return {
    qaMarker: "ge-aios-6b-ava-research-orchestrator-v1",
    runId: "run-1",
    completedAt: new Date().toISOString(),
    companiesReviewed: 0,
    researchCompleted: 0,
    buyingSignalsVerified: 0,
    readyForOutreachReview: 0,
    qualificationCompleted: 0,
    qualificationSkipped: 0,
    qualificationFailed: 0,
    narrative: "",
    leadResults: [],
    transportBlocked: true,
    humanApprovalRequired: true,
    outboundOccurred: false,
    ...overrides,
  }
}

console.log(`[${GROWTH_SUPERVISED_SALES_PROGRESS_NARRATIVE_1B_QA_MARKER}] Supervised sales progress narrative tests`)

const noMission = projectSupervisedSalesProgressNarrative({ missionDiscovery: null })
assert.equal(noMission.primaryStage, "idle")
assert.equal(noMission.idleVariant, "no_mission")
assert.equal(noMission.href, GROWTH_HOME_STARTUP_STEP_PATHS.findLeads)
assert.equal(noMission.ctaLabel, "Find Leads")
console.log("  ✓ no mission routes to Find Leads")

const discovering = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery({
    lifecycleState: "finding_leads",
    discoveryAction: "run_prospect_search",
  }),
})
assert.equal(discovering.primaryStage, "discovering")
assert.match(discovering.headline, /discovering companies/i)
assert.doesNotMatch(discovering.headline, /pilot\/lead-research/)
console.log("  ✓ discovering uses mission discovery evidence")

const researching = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery({
    lifecycleState: "researching",
    counters: {
      newCompaniesFound: 0,
      recordsImported: 4,
      researchingCount: 4,
      draftsPrepared: 0,
      pendingApprovals: 0,
    },
  }),
})
assert.equal(researching.primaryStage, "researching")
assert.match(researching.headline, /Researching 4 companies/)
assert.match(researching.supportingSentence ?? "", /Not every researched company/)
console.log("  ✓ researching does not promise qualification")

const qualified = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery({ lifecycleState: "preparing_recommendations" }),
  researchLoopSummary: mockResearchLoop({
    leadResults: [
      {
        leadId: "lead-1",
        companyName: "Block Imaging",
        outcome: "completed",
        qualificationStatus: "completed",
        readyForOutreachReview: false,
      },
    ],
  }),
})
assert.equal(qualified.primaryStage, "qualified")
assert.match(qualified.headline, /Block Imaging is qualified/)
assert.match(qualified.supportingSentence ?? "", /ready for authorization/)
console.log("  ✓ qualified requires qualification evidence")

const packageReady = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery({
    counters: {
      newCompaniesFound: 0,
      recordsImported: 1,
      researchingCount: 0,
      draftsPrepared: 1,
      pendingApprovals: 0,
    },
  }),
  researchLoopSummary: mockResearchLoop({ readyForOutreachReview: 1 }),
})
assert.equal(packageReady.primaryStage, "package_ready")
assert.match(packageReady.headline, /ready for your review/)
console.log("  ✓ package ready uses draft/reviewable evidence")

const waiting = projectSupervisedSalesProgressNarrative({
  approvalSnapshot: mockApprovalSnapshot({
    pendingApprovalCount: 1,
    waitingForOperator: true,
    outreachPackageCount: 1,
    topPackage: {
      itemId: "item-1",
      packageId: PACKAGE_ID,
      leadId: "lead-1",
      companyName: "Block Imaging",
      decisionMaker: null,
      draftCount: 2,
      preparedAt: new Date().toISOString(),
      preparedAgoLabel: null,
      channelLabel: "Email sequence",
      statusLabel: "Waiting for approval",
      reviewHref: buildGrowthReviewPackageHref(PACKAGE_ID),
    },
  }),
  missionDiscovery: mockMissionDiscovery({
    lifecycleState: "researching",
    counters: {
      newCompaniesFound: 0,
      recordsImported: 4,
      researchingCount: 3,
      draftsPrepared: 1,
      pendingApprovals: 1,
    },
  }),
})
assert.equal(waiting.primaryStage, "waiting_for_authorization")
assert.match(waiting.headline, /Block Imaging is waiting for your authorization/)
assert.equal(waiting.href, buildGrowthReviewPackageHref(PACKAGE_ID))
assert.match(waiting.secondaryContext ?? "", /researching 3 additional companies/)
assert.equal(waiting.headlineSuppressed, true)
console.log("  ✓ waiting package outranks research and deep-links Review drawer")

const waitingPlusResearch = projectSupervisedSalesProgressNarrative({
  approvalSnapshot: mockApprovalSnapshot({
    pendingApprovalCount: 1,
    waitingForOperator: true,
    outreachPackageCount: 1,
    topPackage: {
      itemId: "item-1",
      packageId: PACKAGE_ID,
      leadId: "lead-1",
      companyName: "Block Imaging",
      decisionMaker: null,
      draftCount: 2,
      preparedAt: new Date().toISOString(),
      preparedAgoLabel: null,
      channelLabel: "Email sequence",
      statusLabel: "Waiting for approval",
      reviewHref: buildGrowthReviewPackageHref(PACKAGE_ID),
    },
  }),
  missionDiscovery: mockMissionDiscovery({
    lifecycleState: "researching",
    counters: {
      newCompaniesFound: 0,
      recordsImported: 4,
      researchingCount: 4,
      draftsPrepared: 1,
      pendingApprovals: 1,
    },
  }),
})
assert.equal(waitingPlusResearch.primaryStage, "waiting_for_authorization")
assert.match(waitingPlusResearch.secondaryContext ?? "", /researching 4 additional/)
console.log("  ✓ authorization first with research secondary")

const noQualifiedBatch = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery(),
  researchLoopSummary: mockResearchLoop({
    researchCompleted: 6,
    qualificationCompleted: 0,
    companiesReviewed: 6,
  }),
})
assert.equal(noQualifiedBatch.primaryStage, "idle")
assert.equal(noQualifiedBatch.idleVariant, "no_qualified_results")
assert.match(noQualifiedBatch.headline, /none met the qualification threshold/)
assert.equal(noQualifiedBatch.ctaLabel, "Find Leads")
console.log("  ✓ no qualified batch uses honest result copy")

const avaWorking = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery({
    lifecycleState: "monitoring",
    discoveryAction: "monitoring",
  }),
})
assert.equal(avaWorking.primaryStage, "idle")
assert.equal(avaWorking.idleVariant, "ava_working")
assert.match(avaWorking.headline, /Nothing needs your attention/)
console.log("  ✓ active mission idle state is calm")

const researchCompleteNotQualified = projectSupervisedSalesProgressNarrative({
  missionDiscovery: mockMissionDiscovery({ lifecycleState: "researching" }),
  researchLoopSummary: mockResearchLoop({
    researchCompleted: 2,
    leadResults: [
      {
        leadId: "lead-1",
        companyName: "Acme",
        outcome: "completed",
        qualificationStatus: "skipped",
      },
    ],
  }),
})
assert.notEqual(researchCompleteNotQualified.primaryStage, "qualified")
console.log("  ✓ research completion alone is not labeled qualified")

const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
assert.match(heroSource, /projectSupervisedSalesProgressNarrative/)
const heroUi = readSource("components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx")
assert.match(heroUi, /data-qa-section="supervised-sales-progress"/)
assert.match(heroUi, /headlineSuppressed/)
const workSection = readSource("components/growth/workspace/executive-briefing/growth-home-ava-work-section.tsx")
assert.match(workSection, /GROWTH_HOME_STARTUP_STEP_PATHS\.findLeads/)
assert.doesNotMatch(workSection, /GROWTH_TRAINING_COMPANY_PROFILE_ROUTE/)
console.log("  ✓ Home wiring renders narrative and avoids Training default")

for (const narrative of [waiting, discovering, researching, qualified, packageReady, noMission]) {
  assert.doesNotMatch(narrative.headline, /few minutes|usually takes|ready shortly/i)
  assert.doesNotMatch(narrative.supportingSentence ?? "", /few minutes|usually takes|ready shortly/i)
  assert.doesNotMatch(narrative.href ?? "", /pilot\/lead-research/)
}
console.log("  ✓ copy avoids unsupported timing promises and research pilot routes")

console.log("\nAll supervised sales progress narrative tests passed.")

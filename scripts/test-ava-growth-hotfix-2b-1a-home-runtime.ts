/**
 * AVA-GROWTH-HOTFIX-2B-1A — Home runtime latency and false empty-state elimination.
 * Run: pnpm test:ava-growth-hotfix-2b-1a-home-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  AVA_GROWTH_HOTFIX_2B_1A_QA_MARKER,
  GROWTH_HOME_EXECUTIVE_UNAVAILABLE_MESSAGE,
  GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS,
  buildGrowthHomeExecutiveLoadMetadata,
  isGrowthHomeExecutiveLoadDegraded,
  isGrowthHomeExecutiveSourceUnavailable,
  resolveGrowthHomeExecutiveApprovalsAvailability,
} from "../lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { synthesizeGrowthHomeExecutiveBriefing } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"
import { resolveOperatorPackageReviewHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function emptyDashboard() {
  return buildGrowthWorkspaceDashboardViewModel({
    briefing: null,
    leadInboxSections: [],
    cadenceSummary: null,
    pipelineDashboard: null,
    opportunityReadiness: null,
    sequenceFoundation: null,
    sequenceExecution: null,
    engagementWorkspace: null,
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
    dailyRevenueWorkQueueEnabled: false,
    dailyRevenueWorkQueue: null,
    dailyRevenueWorkQueueDisplay: null,
  })
}

console.log(`[${AVA_GROWTH_HOTFIX_2B_1A_QA_MARKER}] Home runtime hotfix certification`)

// R2/R5 — critical executive load module
assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS, 12_000)
assert.ok(GROWTH_HOME_EXECUTIVE_UNAVAILABLE_MESSAGE.includes("still loading"))
assert.equal(
  resolveGrowthHomeExecutiveApprovalsAvailability({
    loaded: false,
    timedOut: true,
    pendingApprovalCount: 0,
  }),
  "unavailable",
)
assert.equal(
  resolveGrowthHomeExecutiveApprovalsAvailability({
    loaded: true,
    timedOut: false,
    pendingApprovalCount: 3,
  }),
  "confirmed",
)
assert.equal(
  resolveGrowthHomeExecutiveApprovalsAvailability({
    loaded: true,
    timedOut: false,
    pendingApprovalCount: 0,
  }),
  "confirmed_empty",
)

const degradedLoad = buildGrowthHomeExecutiveLoadMetadata({
  criticalStageMs: 1200,
  secondaryStageMs: 4800,
  approvals: "unavailable",
  training: "confirmed",
})
assert.equal(isGrowthHomeExecutiveSourceUnavailable(degradedLoad.approvals), true)
assert.equal(isGrowthHomeExecutiveLoadDegraded(degradedLoad), true)

// R3 — unavailable approvals must not synthesize Idle
const unavailableBriefing = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: emptyDashboard(),
  executiveLoad: degradedLoad,
  canonicalOperatorApproval: null,
})
assert.notEqual(unavailableBriefing.employeeStatus.kind, "idle")
assert.equal(unavailableBriefing.employeeStatus.kind, "working")

// R3 — confirmed empty may still be idle
const confirmedEmptyBriefing = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: emptyDashboard(),
  executiveLoad: buildGrowthHomeExecutiveLoadMetadata({
    criticalStageMs: 800,
    approvals: "confirmed_empty",
    training: "confirmed_empty",
    activation: "confirmed_empty",
    missions: "confirmed_empty",
    recommendation: "confirmed_empty",
  }),
  canonicalOperatorApproval: {
    qaMarker: "growth-aios-operator-experience-1a-v1",
    outreachPackageCount: 0,
    outreachDraftCount: 0,
    pendingApprovalCount: 0,
    waitingForOperator: false,
    packages: [],
    topPackage: null,
  },
})
assert.equal(confirmedEmptyBriefing.employeeStatus.kind, "idle")

// R5/R7 — server critical stage wired before secondary fan-out
const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const criticalStageIndex = summaryService.indexOf("loadGrowthHomeCriticalExecutiveStage")
const approvalLoaderIndex = summaryService.indexOf("emptyCanonicalOperatorApprovalSnapshot()")
assert.ok(criticalStageIndex >= 0)
assert.ok(criticalStageIndex < approvalLoaderIndex)
assert.match(summaryService, /executiveLoad/)
assert.match(summaryService, /approvalsAvailability === "unavailable"/)
assert.match(summaryService, /loadGrowthHomeCriticalExecutiveStage/)

const criticalStageServer = readSource("lib/growth/home/growth-home-critical-executive-stage-server-2b-1a.ts")
assert.match(criticalStageServer, /critical_canonical_operator_approval/)
assert.match(criticalStageServer, /critical_canonical_organization_training/)
assert.match(criticalStageServer, /Promise\.all/)

// R9 — client preserves state, shorter timeout, request sequencing
const clientHook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
assert.match(clientHook, /GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS/)
assert.match(clientHook, /readGrowthHomeExecutiveSessionCache/)
assert.match(clientHook, /writeGrowthHomeExecutiveSessionCache/)
assert.match(clientHook, /requestSequenceRef/)
assert.match(clientHook, /workspaceSummaryRef\.current/)
assert.doesNotMatch(clientHook, /GROWTH_HOME_WORKSPACE_SUMMARY_FETCH_TIMEOUT_MS\s*=\s*45_000/)
assert.doesNotMatch(clientHook, /setWorkspaceSummary\(null\)/)

const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
assert.match(dashboardBody, /GROWTH_HOME_EXECUTIVE_UNAVAILABLE_MESSAGE/)

// R6 — ai-teammate GET returns default identity instead of 500
const aiTeammateRoute = readSource("app/api/growth/workspace/settings/ai-teammate/route.ts")
assert.match(aiTeammateRoute, /defaultAiTeammateIdentity/)
assert.match(aiTeammateRoute, /degraded:\s*true/)
assert.doesNotMatch(aiTeammateRoute, /ai_teammate_identity_load_failed.*500/s)

// R8 — no 45s critical path; approval budget bounded
const loaderBudget = readSource("lib/growth/home/growth-home-workspace-loader-budget.ts")
assert.match(loaderBudget, /GROWTH_HOME_APPROVAL_SNAPSHOT_LOADER_BUDGET_MS\s*=\s*8_000/)
assert.ok(GROWTH_HOME_WORKSPACE_SUMMARY_CLIENT_TIMEOUT_MS <= 12_000)

// R10 — 2B routing + training untouched
assert.match(
  resolveOperatorPackageReviewHref({
    leadId: "lead-1",
    packageId: "pkg-1",
  }),
  /tab=packages&item=pkg-1/,
)

const trainingHotfix = readSource(
  "lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix.ts",
)
assert.match(trainingHotfix, /loadGrowthCanonicalOrganizationTrainingProjection/)

console.log(`[${AVA_GROWTH_HOTFIX_2B_1A_QA_MARKER}] PASS`)

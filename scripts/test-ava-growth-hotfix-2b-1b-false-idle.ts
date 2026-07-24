/**
 * AVA-GROWTH-HOTFIX-2B-1B — False Idle elimination on first load.
 * Run: pnpm test:ava-growth-hotfix-2b-1b-false-idle
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  AVA_GROWTH_HOTFIX_2B_1B_QA_MARKER,
  canSynthesizeGrowthHomeExecutiveIdle,
  resolveGrowthHomeExecutiveApprovalsAvailability,
} from "../lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { synthesizeGrowthHomeExecutiveBriefing } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"

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

console.log(`[${AVA_GROWTH_HOTFIX_2B_1B_QA_MARKER}] False Idle elimination certification`)

// Loader failure (null snapshot, no timeout) must not become confirmed_empty.
assert.equal(
  resolveGrowthHomeExecutiveApprovalsAvailability({
    loaded: false,
    timedOut: false,
    pendingApprovalCount: 0,
  }),
  "unavailable",
)

assert.equal(
  canSynthesizeGrowthHomeExecutiveIdle({
    executiveLoad: {
      qaMarker: "ava-growth-hotfix-2b-1a-home-runtime-v1",
      criticalStageMs: 1,
      secondaryStageMs: 1,
      approvals: "unavailable",
      training: "unavailable",
      activation: "unavailable",
      missions: "unavailable",
      recommendation: "unavailable",
    },
    canonicalOperatorApproval: null,
  }),
  false,
)

const loaderFailureBriefing = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: emptyDashboard(),
  executiveLoad: {
    qaMarker: "ava-growth-hotfix-2b-1a-home-runtime-v1",
    criticalStageMs: 1,
    secondaryStageMs: 1,
    approvals: "unavailable",
    training: "unavailable",
    activation: "unavailable",
    missions: "unavailable",
    recommendation: "unavailable",
  },
  canonicalOperatorApproval: null,
})
assert.notEqual(loaderFailureBriefing.employeeStatus.kind, "idle")

const firstLoadWithoutPayload = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: emptyDashboard(),
  canonicalOperatorApproval: null,
})
assert.notEqual(firstLoadWithoutPayload.employeeStatus.kind, "idle")

const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
assert.doesNotMatch(summaryService, /emptyCanonicalOperatorApprovalSnapshot/)
assert.match(summaryService, /growth_home_first_load_executive_state/)

const criticalStage = readSource("lib/growth/home/growth-home-critical-executive-stage-server-2b-1a.ts")
assert.match(criticalStage, /growth_home_critical_executive_approval_stage/)

const clientHook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
assert.doesNotMatch(clientHook, /buildGrowthWorkspaceDashboardViewModel\(EMPTY_SOURCES\)/)

const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
assert.match(dashboardBody, /data-growth-home-executive-unavailable="true"/)

console.log(`[${AVA_GROWTH_HOTFIX_2B_1B_QA_MARKER}] PASS`)

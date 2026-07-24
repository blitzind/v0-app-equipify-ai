/**
 * AVA-GROWTH-HOTFIX-2B-1C — Home critical load recovery certification.
 * Run: pnpm test:ava-growth-hotfix-2b-1c-home-critical-recovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
  GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH,
  isGrowthHomeCriticalExecutiveLoadActionable,
  mergeGrowthHomeWorkspaceSummaryWithCriticalState,
} from "../lib/growth/home/growth-home-critical-executive-state-2b-1c"
import { canSynthesizeGrowthHomeExecutiveIdle } from "../lib/growth/home/growth-home-critical-executive-load-2b-1a"
import { resolveOperatorPackageReviewHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER}] Home critical recovery certification`)

assert.equal(
  GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH,
  "/api/platform/growth/home/critical-executive-state",
)

const approvalSummaryLoader = readSource(
  "lib/growth/aios/operator-experience/growth-canonical-operator-approval-summary-loader-2b-1c.ts",
)
assert.match(approvalSummaryLoader, /loadCanonicalOperatorApprovalSummaryForHome/)
assert.match(approvalSummaryLoader, /collectOutreachPackageApprovalItems/)
assert.doesNotMatch(approvalSummaryLoader, /fetchGrowthHumanApprovalCenterReadModel/)
assert.doesNotMatch(approvalSummaryLoader, /hydrateCanonicalPortfolioAuthority/)

const criticalRoute = readSource("app/api/platform/growth/home/critical-executive-state/route.ts")
assert.match(criticalRoute, /buildGrowthHomeCriticalExecutiveState/)

const criticalServer = readSource("lib/growth/home/growth-home-critical-executive-state-server-2b-1c.ts")
assert.match(criticalServer, /lightweightApprovalLoader:\s*true/)
assert.match(criticalServer, /growth_home_critical_executive_state/)

const clientHook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
assert.match(clientHook, /GROWTH_HOME_CRITICAL_EXECUTIVE_STATE_API_PATH/)
assert.match(clientHook, /requestGenerationRef/)
assert.match(clientHook, /criticalAbortRef/)
assert.match(clientHook, /abortInflightRequests/)
assert.match(clientHook, /retry=\$\{attempt\}/)
assert.match(clientHook, /loadSecondaryWorkspaceSummary/)
assert.match(clientHook, /GROWTH_HOME_SECONDARY_WORKSPACE_SUMMARY_TIMEOUT_MS/)
assert.doesNotMatch(clientHook, /buildGrowthWorkspaceDashboardViewModel\(EMPTY_SOURCES\)/)

const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
assert.match(summaryService, /lightweightApprovalLoader:\s*true/)

const criticalStage = readSource("lib/growth/home/growth-home-critical-executive-stage-server-2b-1a.ts")
assert.match(criticalStage, /loadCanonicalOperatorApprovalSummaryForHome/)
assert.match(criticalStage, /lightweightApprovalLoader/)

assert.equal(
  isGrowthHomeCriticalExecutiveLoadActionable({
    availability: "partial",
    pendingApprovalCount: 3,
    packages: [],
    confirmedFields: ["approvals"],
    unavailableFields: ["training"],
  }),
  true,
)

assert.equal(canSynthesizeGrowthHomeExecutiveIdle({ executiveLoad: { approvals: "unavailable" } as never }), false)

const merged = mergeGrowthHomeWorkspaceSummaryWithCriticalState({
  existing: null,
  critical: {
    ok: true,
    qaMarker: AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER,
    generatedAt: new Date().toISOString(),
    requestGeneration: 1,
    retryAttempt: 1,
    criticalLoad: {
      availability: "confirmed",
      pendingApprovalCount: 2,
      packages: [
        {
          packageId: "pkg-1",
          leadId: "lead-1",
          companyName: "Acme",
          reviewHref: "/growth/review?tab=packages&item=pkg-1",
          statusLabel: "Waiting for approval",
        },
      ],
    },
    canonicalOperatorApproval: {
      qaMarker: "ge-aios-operator-experience-1a-v1",
      outreachPackageCount: 2,
      outreachDraftCount: 2,
      pendingApprovalCount: 2,
      waitingForOperator: true,
      packages: [],
      topPackage: null,
    },
    canonicalOperatorTask: null,
    canonicalActiveMissions: null,
    canonicalOrganizationTraining: null,
    avaActivation: null,
    executiveLoad: {
      qaMarker: "ava-growth-hotfix-2b-1a-home-runtime-v1",
      criticalStageMs: 100,
      secondaryStageMs: null,
      approvals: "confirmed",
      training: "unavailable",
      activation: "unavailable",
      missions: "confirmed_empty",
      recommendation: "confirmed_empty",
    },
    stageTimingsMs: { critical_executive_state_wall: 100 },
  },
})
assert.equal(merged.kpis.approvalQueueCount, 2)
assert.equal(merged.operatorTasks.pendingApprovals, 2)

assert.match(
  resolveOperatorPackageReviewHref({ leadId: "lead-1", packageId: "pkg-1" }),
  /tab=packages&item=pkg-1/,
)

console.log(`[${AVA_GROWTH_HOTFIX_2B_1C_QA_MARKER}] PASS`)

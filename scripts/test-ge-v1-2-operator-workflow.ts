/**
 * GE-v1-2 — Operator workflow & analytics certification.
 * Run: pnpm test:ge-v1-2-operator-workflow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"
import { evaluateSequenceExecutionOperatorWarnings } from "../lib/growth/sequences/execution/sequence-execution-operator-warnings"
import {
  GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER,
} from "../lib/growth/operational/ge-v1-2-operator-setup-health-types"
import {
  GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER,
} from "../lib/growth/engagement/growth-unified-engagement-read-types"
import {
  GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER,
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER,
  GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"
import { GROWTH_WORKSPACE_DASHBOARD_QA_MARKER } from "../lib/growth/workspace/growth-workspace-dashboard-types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GE-v1-2 Operator Workflow & Analytics Certification ===\n")

  assert.equal(GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER, "growth-workspace-sidebar-ia-v4")
  assert.equal(GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER, "growth-workspace-shell-nav-v9")
  assert.equal(GROWTH_WORKSPACE_DASHBOARD_QA_MARKER, "growth-workspace-dashboard-v4")
  assert.equal(GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER, "ge-v1-2-operator-setup-health-v1")
  assert.equal(GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER, "ge-v1-2-unified-engagement-read-v1")

  const manifestIds = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.id))
  assert.deepEqual(manifestIds, [...GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS])
  assert.ok(manifestIds.includes("settings"))
  assert.ok(manifestIds.includes("runbook"))
  assert.ok(!manifestIds.includes("share-pages"))
  assert.ok(!manifestIds.includes("media-assets"))
  assert.ok(!manifestIds.includes("automation-flows"))
  console.log("  ✓ GE-v1-2 sidebar IA promotes daily operator routes")

  const engagementPage = readSource("app/(growth)/growth/engagement/page.tsx")
  assert.match(engagementPage, /GrowthUnifiedEngagementFeed/)
  assert.match(engagementPage, /GrowthEngagementCommandCenter/)
  assert.doesNotMatch(engagementPage, /GrowthEngagementDashboardPanel/)
  console.log("  ✓ Engagement page uses unified feed + command center")

  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(dashboardBody, /GrowthOperatorSetupHealthPanel/)
  assert.match(dashboardBody, /operator-action-cards/)
  console.log("  ✓ Operator dashboard exposes setup health and action cards")

  const launchComplete = readSource("components/growth/sendr/growth-sendr-launch-complete-step.tsx")
  assert.match(launchComplete, /Recommended next steps/)
  assert.match(launchComplete, /\/growth\/campaigns\/sequences/)
  assert.match(launchComplete, /\/growth\/engagement/)
  assert.match(launchComplete, /\/growth\/meetings/)
  console.log("  ✓ Launch complete step guides post-launch workflow")

  const approvalUi = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
  assert.match(approvalUi, /Stale approval/)
  assert.match(approvalUi, /Cert\/test job/)
  console.log("  ✓ Approval queue surfaces stale/cert warnings")

  const warnings = evaluateSequenceExecutionOperatorWarnings({
    status: "pending_approval",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    sequenceLabel: "SR-3 cert enrollment",
    qaDeliverabilityBypassUsed: true,
  })
  assert.equal(warnings.isStaleApproval, true)
  assert.equal(warnings.isCertOrTestJob, true)
  assert.ok(warnings.operatorWarnings.length >= 2)
  console.log("  ✓ Sequence operator warning heuristics")

  const viewModel = buildGrowthWorkspaceDashboardViewModel({
    briefing: null,
    leadInboxSections: [],
    cadenceSummary: null,
    pipelineDashboard: null,
    opportunityReadiness: null,
    sequenceFoundation: { templates: [{ status: "active" }], dashboard: { active_count: 2 } },
    sequenceExecution: { pendingApproval: 3, sent24h: 1 },
    engagementWorkspace: { highIntent: { cards: [{}] } },
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
  })
  assert.ok(viewModel.operatorActionCards.some((card) => card.id === "approve-sends"))
  assert.ok(
    viewModel.sections
      .find((section) => section.id === "campaign-snapshot")
      ?.metrics.some((metric) => metric.href.includes("/campaigns/sequences")),
  )
  console.log("  ✓ Dashboard mapper links approvals to sequence execution")

  for (const file of [
    "lib/growth/operational/ge-v1-2-operator-setup-health-service.ts",
    "lib/growth/engagement/growth-unified-engagement-read-service.ts",
    "app/api/platform/growth/operator-setup-health/route.ts",
    "app/api/platform/growth/engagement/unified-feed/route.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `missing ${file}`)
  }
  console.log("  ✓ GE-v1-2 read services and API routes exist")

  console.log("\nGE-v1-2 operator workflow & analytics certification passed.\n")
}

main()

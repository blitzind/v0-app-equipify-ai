/**
 * Growth workspace operator home dashboard audit (Phase 6A — local only).
 *
 * Usage: pnpm test:growth-workspace-dashboard
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"
import { GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS } from "../lib/growth/workspace/growth-workspace-dashboard-quick-actions"
import {
  GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
  type GrowthWorkspaceDashboardSection,
} from "../lib/growth/workspace/growth-workspace-dashboard-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_WORKSPACE_DASHBOARD_TEST_QA_MARKER = "growth-workspace-dashboard-test-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const REQUIRED_SECTION_IDS = [
  "my-queue",
  "activity",
  "pipeline-snapshot",
  "campaign-snapshot",
  "intelligence",
  "quick-actions",
] as const

const WORKSPACE_DASHBOARD_FILES = [
  "app/(growth)/growth/page.tsx",
  "components/growth/workspace/growth-workspace-dashboard-body.tsx",
  "components/growth/growth-operator-briefing-compact.tsx",
  "components/growth/workspace/use-growth-workspace-dashboard.ts",
  "lib/growth/workspace/growth-workspace-dashboard-mapper.ts",
  "lib/growth/workspace/growth-workspace-briefing-links.ts",
  "lib/growth/workspace/growth-workspace-dashboard-quick-actions.ts",
  "lib/growth/workspace/growth-workspace-dashboard-types.ts",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace dashboard audit (${GROWTH_WORKSPACE_DASHBOARD_TEST_QA_MARKER}) ===\n`)

  for (const file of WORKSPACE_DASHBOARD_FILES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `missing workspace dashboard file: ${file}`)
  }
  console.log("  ✓ workspace dashboard module files exist")

  const pageSource = readSource("app/(growth)/growth/page.tsx")
  assert.match(pageSource, /GrowthWorkspacePageHeader/)
  assert.match(pageSource, /GrowthWorkspaceDashboardBody/)
  assert.doesNotMatch(pageSource, /GrowthSectionLayout|PlatformAdminPageShell/)
  console.log("  ✓ /growth page remains thin workspace shell (header + body)")

  const bodySource = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(bodySource, /GrowthHomeExecutiveBriefingDashboard/)
  assert.match(bodySource, /data-qa-marker=\{GROWTH_WORKSPACE_DASHBOARD_QA_MARKER\}/)
  assert.match(bodySource, /data-section="recent-activity"/)
  assert.match(bodySource, /data-section="continue-working"/)
  console.log("  ✓ dashboard uses executive briefing with collapsible secondary tools")

  const hookSource = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(hookSource, /Promise\.all\(/)
  assert.equal((hookSource.match(/fetch\(/g) ?? []).length, 1, "hook should centralize fetch in one helper")
  assert.doesNotMatch(hookSource, /\/admin\/growth\//)
  console.log("  ✓ single batched fetch; no hardcoded admin routes in hook")

  for (const file of WORKSPACE_DASHBOARD_FILES) {
    const source = readSource(file)
    assert.doesNotMatch(source, /\/admin\/growth\//, `${file} must not hardcode admin growth routes`)
  }
  for (const action of GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS) {
    assert.ok(action.href.startsWith(GROWTH_WORKSPACE_BASE_PATH), `quick action must use workspace path: ${action.id}`)
  }
  console.log("  ✓ quick actions and dashboard links stay under /growth/*")

  const emptyModel = buildGrowthWorkspaceDashboardViewModel({
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
  })
  assert.equal(emptyModel.qaMarker, GROWTH_WORKSPACE_DASHBOARD_QA_MARKER)
  assert.equal(emptyModel.briefing, null)
  assert.equal(emptyModel.welcome.greeting, "Welcome back")
  assert.deepEqual(
    emptyModel.sections.map((section) => section.id),
    [...REQUIRED_SECTION_IDS],
  )
  for (const section of emptyModel.sections) {
    if (section.id === "quick-actions") continue
    assert.ok(section.emptyMessage, `empty state missing for ${section.id}`)
    assert.equal(section.metrics.length, 4, `${section.id} should expose four metrics`)
  }
  console.log("  ✓ mapper produces graceful empty states for all metric sections")

  const populatedModel = buildGrowthWorkspaceDashboardViewModel({
    briefing: {
      qa_marker: "aiden-daily-briefing-v1",
      greeting: "Good morning",
      operator_name: "Operator",
      generated_at: new Date().toISOString(),
      summary: {
        mailbox_label: "Healthy",
        pending_approvals: 2,
        replies_needing_attention: 3,
        meetings_today: 1,
        blocked_jobs: 0,
        drafts_awaiting_review: 1,
        recommended_action: "Review inbox replies first.",
      },
      inbox: {
        new_replies: 1,
        replies_needing_attention: 3,
        positive_interest: 1,
        meeting_requests: 1,
        objections: 0,
        unsubscribes: 0,
      },
      mailbox: { healthy_mailboxes: 1, expired_mailboxes: 0, warnings: 0 },
      approval_queue: { pending_drafts: 1, pending_jobs: 1, blocked_jobs: 0, running_jobs: 0 },
      meetings: { meetings_today: 1, meetings_this_week: 2, opportunities_pending: 4 },
      revenue: { emails_sent: 5, replies: 2, meetings: 1, opportunities: 4, revenue: 1000 },
      priorities: [],
      section_summaries: {
        inbox: "",
        mailbox: "",
        approval_queue: "",
        meetings: "",
        revenue: "",
      },
    },
    leadInboxSections: [
      { id: "high_priority", items: [{ id: "1" }] },
      { id: "needs_review", items: [{ id: "2" }, { id: "3" }] },
    ],
    cadenceSummary: {
      qaMarker: "multi-channel-cadence-v1",
      tasksDueTodayCount: 2,
      overdueCadenceTasksCount: 0,
      callTasksDueCount: 4,
      linkedinTasksDueCount: 0,
      meetingFollowupsDueCount: 0,
    },
    pipelineDashboard: {
      qaMarker: "growth-opportunity-pipeline-v1",
      pipelineByStage: [{ stageKey: "discovery", stageLabel: "Discovery", count: 2, amount: 10000, weightedAmount: 5000 }],
      forecastTotals: {
        commit: { count: 1, amount: 5000, weightedAmount: 4000 },
        best_case: { count: 1, amount: 8000, weightedAmount: 6000 },
        pipeline: { count: 2, amount: 10000, weightedAmount: 7000 },
        omitted: { count: 0, amount: 0, weightedAmount: 0 },
      },
      weightedPipeline: 7000,
      openPipeline: 10000,
      wonRevenue: 0,
      lostRevenue: 0,
      averageDealAgeDays: 10,
      dealsNeedingAction: 2,
      staleOpportunityCount: 0,
      atRiskCount: 1,
      ownerPerformance: [],
    },
    opportunityReadiness: { averageReadiness: 72, executiveCloseCandidates: [{ id: "lead-1" }] },
    sequenceFoundation: {
      dashboard: { active_count: 3 },
      templates: [{ status: "active" }, { status: "draft" }],
    },
    sequenceExecution: { pendingApproval: 2, sent24h: 6 },
    engagementWorkspace: { highIntent: { cards: [{ cardId: "1" }] }, alerts: { total: 1 } },
    conversationDashboard: { conversationRisk: [{ id: "c1" }] },
    relationshipDashboard: { executiveAttentionRequired: [{ id: "r1" }], relationshipCooling: [{ id: "r2" }] },
    callsDashboard: { workspaceDashboard: { stats: { callsToday: 7 } } },
  })

  const myQueue = populatedModel.sections.find((section) => section.id === "my-queue") as GrowthWorkspaceDashboardSection
  assert.equal(myQueue.metrics.find((metric) => metric.label === "Leads needing action")?.value, 3)
  assert.ok(populatedModel.briefing?.summary.replies_needing_attention === 3)
  assert.equal(populatedModel.welcome.recommendedAction, "Review inbox replies first.")
  assert.equal(
    populatedModel.sections.find((section) => section.id === "activity")?.metrics.find((metric) => metric.label === "Calls today")
      ?.value,
    7,
  )
  assert.ok(
    populatedModel.sections.every((section) =>
      section.id === "quick-actions"
        ? true
        : section.metrics.every((metric) => metric.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)),
    ),
  )
  console.log("  ✓ mapper aggregates existing source payloads without duplicate logic gaps")

  console.log("\nGrowth workspace dashboard audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_DASHBOARD_TEST_QA_MARKER,
        dashboard_qa_marker: GROWTH_WORKSPACE_DASHBOARD_QA_MARKER,
        sections: REQUIRED_SECTION_IDS.length,
        quick_actions: GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()

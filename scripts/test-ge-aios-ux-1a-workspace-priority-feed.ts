/**
 * GE-AIOS-UX-1A Phase 2 — Workspace priority feed certification.
 * Run: pnpm test:ge-aios-ux-1a-workspace-priority-feed
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_FEATURE_FLAG,
  isGrowthWorkspaceFirstUx1aEnabled,
} from "../lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import {
  remapUx1aOperatorHref,
  synthesizeGrowthWorkspacePriorityFeed,
} from "../lib/growth/workspace/ux-1a/growth-workspace-priority-feed-synthesizer"
import {
  containsUx1aForbiddenOperatorTerm,
  GROWTH_WORKSPACE_PRIORITY_FEED_FORBIDDEN_TERMS,
} from "../lib/growth/workspace/ux-1a/growth-workspace-priority-feed-copy"
import { GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER } from "../lib/growth/workspace/ux-1a/growth-workspace-priority-feed-types"
import { resolveAiTeammatePresentation } from "../lib/workspace/ai-teammate-identity"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const PHASE = "GE-AIOS-UX-1A-WORKSPACE-PRIORITY-FEED" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildBusyDashboard() {
  return buildGrowthWorkspaceDashboardViewModel({
    briefing: {
      greeting: "Good morning",
      operator_name: "Alex Operator",
      summary: {
        pending_approvals: 2,
        replies_needing_attention: 1,
        meetings_today: 0,
        recommended_action: null,
        blocked_jobs: 0,
      },
      revenue: { emails_sent: 0, replies: 1, opportunities: 0 },
      meetings: { meetings_this_week: 0, opportunities_pending: 0 },
      mailbox: { healthy_mailboxes: 0, expired_mailboxes: 1, warnings: 0 },
      approval_queue: { pending_drafts: 1, running_jobs: 0 },
      priorities: [],
      section_summaries: { mailbox: "Mailbox disconnected", inbox: "", revenue: "" },
    } as never,
    leadInboxSections: [{ id: "needs_review", items: [{}] }],
    cadenceSummary: null,
    pipelineDashboard: null,
    opportunityReadiness: null,
    sequenceFoundation: null,
    sequenceExecution: { pendingApproval: 2, sent24h: 0 },
    engagementWorkspace: null,
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
  })
}

function main(): void {
  console.log(`[${PHASE}] Workspace priority feed Phase 2 certification`)

  assert.equal(GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER, "ge-aios-ux-1a-workspace-priority-feed-v1")
  assert.equal(isGrowthWorkspaceFirstUx1aEnabled({}), false)

  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(dashboardBody, /GrowthHomeExecutiveBriefingDashboard/)
  assert.match(dashboardBody, /GrowthWorkspacePriorityFeedDashboard/)
  assert.match(dashboardBody, /isGrowthWorkspacePriorityFeedActive/)
  console.log("  ✓ feature flag off preserves legacy Workspace composition path")

  const priorityDashboard = readSource("components/growth/workspace/ux-1a/growth-workspace-priority-feed-dashboard.tsx")
  assert.match(priorityDashboard, /data-section="workspace-priority-feed"/)
  assert.match(priorityDashboard, /data-operator-action-cards="priority-feed"/)
  assert.doesNotMatch(priorityDashboard, /GeV15AutomationRuntimeApprovalInbox/)
  assert.doesNotMatch(priorityDashboard, /GrowthHomeExecutiveBriefingDashboard/)
  assert.doesNotMatch(priorityDashboard, /"Ava"/)
  assert.doesNotMatch(priorityDashboard, /"AI OS"/)
  console.log("  ✓ feature flag on renders new Workspace priority feed without duplicate approval inbox")

  const growthPage = readSource("app/(growth)/growth/page.tsx")
  assert.match(growthPage, /GROWTH_WORKSPACE_FIRST_UX_1A_NAV_LABELS\.workspace/)
  assert.match(growthPage, /isGrowthWorkspaceFirstUx1aEnabledClient/)
  console.log("  ✓ UX-1A page header switches to Workspace label")

  const teammate = resolveAiTeammatePresentation("Jordan")
  const busy = buildBusyDashboard()
  const activeFeed = synthesizeGrowthWorkspacePriorityFeed({
    dashboard: busy,
    workspaceSummary: {
      ok: true,
      inbox: { repliesNeedingAttention: 1, threadsOpen: 2, newReplies: 1 },
      meetings: { today: 0, thisWeek: 0, scheduled: 0 },
      kpis: { emailsSentToday: 0, repliesToday: 1, callsToday: 0, openOpportunities: 0, hotCompanies: 0, approvalQueueCount: 2 },
      salesOutcomes: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        outcomes: [],
        dailySummary: {
          qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
          generatedAt: new Date().toISOString(),
          researched: 3,
          qualified: 0,
          strong_opportunities: 0,
          outreach_prepared: 1,
          meetings_prepared: 0,
          approvals_pending: 1,
        },
      },
    } as never,
    teammate,
    operatorDisplayName: "Alex Operator",
    teammateIdentityAvailable: true,
  })

  assert.match(activeFeed.hero.greeting, /Alex/)
  assert.match(activeFeed.hero.subline, /Jordan has \d+ items ready for you\./)
  assert.equal(activeFeed.hero.teammateNamedInSubline, true)
  assert.ok(activeFeed.priorities.length > 0)
  assert.ok(activeFeed.primaryActions.length > 0)
  assert.ok(activeFeed.primaryActions.length <= 4)
  assert.ok(activeFeed.priorities.some((row) => /review/i.test(row.title)))
  assert.ok(activeFeed.priorities.some((row) => row.kind === "blocker" || /mailbox/i.test(row.title)))
  console.log("  ✓ priority feed consolidates operator-required work with dynamic teammate copy")

  for (const action of activeFeed.primaryActions) {
    assert.ok(action.href.startsWith("/growth/"))
    assert.doesNotMatch(action.href, /\/campaigns\/sequences/)
    assert.doesNotMatch(action.href, /\/engagement/)
  }
  for (const priority of activeFeed.priorities) {
    if (!priority.href) continue
    assert.doesNotMatch(priority.href, /\/campaigns\/sequences/)
    assert.doesNotMatch(priority.href, /\/engagement/)
  }
  assert.equal(remapUx1aOperatorHref("/growth/campaigns/sequences"), "/growth/review?tab=sends")
  assert.equal(
    remapUx1aOperatorHref("/growth/os/approvals?packageId=pkg-123"),
    "/growth/review?tab=packages&item=pkg-123",
  )
  assert.equal(
    remapUx1aOperatorHref("/growth/campaigns/sequences?job=job-456"),
    "/growth/review?tab=sends&item=job-456",
  )
  console.log("  ✓ priority actions resolve directly to canonical operator surfaces")

  const caughtUpFeed = synthesizeGrowthWorkspacePriorityFeed({
    dashboard: buildGrowthWorkspaceDashboardViewModel({
      briefing: {
        greeting: "Good afternoon",
        operator_name: "Alex",
        summary: {
          pending_approvals: 0,
          replies_needing_attention: 0,
          meetings_today: 1,
          recommended_action: null,
          blocked_jobs: 0,
        },
        revenue: { emails_sent: 2, replies: 0, opportunities: 1 },
        meetings: { meetings_this_week: 1, opportunities_pending: 0 },
        mailbox: { healthy_mailboxes: 2, expired_mailboxes: 0, warnings: 0 },
        approval_queue: { pending_drafts: 0, running_jobs: 0 },
        priorities: [],
        section_summaries: { mailbox: "", inbox: "", revenue: "" },
      } as never,
      leadInboxSections: [],
      cadenceSummary: null,
      pipelineDashboard: null,
      opportunityReadiness: null,
      sequenceFoundation: null,
      sequenceExecution: { pendingApproval: 0, sent24h: 2 },
      engagementWorkspace: null,
      conversationDashboard: null,
      relationshipDashboard: null,
      callsDashboard: null,
    }),
    workspaceSummary: null,
    teammate: resolveAiTeammatePresentation("Jordan"),
    operatorDisplayName: "Alex",
    teammateIdentityAvailable: true,
  })

  assert.equal(caughtUpFeed.isCaughtUp, true)
  assert.match(caughtUpFeed.caughtUpTitle, /caught up/i)
  assert.equal(caughtUpFeed.primaryActions.length, 0)
  console.log("  ✓ empty state is accurate and calm")

  const progressStatuses = new Set(activeFeed.recentProgress.map((row) => row.status))
  assert.ok(progressStatuses.has("prepared"))
  assert.ok(progressStatuses.has("ready_for_review"))
  assert.ok(progressStatuses.has("delivered"))
  const pendingReview = activeFeed.recentProgress.find((row) => row.status === "ready_for_review")
  const delivered = activeFeed.recentProgress.find((row) => row.status === "delivered")
  assert.ok(pendingReview && /waiting for review/i.test(pendingReview.label))
  assert.ok(delivered && /delivered/i.test(delivered.label))
  console.log("  ✓ prepared, queued, pending review, and delivered are not conflated")

  const serialized = JSON.stringify(activeFeed)
  for (const term of GROWTH_WORKSPACE_PRIORITY_FEED_FORBIDDEN_TERMS) {
    assert.ok(!containsUx1aForbiddenOperatorTerm(serialized), `forbidden term leaked: ${term}`)
  }
  console.log("  ✓ no engineering terminology appears in operator-facing feed")

  const fallbackFeed = synthesizeGrowthWorkspacePriorityFeed({
    dashboard: busy,
    workspaceSummary: null,
    teammate: resolveAiTeammatePresentation(""),
    operatorDisplayName: "Alex",
    teammateIdentityAvailable: false,
  })
  assert.match(fallbackFeed.hero.subline, /You have \d+ items ready for review\./)
  assert.equal(fallbackFeed.hero.teammateNamedInSubline, false)
  console.log("  ✓ identity-neutral fallback copy when teammate identity unavailable")

  assert.match(readSource("lib/growth/workspace/ux-1a/growth-workspace-priority-feed-synthesizer.ts"), /operatorActionCards/)
  assert.doesNotMatch(readSource("lib/growth/workspace/ux-1a/growth-workspace-priority-feed-synthesizer.ts"), /createGrowth|insert|update|delete|mutate/)
  console.log("  ✓ workspace remains presentation-only with no backend mutations")

  console.log(`[${PHASE}] passed`)
}

main()

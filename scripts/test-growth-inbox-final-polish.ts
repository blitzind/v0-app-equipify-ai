/**
 * Growth Inbox final polish UX audit (UX-AUDIT-9 — local only).
 *
 * Usage:
 *   pnpm test:growth-inbox-final-polish
 *   pnpm test:growth-inbox-final-polish:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildGrowthInboxCrmSummaryChips,
  GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY,
  GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER,
  GROWTH_INBOX_FINAL_POLISH_QA_MARKER,
} from "../lib/growth/hubs/growth-inbox-conversation-workspace-config"
import { buildGrowthInboxFinalPolishBriefingLines } from "../lib/growth/hubs/growth-inbox-hub-briefing-utils"
import { GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS } from "../lib/growth/hubs/growth-inbox-hub-notification-filters"
import {
  GROWTH_INBOX_PRIMARY_QUEUE_VIEWS,
  GROWTH_INBOX_QUEUE_VIEW_LABELS,
} from "../lib/growth/inbox/inbox-thread-queue-filters"
import {
  prepareInboxMessageSnippet,
  splitInboxMessageSections,
} from "../lib/growth/inbox/inbox-message-display-utils"
import { deriveGrowthInboxOverviewMetrics } from "../lib/growth/inbox/growth-inbox-overview-metrics"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_FINAL_POLISH_TEST_QA_MARKER = "growth-inbox-final-polish-test-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const FINAL_POLISH_SOURCES = [
  "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
  "components/growth/hubs/inbox/growth-inbox-primary-workspace.tsx",
  "components/growth/hubs/inbox/growth-inbox-resume-work-hero.tsx",
  "components/growth/inbox/growth-inbox-thread-queue-row.tsx",
  "components/growth/inbox/growth-inbox-thread-queue-column.tsx",
  "components/growth/inbox/growth-inbox-conversation-header.tsx",
  "components/growth/inbox/growth-inbox-conversation-timeline.tsx",
  "components/growth/inbox/growth-inbox-intelligence-sidebar.tsx",
  "components/growth/inbox/growth-inbox-recommended-reply-card.tsx",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth Inbox final polish audit (${GROWTH_INBOX_FINAL_POLISH_TEST_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_INBOX_FINAL_POLISH_QA_MARKER, "growth-inbox-final-polish-v1")
  assert.equal(GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER, "growth-inbox-conversation-workspace-v2")
  console.log("  ✓ UX-AUDIT-9 QA markers")

  assert.deepEqual([...GROWTH_INBOX_PRIMARY_QUEUE_VIEWS], ["needs_action", "interested", "meeting_intent", "unread"])
  assert.equal(GROWTH_INBOX_QUEUE_VIEW_LABELS.unread, "Unread")
  console.log("  ✓ primary queue filters match notification merge target")

  const notificationQueueViews = GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS.filter((entry) => entry.queueView)
  assert.ok(notificationQueueViews.length >= 4)
  console.log("  ✓ notification filters map to queue views")

  const primaryWorkspace = readSource("components/growth/hubs/inbox/growth-inbox-primary-workspace.tsx")
  assert.match(primaryWorkspace, /lg:grid-cols-\[7fr_10fr_7fr\]/)
  console.log("  ✓ 28/42/30 workspace layout")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxResumeWorkHero/)
  assert.doesNotMatch(v2Panel, /GrowthInboxTodaysBriefing/)
  assert.doesNotMatch(v2Panel, /GrowthInboxResumeSession/)
  assert.doesNotMatch(v2Panel, /GrowthOperatorInboxPanel/)
  assert.doesNotMatch(v2Panel, /GrowthInboxHubActionCards/)
  console.log("  ✓ resume work hero replaces briefing, resume, notifications, and action cards")

  const queueRow = readSource("components/growth/inbox/growth-inbox-thread-queue-row.tsx")
  assert.match(queueRow, /max-h-\[88px\]/)
  console.log("  ✓ compact thread queue rows (~88px max)")

  const header = readSource("components/growth/inbox/growth-inbox-conversation-header.tsx")
  assert.match(header, /sticky top-0/)
  assert.match(header, /buildGrowthInboxCrmSummaryChips/)
  console.log("  ✓ sticky header with CRM summary strip")

  const timeline = readSource("components/growth/inbox/growth-inbox-conversation-timeline.tsx")
  assert.match(timeline, /splitInboxMessageSections/)
  assert.match(timeline, /Show previous messages/)
  assert.match(timeline, /Show signature/)
  console.log("  ✓ compressed timeline with expandable sections")

  const sidebar = readSource("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx")
  assert.match(sidebar, /Next Best Action/)
  assert.match(sidebar, /AI Assistant/)
  assert.match(sidebar, /Utilities/)
  assert.match(sidebar, /GrowthInboxRecommendedReplyCard/)
  assert.doesNotMatch(sidebar, /GrowthInboxQuickActions mode="primary"/)
  console.log("  ✓ three-card consolidated sidebar IA")

  const sections = splitInboxMessageSections(
    "Hi Michael,\n\nHere is the update.\n\nBest regards,\nJane\n\n> previous quote",
  )
  assert.ok(sections.primary.includes("Hi Michael"))
  assert.ok(sections.signature?.includes("Jane"))
  assert.ok(sections.quoted?.includes("previous quote"))
  assert.equal(prepareInboxMessageSnippet("x".repeat(200)).truncated, true)
  console.log("  ✓ message display section splitting")

  const chips = buildGrowthInboxCrmSummaryChips({
    fitScore: 92,
    stageLabel: "Interested",
    ownerLabel: "Michael",
    meetingLabel: "Tomorrow 2 PM",
    sequenceLabel: "Demo Follow-up",
  })
  assert.equal(chips.length, 5)
  console.log("  ✓ CRM summary chips builder")

  const metrics = deriveGrowthInboxOverviewMetrics({ threads: [], replyDashboard: null })
  const lines = buildGrowthInboxFinalPolishBriefingLines(metrics)
  assert.equal(lines.length, 3)
  assert.match(lines[0]?.text ?? "", /need replies/)
  console.log("  ✓ resume hero briefing lines")

  const adminFallbacks = GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.filter((entry) =>
    entry.workspaceRoute.startsWith("/admin/growth"),
  )
  assert.equal(adminFallbacks.length, 0)

  if (!production) {
    for (const sourcePath of FINAL_POLISH_SOURCES) {
      assert.doesNotMatch(readSource(sourcePath), /href="\/admin\/growth/, `${sourcePath} admin fallback`)
    }
    console.log("  ✓ no admin fallbacks in polished inbox surfaces")
  }

  assert.ok(GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.some((entry) => entry.action === "Open Lead"))
  assert.ok(
    GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.filter(
      (entry) => entry.status === "workspace" && entry.workspaceRoute.startsWith(GROWTH_WORKSPACE_BASE_PATH),
    ).length >= 6,
  )
  console.log("  ✓ route inventory still workspace-scoped")

  console.log("\nGrowth Inbox final polish audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_FINAL_POLISH_TEST_QA_MARKER,
        mode,
        primary_queue_views: GROWTH_INBOX_PRIMARY_QUEUE_VIEWS,
        layout: "28/42/30",
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)

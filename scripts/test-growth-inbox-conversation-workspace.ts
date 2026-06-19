/**
 * Growth Inbox conversation workspace UX audit (UX-AUDIT-8 — local only).
 *
 * Usage:
 *   pnpm test:growth-inbox-conversation-workspace
 *   pnpm test:growth-inbox-conversation-workspace:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY,
  GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER,
} from "../lib/growth/hubs/growth-inbox-conversation-workspace-config"
import {
  collapseForwardedBoilerplate,
  collapseLongUrls,
  collapseSignature,
  prepareInboxMessageSnippet,
} from "../lib/growth/inbox/inbox-message-display-utils"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_CONVERSATION_WORKSPACE_TEST_QA_MARKER = "growth-inbox-conversation-workspace-test-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const CONVERSATION_WORKSPACE_SOURCES = [
  "components/growth/hubs/inbox/growth-inbox-primary-workspace.tsx",
  "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
  "components/growth/inbox/growth-inbox-conversation-column.tsx",
  "components/growth/inbox/growth-inbox-conversation-header.tsx",
  "components/growth/inbox/growth-inbox-next-best-action-bar.tsx",
  "components/growth/inbox/growth-inbox-conversation-timeline.tsx",
  "components/growth/inbox/growth-inbox-conversation-empty-state.tsx",
  "components/growth/inbox/growth-inbox-intelligence-sidebar.tsx",
  "components/growth/inbox/growth-inbox-recommended-reply-card.tsx",
  "components/growth/inbox/growth-inbox-thread-queue-row.tsx",
  "components/growth/inbox/growth-inbox-thread-queue-column.tsx",
  "components/growth/inbox/growth-inbox-quick-actions.tsx",
  "components/growth/inbox/growth-inbox-call-action-links.tsx",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth Inbox conversation workspace audit (${GROWTH_INBOX_CONVERSATION_WORKSPACE_TEST_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER, "growth-inbox-conversation-workspace-v2")
  assert.ok(GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.length >= 14)
  console.log(`  ✓ QA marker and route inventory (${GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.length} entries)`)

  const adminFallbacks = GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.filter((entry) =>
    entry.workspaceRoute.startsWith("/admin/growth"),
  )
  assert.equal(adminFallbacks.length, 0)
  console.log("  ✓ route inventory has no admin fallbacks")

  const requiredActions = [
    "Open Lead",
    "Open Call Workspace",
    "Start Callback",
    "Review Voicemail",
    "Review Coaching",
    "Create Task",
    "Create Opportunity",
    "Book Meeting",
    "Assign",
    "Archive",
    "Reply Copilot",
    "Opportunity Recommendations",
    "Booking Recommendations",
    "Revenue Command Center",
  ]
  for (const action of requiredActions) {
    assert.ok(
      GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.some((entry) => entry.action === action),
      `missing route inventory action: ${action}`,
    )
  }
  console.log("  ✓ route inventory covers all required conversation destinations")

  const sample = prepareInboxMessageSnippet(
    "Thanks for the update.\n\nBest regards,\nJane\n\n---------- Forwarded message ---------\nOld thread",
  )
  assert.ok(sample.snippet.includes("Thanks for the update"))
  assert.ok(!sample.snippet.includes("Forwarded message"))
  assert.equal(collapseLongUrls("see https://example.com/very/long/path/that/should/be/truncated").includes("…"), true)
  assert.equal(collapseSignature("Hello\n\nThanks,\nBob"), "Hello")
  assert.equal(collapseForwardedBoilerplate("Hi\n\nBegin forwarded message\nrest"), "Hi")
  console.log("  ✓ message display utils collapse signatures, forwards, and URLs")

  const primaryWorkspace = readSource("components/growth/hubs/inbox/growth-inbox-primary-workspace.tsx")
  assert.match(primaryWorkspace, /lg:grid-cols-\[7fr_10fr_7fr\]/)
  assert.match(primaryWorkspace, /intelligenceSidebar/)
  assert.match(primaryWorkspace, /data-growth-inbox-conversation-workspace=\{GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER\}/)
  console.log("  ✓ primary workspace uses 28/42/30 three-column layout")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxIntelligenceSidebar/)
  assert.doesNotMatch(v2Panel, /GrowthInboxOperatorCopilot/)
  console.log("  ✓ v2 panel wires intelligence sidebar instead of operator copilot")

  const conversationColumn = readSource("components/growth/inbox/growth-inbox-conversation-column.tsx")
  assert.match(conversationColumn, /GrowthInboxConversationHeader/)
  assert.match(conversationColumn, /GrowthInboxConversationTimeline/)
  assert.match(conversationColumn, /GrowthInboxConversationEmptyState/)
  assert.doesNotMatch(conversationColumn, /GrowthInboxNextBestActionBar/)
  console.log("  ✓ conversation column composes sticky header, timeline, empty state")

  const sidebar = readSource("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx")
  assert.match(sidebar, /Next Best Action/)
  assert.match(sidebar, /AI Assistant/)
  assert.match(sidebar, /Utilities/)
  assert.match(sidebar, /GrowthInboxRecommendedReplyCard/)
  assert.match(sidebar, /GrowthOnDemandFeature/)
  console.log("  ✓ intelligence sidebar consolidated three-card IA with lazy panels")

  const queueColumn = readSource("components/growth/inbox/growth-inbox-thread-queue-column.tsx")
  assert.match(queueColumn, /GrowthInboxThreadQueueRow/)
  assert.doesNotMatch(queueColumn, /GrowthInboxThreadCard/)
  console.log("  ✓ thread queue uses compact CRM rows")

  if (!production) {
    for (const sourcePath of CONVERSATION_WORKSPACE_SOURCES) {
      const source = readSource(sourcePath)
      assert.doesNotMatch(source, /href="\/admin\/growth/, `${sourcePath} must not hardcode admin fallbacks`)
    }
    console.log("  ✓ conversation workspace sources contain no admin href fallbacks")
  }

  const workspaceScoped = GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.filter(
    (entry) => entry.status === "workspace" && entry.workspaceRoute.startsWith(GROWTH_WORKSPACE_BASE_PATH),
  )
  assert.ok(workspaceScoped.length >= 6)
  console.log(`  ✓ ${workspaceScoped.length} workspace-scoped external routes in inventory`)

  console.log("\nGrowth Inbox conversation workspace audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_CONVERSATION_WORKSPACE_TEST_QA_MARKER,
        mode,
        route_inventory: GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY.map((entry) => ({
          source: entry.source,
          action: entry.action,
          currentRoute: entry.currentRoute,
          workspaceRoute: entry.workspaceRoute,
          status: entry.status,
        })),
      },
      null,
      2,
    ),
  )
}

const mode = process.argv.includes("--production") ? "production" : "local"
runAudit(mode)

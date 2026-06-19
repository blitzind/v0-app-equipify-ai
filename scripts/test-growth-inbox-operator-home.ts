/**
 * Growth Inbox operator home UX audit (UX-AUDIT-7 — local only).
 *
 * Usage:
 *   pnpm test:growth-inbox-operator-home
 *   pnpm test:growth-inbox-operator-home:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_HUB_ACTION_CARDS,
  GROWTH_INBOX_HUB_UX_QA_MARKER,
} from "../lib/growth/hubs/growth-inbox-hub-config"
import { GROWTH_INBOX_HUB_MANIFEST } from "../lib/growth/hubs/growth-inbox-hub-manifest"
import { GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS } from "../lib/growth/hubs/growth-inbox-hub-notification-filters"
import {
  GROWTH_INBOX_RECENT_WORK_QA_MARKER,
  GROWTH_INBOX_RECENT_WORK_STORAGE_KEY,
} from "../lib/growth/hubs/growth-inbox-recent-work-memory"
import {
  GROWTH_INBOX_HUB_HREF,
  GROWTH_INBOX_HUB_OPERATIONS_HREF,
  GROWTH_INBOX_HUB_WORKFLOW_HREF,
} from "../lib/growth/hubs/growth-workspace-hub-paths"
import {
  GROWTH_INBOX_PRIMARY_QUEUE_VIEWS,
  GROWTH_INBOX_SECONDARY_QUEUE_VIEWS,
} from "../lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import { growthOperatorInboxFallbackHref } from "../lib/growth/navigation/growth-operator-inbox-fallback-links"

export const GROWTH_INBOX_OPERATOR_HOME_QA_MARKER = "growth-inbox-operator-home-v1" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const INBOX_WORKSPACE_SOURCES = [
  "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
  "components/growth/inbox/growth-inbox-thread-queue-column.tsx",
  "components/growth/inbox/growth-inbox-workspace-operations-panel.tsx",
  "components/growth/inbox/growth-inbox-inline-revenue-context.tsx",
  "components/growth/inbox/growth-inbox-intelligence-sidebar.tsx",
  "components/growth/inbox/growth-inbox-conversation-column.tsx",
  "app/(growth)/growth/inbox/page.tsx",
  "app/(growth)/growth/inbox/workflow/page.tsx",
  "app/(growth)/growth/inbox/operations/page.tsx",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(mode: "local" | "production"): void {
  const production = mode === "production"
  console.log(
    `\n=== Growth Inbox operator home audit (${GROWTH_INBOX_OPERATOR_HOME_QA_MARKER}${production ? " production" : ""}) ===\n`,
  )

  assert.equal(GROWTH_INBOX_HUB_UX_QA_MARKER, "growth-inbox-operator-home-v1")
  assert.equal(GROWTH_INBOX_RECENT_WORK_STORAGE_KEY, "equipify:growth-inbox-recent-work/v1")
  assert.equal(GROWTH_INBOX_RECENT_WORK_QA_MARKER, "growth-inbox-recent-work-v1")
  assert.equal(GROWTH_INBOX_PRIMARY_QUEUE_VIEWS.length, 4)
  assert.equal(GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS.length, 6)
  console.log("  ✓ UX markers, recent-work storage, primary filters")

  for (const card of GROWTH_INBOX_HUB_ACTION_CARDS) {
    assert.match(card.href, /^\/growth\//)
  }
  assert.ok(GROWTH_INBOX_HUB_MANIFEST.quickActions.every((item) => item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH)))
  console.log("  ✓ action cards and manifest remain workspace-scoped")

  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_INBOX_HUB_HREF))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_INBOX_HUB_WORKFLOW_HREF))
  assert.ok(findGrowthRouteMetadataByPathname(GROWTH_INBOX_HUB_OPERATIONS_HREF))
  console.log("  ✓ inbox, workflow, and operations routes registered")

  assert.equal(
    growthOperatorInboxFallbackHref({ notificationType: "sequence_failed" }),
    `${GROWTH_WORKSPACE_BASE_PATH}/campaigns/sequences`,
  )
  console.log("  ✓ sequence_failed notification fallback uses workspace route")

  if (!production) {
    const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
    assert.match(v2Panel, /GrowthInboxResumeWorkHero/)
    assert.doesNotMatch(v2Panel, /GrowthOperatorInboxPanel/)
    assert.match(v2Panel, /GrowthInboxPrimaryWorkspace/)
    assert.match(v2Panel, /GrowthInboxIntelligenceSidebar/)
    assert.doesNotMatch(v2Panel, /GrowthInboxOperatorCopilot/)
    assert.match(v2Panel, /GrowthInboxAdvancedTools/)
    assert.doesNotMatch(v2Panel, /GrowthInboxOverviewMetricsPanel/)
    assert.doesNotMatch(v2Panel, /GrowthInboxWorkspaceShell/)

    const queue = readSource("components/growth/inbox/growth-inbox-thread-queue-column.tsx")
    assert.match(queue, /GROWTH_INBOX_PRIMARY_QUEUE_VIEWS/)
    assert.match(queue, /More Filters/)
    assert.match(queue, /GrowthInboxThreadQueueRow/)

    for (const file of INBOX_WORKSPACE_SOURCES) {
      assert.doesNotMatch(readSource(file), /href="\/admin\/growth/, `${file} contains hardcoded admin fallback`)
    }
    console.log("  ✓ operator home IA, queue filters, and zero admin fallbacks under /growth/inbox/*")
  }

  console.log("\nGrowth Inbox operator home audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_OPERATOR_HOME_QA_MARKER,
        hub_ux_marker: GROWTH_INBOX_HUB_UX_QA_MARKER,
        mode,
        secondary_queue_views: GROWTH_INBOX_SECONDARY_QUEUE_VIEWS,
      },
      null,
      2,
    ),
  )
}

const production = process.argv.includes("--production")
runAudit(production ? "production" : "local")

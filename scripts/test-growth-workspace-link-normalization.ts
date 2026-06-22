/**
 * Growth workspace operator deep-link normalization audit (Phase 7J — local only).
 *
 * Usage: pnpm test:growth-workspace-link-normalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AIDEN_OPERATOR_GUIDE_QA_MARKER } from "../lib/growth/aiden/operator-guide"
import {
  GROWTH_COMMAND_JUMP_DESTINATIONS,
  GROWTH_COMMAND_PIPELINE_SECTION_LINKS,
} from "../lib/growth/command/command-center-navigation"
import { GROWTH_COMMAND_CENTER_QUICK_ACTIONS } from "../lib/growth/command/command-center-quick-actions"
import {
  GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS,
  GROWTH_WORKSPACE_CANONICAL_ALIASES,
} from "../lib/growth/navigation/growth-workspace-cleanup-audit"
import {
  GROWTH_WORKSPACE_OPERATOR_LINKS_QA_MARKER,
  growthWorkspaceInboxHref,
  growthWorkspaceLeadHref,
} from "../lib/growth/navigation/growth-workspace-operator-links"
import { resolveGrowthOperatorNotificationEntityLink } from "../lib/growth/notifications/growth-notification-center-utils"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth workspace link normalization audit (${GROWTH_WORKSPACE_OPERATOR_LINKS_QA_MARKER}) ===\n`)

  const inboxHref = growthWorkspaceInboxHref({ leadId: "lead-1", replyId: "reply-1", view: "needs_action" })
  assert.match(inboxHref, /^\/growth\/inbox\?/)
  assert.match(inboxHref, /view=needs_action/)
  assert.match(inboxHref, /leadId=lead-1/)
  console.log("  ✓ workspace inbox href builder")

  const leadHref = growthWorkspaceLeadHref("00000000-0000-4000-8000-000000000001")
  assert.equal(leadHref, "/growth/leads/crm?open=00000000-0000-4000-8000-000000000001")
  console.log("  ✓ workspace lead href builder")

  const replyNotifications = readSource("lib/growth/reply-intelligence/reply-intelligence-notifications.ts")
  assert.match(replyNotifications, /growthWorkspaceInboxHref/)
  assert.doesNotMatch(replyNotifications, /\/admin\/growth\/replies\?replyId=/)
  console.log("  ✓ reply intelligence notifications use workspace inbox CTAs")

  const notificationUtils = readSource("lib/growth/notifications/growth-notification-center-utils.ts")
  assert.match(notificationUtils, /growthWorkspaceInboxHref/)
  assert.match(notificationUtils, /growthWorkspaceLeadHref/)
  assert.doesNotMatch(notificationUtils, /\/admin\/growth\/replies\?replyId=/)
  assert.doesNotMatch(notificationUtils, /\/admin\/growth\/inbox\?threadId=/)
  console.log("  ✓ notification center entity links use workspace paths")

  const replyLink = resolveGrowthOperatorNotificationEntityLink({
    targetEntityType: "reply",
    targetEntityId: "00000000-0000-4000-8000-000000000003",
  })
  assert.match(replyLink.href ?? "", /^\/growth\/inbox\?/)
  const threadLink = resolveGrowthOperatorNotificationEntityLink({
    targetEntityType: "inbox_thread",
    targetEntityId: "00000000-0000-4000-8000-000000000004",
  })
  assert.match(threadLink.href ?? "", /^\/growth\/inbox\?threadId=/)
  console.log("  ✓ notification entity link resolver returns workspace inbox URLs")

  const commandNav = readSource("lib/growth/command/command-center-navigation.ts")
  assert.match(commandNav, /GROWTH_WORKSPACE_CANONICAL_ALIASES\.replyWorkflow/)
  assert.match(commandNav, /GROWTH_WORKSPACE_CANONICAL_ALIASES\.inbox/)
  assert.doesNotMatch(commandNav, /\/admin\/growth\/replies\/workflow/)
  assert.ok(
    GROWTH_COMMAND_JUMP_DESTINATIONS.some(
      (entry) => entry.label === "Reply Workflow" && entry.href === GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow,
    ),
  )
  assert.ok(
    GROWTH_COMMAND_PIPELINE_SECTION_LINKS.some(
      (entry) => entry.label === "Pipeline" && entry.href === GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline,
    ),
  )
  console.log("  ✓ command center jump destinations use workspace paths")

  const quickActions = readSource("lib/growth/command/command-center-quick-actions.ts")
  assert.ok(
    GROWTH_COMMAND_CENTER_QUICK_ACTIONS.some(
      (entry) => entry.label === "Inbox" && entry.href === GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox,
    ),
  )
  assert.doesNotMatch(quickActions, /href: "\/admin\/growth\/inbox"/)
  console.log("  ✓ command center quick actions use workspace inbox and pipeline")

  const operatorGuide = readSource("lib/growth/aiden/operator-guide.ts")
  assert.match(operatorGuide, new RegExp(AIDEN_OPERATOR_GUIDE_QA_MARKER))
  assert.match(operatorGuide, /GROWTH_WORKSPACE_CANONICAL_ALIASES\.inbox/)
  assert.match(operatorGuide, /GROWTH_WORKSPACE_CANONICAL_ALIASES\.replyInboxAdmin/)
  assert.doesNotMatch(operatorGuide, /\/admin\/growth\/replies\/workflow/)
  assert.doesNotMatch(operatorGuide, /href: "\/admin\/growth\/inbox"/)
  console.log("  ✓ operator guide uses workspace inbox; admin reply inbox retained for parity")

  const executionPriority = readSource("lib/growth/execution/execution-priority-engine.ts")
  assert.match(executionPriority, /growthWorkspaceInboxHref/)
  assert.doesNotMatch(executionPriority, /\/admin\/growth\/replies\?view=unanswered/)
  console.log("  ✓ execution priority reply CTA uses workspace inbox")

  const humanReplyRouter = readSource("lib/growth/human-execution/human-execution-reply-router.ts")
  assert.match(humanReplyRouter, /growthWorkspaceInboxHref/)
  assert.doesNotMatch(humanReplyRouter, /\/admin\/growth\/replies/)
  console.log("  ✓ human execution reply router uses workspace inbox")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxQueueUrlSync/)
  const overviewPanel = readSource("components/growth/inbox/growth-inbox-overview-metrics-panel.tsx")
  assert.match(overviewPanel, /growthWorkspaceInboxViewHref/)
  console.log("  ✓ inbox overview metrics support clickable queue views via ?view= sync")

  for (const forbidden of GROWTH_FORBIDDEN_WORKSPACE_ORPHAN_PATHS) {
    assert.doesNotMatch(notificationUtils, new RegExp(forbidden.replace(/\//g, "\\/")))
    assert.doesNotMatch(commandNav, new RegExp(`href: "${forbidden.replace(/\//g, "\\/")}"`))
  }
  console.log("  ✓ no forbidden /growth/replies workspace links introduced")

  console.log("\n=== Growth workspace link normalization audit passed ===\n")
}

runAudit()

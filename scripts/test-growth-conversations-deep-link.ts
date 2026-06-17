/**
 * Growth conversations deep-link activation audit (Phase 7O — local only).
 *
 * Usage: pnpm test:growth-conversations-deep-link
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_CONVERSATIONS_DEEP_LINK_QA_MARKER,
  collectGrowthConversationsDashboardLeads,
  hasGrowthConversationsDeepLinkParams,
  parseGrowthConversationsDeepLinkParams,
  resolveGrowthConversationsFocusedLeadId,
  shouldShowGrowthConversationsMissingContextMessage,
} from "../lib/growth/navigation/growth-conversations-deep-link"
import {
  growthWorkspaceConversationsHref,
  growthWorkspaceInboxHref,
  growthWorkspaceInboxWorkflowHref,
} from "../lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "../lib/growth/navigation/growth-workspace-sidebar-ia"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth conversations deep-link audit (${GROWTH_CONVERSATIONS_DEEP_LINK_QA_MARKER}) ===\n`)

  const params = parseGrowthConversationsDeepLinkParams(
    new URLSearchParams("leadId=lead-1&threadId=thread-1&companyId=co-1&personId=pe-1"),
  )
  assert.equal(params.leadId, "lead-1")
  assert.equal(params.threadId, "thread-1")
  assert.equal(params.companyId, "co-1")
  assert.equal(params.personId, "pe-1")
  assert.ok(hasGrowthConversationsDeepLinkParams(params))
  console.log("  ✓ conversations reads leadId, threadId, companyId, and personId")

  const emptyParams = parseGrowthConversationsDeepLinkParams(new URLSearchParams())
  assert.equal(emptyParams.leadId, null)
  assert.equal(emptyParams.threadId, null)
  assert.ok(!hasGrowthConversationsDeepLinkParams(emptyParams))
  console.log("  ✓ missing params do not break deep-link parsing")

  const dashboard = {
    strongHealth: [{ id: "lead-1", companyName: "Acme" }],
    buyingIntent: [{ id: "lead-2", companyName: "Beta" }],
    sentimentShift: [],
    competitorMentions: [],
    urgencyTrends: [],
    conversationRisk: [],
  }
  const leads = collectGrowthConversationsDashboardLeads(dashboard)
  assert.equal(leads.length, 2)
  assert.equal(resolveGrowthConversationsFocusedLeadId(leads, { ...emptyParams, leadId: "lead-1" }), "lead-1")
  assert.equal(
    resolveGrowthConversationsFocusedLeadId(leads, { ...emptyParams, leadId: "missing-lead" }),
    null,
  )
  assert.ok(
    shouldShowGrowthConversationsMissingContextMessage({
      params: { ...emptyParams, leadId: "missing-lead" },
      focusedLeadId: null,
    }),
  )
  console.log("  ✓ focus resolution and missing-match handling behave safely")

  const conversationsHref = growthWorkspaceConversationsHref({ leadId: "lead-1", threadId: "thread-1" })
  assert.equal(conversationsHref, "/growth/conversations?leadId=lead-1&threadId=thread-1")
  assert.equal(growthWorkspaceInboxHref({ leadId: "lead-1" }), "/growth/inbox?leadId=lead-1")
  assert.equal(growthWorkspaceInboxWorkflowHref("lead-1"), "/growth/inbox/workflow?leadId=lead-1")
  console.log("  ✓ inbox and conversations cross-links remain valid")

  const dashboardSource = readSource("components/growth/growth-conversations-dashboard.tsx")
  assert.match(dashboardSource, /useSearchParams/)
  assert.match(dashboardSource, /parseGrowthConversationsDeepLinkParams/)
  assert.match(dashboardSource, /focusedLeadId/)
  assert.match(dashboardSource, /data-focused-lead/)
  assert.match(dashboardSource, /Opened from Inbox thread/)
  assert.match(dashboardSource, /Linked conversation context was not found/)
  assert.doesNotMatch(dashboardSource, /NextResponse\.redirect|redirect\(/)
  assert.doesNotMatch(dashboardSource, /\/growth\/replies/)
  console.log("  ✓ focus/highlight behavior is present in conversations dashboard")

  const pageSource = readSource("app/(growth)/growth/conversations/page.tsx")
  assert.doesNotMatch(pageSource, /NextResponse\.redirect|redirect\(/)
  console.log("  ✓ conversations route unchanged")

  assert.equal(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.length, 12)
  console.log("  ✓ sidebar remains 12 items")

  console.log("\nGrowth conversations deep-link audit passed.\n")
}

runAudit()

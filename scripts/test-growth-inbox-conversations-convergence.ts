/**
 * Growth inbox ↔ conversations convergence audit (Phase 7N — local only).
 *
 * Usage: pnpm test:growth-inbox-conversations-convergence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY,
  GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY_QA_MARKER,
  GROWTH_INBOX_CONVERSATIONS_ROUTE_INVENTORY,
} from "../lib/growth/inbox/inbox-conversation-intelligence-inventory"
import {
  GROWTH_INBOX_CONVERSATION_INTELLIGENCE_READ_MODEL_QA_MARKER,
  adaptGrowthLeadToInboxConversationPreview,
  hasInboxConversationIntelligencePreview,
} from "../lib/growth/inbox/inbox-conversation-intelligence-read-model"
import {
  GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_MATRIX,
  GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_QA_MARKER,
  GROWTH_INBOX_CONVERSATIONS_CROSS_LINKS,
  GROWTH_INBOX_CONVERSATIONS_PRESERVED_ROUTES,
  GROWTH_INBOX_CONVERSATIONS_RESPONSIBILITY_MATRIX,
} from "../lib/growth/navigation/growth-inbox-conversations-convergence-architecture"
import {
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import {
  growthWorkspaceConversationsHref,
  growthWorkspaceInboxHref,
  growthWorkspaceInboxWorkflowHref,
} from "../lib/growth/navigation/growth-workspace-operator-links"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import type { GrowthLead } from "../lib/growth/types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleLead(): GrowthLead {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    companyName: "Acme HVAC",
    contactName: "Alex",
    contactEmail: "alex@acme.test",
    conversationHealthScore: 72,
    conversationHealthTier: "positive",
    conversationSummary: "Strong interest in scheduling a demo after pricing discussion.",
    conversationSentiment: "positive",
    conversationMomentum: "accelerating",
    conversationBuyingIntent: "strong",
    conversationUrgencyLevel: "medium",
    conversationTopSignals: [{ kind: "buying_signal", label: "Requested demo", points: 20, occurredAt: new Date().toISOString(), source: "email" }],
    conversationObjectionProfile: { clusters: [], totalSeverityScore: 0 },
    conversationCompetitorMentions: [],
    conversationCompetitorPressure: null,
    conversationLastMeaningfulConversationAt: new Date().toISOString(),
    conversationPreviousScore: null,
    conversationTrend: "improving",
    conversationConfidence: 0.8,
    conversationResponsePattern: "fast",
    conversationComputedAt: new Date().toISOString(),
  } as GrowthLead
}

function runAudit(): void {
  console.log(`\n=== Growth inbox conversations convergence audit (${GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_QA_MARKER}) ===\n`)

  assert.ok(GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY.length >= 5)
  assert.ok(GROWTH_INBOX_CONVERSATIONS_ROUTE_INVENTORY.length === 3)
  console.log("  ✓ conversation intelligence inventory and route audit documented")

  const inboxOwned = GROWTH_INBOX_CONVERSATIONS_RESPONSIBILITY_MATRIX.filter((row) => row.owner === "inbox")
  const conversationsOwned = GROWTH_INBOX_CONVERSATIONS_RESPONSIBILITY_MATRIX.filter(
    (row) => row.owner === "conversations",
  )
  assert.ok(inboxOwned.length >= 8)
  assert.ok(conversationsOwned.length >= 5)
  console.log("  ✓ inbox vs conversations responsibility matrix defined")

  for (const route of GROWTH_INBOX_CONVERSATIONS_PRESERVED_ROUTES) {
    assert.ok(findGrowthRouteMetadataByPathname(route), `route should remain registered: ${route}`)
  }
  console.log("  ✓ preserved inbox and conversations routes remain registered")

  const conversationsHref = growthWorkspaceConversationsHref({
    leadId: "lead-1",
    threadId: "thread-1",
  })
  assert.equal(conversationsHref, "/growth/conversations?leadId=lead-1&threadId=thread-1")
  const inboxHref = growthWorkspaceInboxHref({ leadId: "lead-1", threadId: "thread-1" })
  assert.match(inboxHref, /^\/growth\/inbox\?/)
  const workflowHref = growthWorkspaceInboxWorkflowHref("lead-1")
  assert.equal(workflowHref, "/growth/inbox/workflow?leadId=lead-1")
  console.log("  ✓ cross-link href builders resolve workspace destinations")

  assert.ok(GROWTH_INBOX_CONVERSATIONS_CROSS_LINKS.some((link) => link.fromSurface === "inbox"))
  assert.ok(GROWTH_INBOX_CONVERSATIONS_CROSS_LINKS.some((link) => link.fromSurface === "conversations"))
  console.log("  ✓ cross-link strategy documented for inbox and conversations")

  const lead = sampleLead()
  assert.ok(hasInboxConversationIntelligencePreview(lead))
  const preview = adaptGrowthLeadToInboxConversationPreview(lead, { threadId: "thread-1" })
  assert.equal(preview.qaMarker, GROWTH_INBOX_CONVERSATION_INTELLIGENCE_READ_MODEL_QA_MARKER)
  assert.match(preview.conversationsHref, /^\/growth\/conversations\?/)
  assert.match(preview.inboxHref, /^\/growth\/inbox\?/)
  assert.ok(preview.summarySnippet)
  assert.ok(preview.recommendationPreview)
  console.log("  ✓ conversation intelligence read model adapts lead fields without persistence")

  const readModel = readSource("lib/growth/inbox/inbox-conversation-intelligence-read-model.ts")
  assert.doesNotMatch(readModel, /\.from\(/)
  assert.doesNotMatch(readModel, /insert\(/)
  assert.doesNotMatch(readModel, /fetch\(/)
  console.log("  ✓ read model contains no persistence or API duplication")

  const contextStrip = readSource("components/growth/inbox/growth-inbox-conversation-intelligence-context-strip.tsx")
  assert.match(contextStrip, /View Conversation/)
  assert.match(contextStrip, /View Timeline/)
  assert.match(contextStrip, /Open Workflow/)
  assert.doesNotMatch(contextStrip, /\/growth\/replies/)
  console.log("  ✓ inbox and conversations cross-link components wired")

  const conversationColumn = readSource("components/growth/inbox/growth-inbox-conversation-column.tsx")
  assert.match(conversationColumn, /GrowthInboxConversationIntelligenceContextStrip/)
  const conversationsDashboard = readSource("components/growth/growth-conversations-dashboard.tsx")
  assert.match(conversationsDashboard, /GrowthConversationsActionCrossLinks/)
  assert.match(conversationsDashboard, /parseGrowthConversationsDeepLinkParams/)
  assert.match(conversationsDashboard, /focusedLeadId/)
  console.log("  ✓ inbox conversation column and conversations dashboard wire read-only context")

  assert.ok(GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_MATRIX.some((row) => row.status === "available"))
  assert.ok(GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_MATRIX.some((row) => row.status === "deferred"))
  console.log("  ✓ convergence matrix documents available and deferred surfaces")

  assert.equal(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.length, 12)
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("inbox"))
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("conversations"))
  console.log("  ✓ sidebar remains 12 items with inbox and conversations")

  const architecture = readSource("lib/growth/navigation/growth-inbox-conversations-convergence-architecture.ts")
  assert.match(architecture, /Inbox is the Operator Action Surface/)
  assert.doesNotMatch(architecture, /NextResponse\.redirect|redirect\(/)
  assert.equal(GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY_QA_MARKER, "growth-inbox-conversation-intelligence-inventory-v1")
  console.log("  ✓ inbox remains action surface and conversations remains intelligence surface")

  console.log("\n=== Growth inbox conversations convergence audit passed ===\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        inventory_qa_marker: GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY_QA_MARKER,
        convergence_qa_marker: GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_QA_MARKER,
        responsibility_rows: GROWTH_INBOX_CONVERSATIONS_RESPONSIBILITY_MATRIX.length,
        inventory_rows: GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY.length,
      },
      null,
      2,
    ),
  )
}

runAudit()

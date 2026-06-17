/**
 * Inbox ↔ Conversations convergence architecture manifest (Phase 7N).
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_QA_MARKER = "growth-inbox-conversations-convergence-v1" as const

export const GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_PRINCIPLE =
  "Inbox is the Operator Action Surface; Conversations is the Intelligence Surface." as const

export const GROWTH_INBOX_CONVERSATIONS_PRESERVED_ROUTES = [
  `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
  `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
  `${GROWTH_WORKSPACE_BASE_PATH}/conversations`,
] as const

export type GrowthInboxConversationsResponsibilityRow = {
  id: string
  domain: string
  owner: "inbox" | "conversations" | "shared-read-only"
  notes: string
}

/** Responsibility matrix — Inbox acts; Conversations analyzes. */
export const GROWTH_INBOX_CONVERSATIONS_RESPONSIBILITY_MATRIX: GrowthInboxConversationsResponsibilityRow[] = [
  { id: "notifications", domain: "Notifications", owner: "inbox", notes: "Operator attention queue and acknowledgment." },
  { id: "queue-state", domain: "Queue state", owner: "inbox", notes: "Thread queue, filters, claim/assign/resolve." },
  { id: "workflow", domain: "Workflow", owner: "inbox", notes: "Reply workflow actions under /growth/inbox/workflow." },
  { id: "operator-actions", domain: "Operator actions", owner: "inbox", notes: "Reply drafts, SMS drafts, booking, opportunity embeds." },
  { id: "follow-ups", domain: "Follow-ups", owner: "inbox", notes: "Call follow-up queue views and cadence task execution." },
  { id: "meeting-handling", domain: "Meeting handling", owner: "inbox", notes: "Meeting intent threads and booking embeds." },
  { id: "callbacks", domain: "Callbacks", owner: "inbox", notes: "Callback queue views and call workspace cross-links." },
  { id: "human-intervention", domain: "Human intervention", owner: "inbox", notes: "Approval gates and workflow review." },
  { id: "task-execution", domain: "Task execution", owner: "inbox", notes: "Operator completes actions from action center." },
  { id: "timeline", domain: "Timeline", owner: "conversations", notes: "Cross-channel conversation history and portfolio timeline analysis." },
  { id: "message-history", domain: "Message history", owner: "shared-read-only", notes: "Inbox shows thread messages; Conversations analyzes patterns across leads." },
  { id: "sentiment", domain: "conversations", notes: "Lead-level sentiment classification and shift detection.", owner: "conversations" },
  { id: "summaries", domain: "conversations", owner: "conversations", notes: "AI-generated conversation summaries on lead row." },
  { id: "recommendations", domain: "conversations", owner: "conversations", notes: "Top signals, buying intent, urgency recommendations." },
  { id: "classifications", domain: "inbox", owner: "inbox", notes: "Per-thread reply classifier for queue routing." },
  { id: "conversation-insights", domain: "conversations", owner: "conversations", notes: "Portfolio buckets: risk, objections, competitor pressure." },
  { id: "channel-context", domain: "shared-read-only", owner: "shared-read-only", notes: "Inbox shows channel badges; Conversations aggregates cross-channel context." },
  { id: "analytics", domain: "conversations", owner: "conversations", notes: "Dashboard metrics and portfolio health averages." },
]

export type GrowthInboxConversationsCrossLink = {
  id: string
  label: string
  fromSurface: "inbox" | "conversations"
  hrefPattern: string
  notes: string
}

export const GROWTH_INBOX_CONVERSATIONS_CROSS_LINKS: GrowthInboxConversationsCrossLink[] = [
  {
    id: "inbox-view-conversation",
    label: "View Conversation",
    fromSurface: "inbox",
    hrefPattern: "/growth/conversations?threadId={threadId}&leadId={leadId}",
    notes: "Opens intelligence surface with thread + lead context.",
  },
  {
    id: "inbox-view-timeline",
    label: "View Timeline",
    fromSurface: "inbox",
    hrefPattern: "/growth/conversations?leadId={leadId}",
    notes: "Opens lead-level conversation timeline in intelligence surface.",
  },
  {
    id: "conversations-reply",
    label: "Reply",
    fromSurface: "conversations",
    hrefPattern: "/growth/inbox?threadId={threadId}&leadId={leadId}",
    notes: "Returns operator to inbox action surface for reply execution.",
  },
  {
    id: "conversations-open-workflow",
    label: "Open Workflow",
    fromSurface: "conversations",
    hrefPattern: "/growth/inbox/workflow?leadId={leadId}",
    notes: "Opens workflow execution child route from intelligence context.",
  },
]

export type GrowthInboxConversationsConvergenceSurface = {
  id: string
  inboxSurface: string
  conversationsSurface: string
  status: "available" | "partial" | "deferred"
  notes: string
}

export const GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_MATRIX: GrowthInboxConversationsConvergenceSurface[] = [
  {
    id: "conversation-context-strip",
    inboxSurface: "Conversation column intelligence preview strip",
    conversationsSurface: "Lead conversation fields + dashboard buckets",
    status: "available",
    notes: "Read-only adapter from existing lead fetch in useGrowthInboxLeadContext — no new API.",
  },
  {
    id: "cross-links",
    inboxSurface: "View Conversation / View Timeline links",
    conversationsSurface: "Reply / Open Workflow links on dashboard leads",
    status: "available",
    notes: "Registry-driven workspace hrefs; no redirects or route migrations.",
  },
  {
    id: "inbox-overview-metrics",
    inboxSurface: "Conversation risk / sentiment shift metric strip",
    conversationsSurface: "Portfolio dashboard counts",
    status: "partial",
    notes: "Counts available via conversations dashboard API; inline metrics deferred to avoid duplicate fetch.",
  },
  {
    id: "inline-full-intelligence",
    inboxSurface: "Full GrowthConversationIntelligence card in action center",
    conversationsSurface: "Per-lead intelligence card",
    status: "partial",
    notes: "Compact preview in conversation column; full card remains drawer/intelligence surface.",
  },
  {
    id: "conversation-persistence",
    inboxSurface: "Thread message persistence",
    conversationsSurface: "Lead conversation field recompute",
    status: "deferred",
    notes: "No schema or persistence changes in Phase 7N.",
  },
  {
    id: "conversations-tab-shell",
    inboxSurface: "Inbox tab shell",
    conversationsSurface: "Conversations sub-routes",
    status: "deferred",
    notes: "Conversations tab shell and route migration explicitly deferred.",
  },
  {
    id: "conversations-deep-link",
    inboxSurface: "Inbox View Conversation / View Timeline links",
    conversationsSurface: "Query-param lead/thread focus on dashboard",
    status: "available",
    notes: "Phase 7O — client-side deep-link focus without API or route changes.",
  },
]

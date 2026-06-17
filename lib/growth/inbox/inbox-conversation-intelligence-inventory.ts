/**
 * Conversation ↔ Inbox convergence inventory (Phase 7N).
 *
 * Documents existing conversation intelligence sources — read-only audit manifest.
 */

export const GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY_QA_MARKER =
  "growth-inbox-conversation-intelligence-inventory-v1" as const

export type GrowthInboxConversationSourceKind =
  | "lead_conversation_fields"
  | "conversation_dashboard"
  | "reply_timeline"
  | "reply_copilot"
  | "voice_call_intelligence"
  | "relationship_memory"
  | "reply_classifier"

export type GrowthInboxConversationInventoryEntry = {
  id: string
  label: string
  sourceKind: GrowthInboxConversationSourceKind
  tables: string[]
  apis: string[]
  readModels: string[]
  hooks: string[]
  components: string[]
  providers: string[]
  notes: string
}

export const GROWTH_INBOX_CONVERSATION_INTELLIGENCE_INVENTORY: GrowthInboxConversationInventoryEntry[] = [
  {
    id: "lead-conversation-fields",
    label: "Lead conversation intelligence columns",
    sourceKind: "lead_conversation_fields",
    tables: ["growth.leads"],
    apis: ["/api/platform/growth/leads/{id}"],
    readModels: ["GrowthLead", "GrowthInboxConversationIntelligencePreview"],
    hooks: ["useGrowthInboxLeadContext"],
    components: [
      "components/growth/growth-conversation-intelligence.tsx",
      "components/growth/inbox/growth-inbox-conversation-intelligence-context-strip.tsx",
    ],
    providers: ["computeGrowthLeadConversationIntelligence", "recomputeGrowthLeadConversationIntelligence"],
    notes:
      "Canonical per-lead conversation score, summary, sentiment, momentum, objections — computed on lead row, not duplicated in inbox.",
  },
  {
    id: "conversation-dashboard",
    label: "Portfolio conversation dashboard",
    sourceKind: "conversation_dashboard",
    tables: ["growth.leads"],
    apis: ["/api/platform/growth/conversations/dashboard"],
    readModels: ["GrowthConversationDashboardPayload"],
    hooks: [],
    components: [
      "components/growth/growth-conversations-dashboard.tsx",
      "components/growth/intelligence/growth-conversations-dashboard-body.tsx",
    ],
    providers: ["fetchGrowthConversationDashboard"],
    notes: "Intelligence surface only — portfolio buckets (health, risk, sentiment shift). Not an action queue.",
  },
  {
    id: "reply-timeline",
    label: "Reply / channel timeline",
    sourceKind: "reply_timeline",
    tables: ["growth.inbox_threads", "growth.inbox_messages"],
    apis: ["/api/platform/growth/replies/timeline", "/api/platform/growth/inbox/thread/{id}"],
    readModels: ["GrowthConversationTimelineEntry", "GrowthInboxThread"],
    hooks: ["useGrowthInboxLeadContext", "useGrowthInboxWorkspace"],
    components: [
      "components/growth/inbox/growth-inbox-conversation-column.tsx",
      "components/growth/inbox/growth-inbox-relationship-timeline.tsx",
    ],
    providers: [],
    notes: "Thread message history and reply timeline — action context lives in Inbox; deep analysis in Conversations.",
  },
  {
    id: "reply-copilot",
    label: "Reply copilot assist",
    sourceKind: "reply_copilot",
    tables: [],
    apis: ["/api/platform/growth/replies/copilot"],
    readModels: ["GrowthReplyCopilotAssist"],
    hooks: ["useGrowthInboxLeadContext"],
    components: ["components/growth/inbox/growth-inbox-action-center-copilot-embed.tsx"],
    providers: [],
    notes: "Operator reply drafting — Inbox action surface only.",
  },
  {
    id: "voice-call-intelligence",
    label: "Live call conversation intelligence",
    sourceKind: "voice_call_intelligence",
    tables: ["growth.call_intelligence_scorecards"],
    apis: ["/api/platform/growth/calls/dashboard"],
    readModels: ["CallIntelligenceScorecardPublicView"],
    hooks: [],
    components: ["components/growth/growth-call-workspace-conversation-intelligence-panel.tsx"],
    providers: ["emitCallIntelligenceNotifications"],
    notes: "Per-call live intelligence — Calls workspace execution; lead-field aggregate converges in Conversations.",
  },
  {
    id: "relationship-memory",
    label: "Relationship memory strip",
    sourceKind: "relationship_memory",
    tables: ["growth.lead_memory_profiles"],
    apis: ["/api/platform/growth/lead-memory/profile/{id}"],
    readModels: ["GrowthLeadMemoryProfileView"],
    hooks: ["useGrowthInboxLeadContext"],
    components: ["components/growth/inbox/growth-inbox-relationship-memory-strip.tsx"],
    providers: [],
    notes: "Relationship context adjacent to conversation column — complements but does not replace conversation intelligence.",
  },
  {
    id: "reply-classifier",
    label: "Thread reply classifier",
    sourceKind: "reply_classifier",
    tables: ["growth.inbox_threads"],
    apis: ["/api/platform/growth/inbox"],
    readModels: ["GrowthInboxThread"],
    hooks: ["useGrowthInboxWorkspace"],
    components: ["lib/growth/inbox/reply-classifier.ts"],
    providers: [],
    notes: "Deterministic thread classification for inbox queue — action routing, not portfolio analytics.",
  },
]

export type GrowthInboxConversationRouteEntry = {
  id: string
  label: string
  workspacePath: string
  adminPath: string
  registryRouteId: string
  sidebarGroup: "workspace" | "intelligence"
  purpose: string
}

export const GROWTH_INBOX_CONVERSATIONS_ROUTE_INVENTORY: GrowthInboxConversationRouteEntry[] = [
  {
    id: "workspace-inbox",
    label: "Inbox",
    workspacePath: "/growth/inbox",
    adminPath: "/admin/growth/inbox",
    registryRouteId: "workspace-inbox",
    sidebarGroup: "workspace",
    purpose: "Operator action surface — queue, workflow, reply intelligence, notifications, operator actions.",
  },
  {
    id: "workspace-inbox-workflow",
    label: "Reply Workflow",
    workspacePath: "/growth/inbox/workflow",
    adminPath: "/admin/growth/replies/workflow",
    registryRouteId: "workspace-inbox-workflow",
    sidebarGroup: "workspace",
    purpose: "Workflow execution child of Inbox — human-approved reply and follow-up actions.",
  },
  {
    id: "workspace-conversations",
    label: "Conversations",
    workspacePath: "/growth/conversations",
    adminPath: "/admin/growth/conversations",
    registryRouteId: "workspace-conversations",
    sidebarGroup: "intelligence",
    purpose: "Intelligence surface — portfolio conversation health, sentiment, risk, objections, summaries.",
  },
]

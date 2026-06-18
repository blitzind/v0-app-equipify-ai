/**
 * Documented inventory of Growth Inbox initial-load platform API requests (Phase 8F.2, updated 8J).
 * Source-of-truth for audits — update when fetch paths change.
 * Phase 8J contract: `lib/growth/inbox/growth-inbox-minimal-runtime-contract.ts`
 */

export const GROWTH_INBOX_REQUEST_INVENTORY_QA_MARKER = "growth-inbox-request-inventory-v2" as const

export type GrowthInboxRequestInventoryEntry = {
  endpoint: string
  sourceComponent: string
  purpose: string
  criticalOnFirstPaint: boolean
  deferUntilThreadSelection: boolean
  lazyLoadAfterFirstRender: boolean
}

/** Post-8F.2 stagger plan — critical first paint vs deferred. */
export const GROWTH_INBOX_REQUEST_INVENTORY: GrowthInboxRequestInventoryEntry[] = [
  {
    endpoint: "/api/platform/growth/inbox",
    sourceComponent: "GrowthInboxWorkspaceProvider",
    purpose: "Thread queue list",
    criticalOnFirstPaint: true,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: false,
  },
  {
    endpoint: "/api/platform/growth/inbox/dashboard",
    sourceComponent: "GrowthInboxWorkspaceProvider",
    purpose: "Thread queue metrics + merged threads",
    criticalOnFirstPaint: true,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: false,
  },
  {
    endpoint: "/api/platform/growth/inbox/sync/dashboard",
    sourceComponent: "GrowthInboxWorkspaceProvider",
    purpose: "Setup/empty-state sync health",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/mailboxes",
    sourceComponent: "GrowthInboxWorkspaceProvider",
    purpose: "Mailbox connection count for setup state",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/inbox/thread/{id}",
    sourceComponent: "GrowthInboxWorkspaceProvider",
    purpose: "Selected conversation messages + sync detail",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/operator-inbox",
    sourceComponent: "GrowthOperatorInboxPanel",
    purpose: "Compact operator notifications",
    criticalOnFirstPaint: true,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: false,
  },
  {
    endpoint: "/api/growth/workspace/settings/default-views",
    sourceComponent: "useGrowthWorkspaceDefaultViewsReadonly",
    purpose: "Saved inbox/calls/opportunities defaults",
    criticalOnFirstPaint: true,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: false,
  },
  {
    endpoint: "/api/platform/growth/replies/dashboard",
    sourceComponent: "GrowthInboxOverviewMetricsPanel",
    purpose: "Workflow/unread metric counts",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/calls/queue",
    sourceComponent: "useGrowthInboxCallCommunications",
    purpose: "Callbacks metric + call queue views",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/calls/dashboard",
    sourceComponent: "useGrowthInboxCallCommunications",
    purpose: "Call session preview for callbacks metric",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: false,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/leads/{leadId}",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Conversation intelligence strip + action center",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/replies/timeline",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Relationship timeline in conversation",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/lead-memory/profile/{leadId}",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Relationship memory strip enrichment",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/replies/copilot",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Action center copilot embed",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/revenue-execution/forecast-evidence",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Inline revenue context",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/revenue-execution/execution-plan",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Inline revenue execution plan",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/replies/workflow-actions",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Action center workflow embeds",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/replies/sequence-exit-candidates",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Sequence exit candidates in action center",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/opportunities/dashboard",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Opportunity recommendations embed",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/booking-intelligence/recommendations",
    sourceComponent: "GrowthInboxLeadContextProvider",
    purpose: "Booking recommendations embed",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
  {
    endpoint: "/api/platform/growth/revenue-execution/command-center",
    sourceComponent: "GrowthInboxSharedDataProvider",
    purpose: "Command center lead cross-reference",
    criticalOnFirstPaint: false,
    deferUntilThreadSelection: true,
    lazyLoadAfterFirstRender: true,
  },
]

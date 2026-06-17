/**
 * Call ↔ Inbox convergence inventory (Phase 7K).
 *
 * Documents existing call outcome sources — read-only audit manifest.
 */

export const GROWTH_INBOX_CALL_COMMUNICATION_INVENTORY_QA_MARKER =
  "growth-inbox-call-communication-inventory-v1" as const

export type GrowthInboxCallSourceKind =
  | "native_dialer_queue"
  | "native_call_session"
  | "native_call_wrapup"
  | "call_intelligence_scorecard"
  | "human_execution_queue"
  | "cadence_task"
  | "lead_call_disposition"
  | "operator_inbox_attention"
  | "timeline_event"

export type GrowthInboxCallInventoryEntry = {
  id: string
  label: string
  sourceKind: GrowthInboxCallSourceKind
  tables: string[]
  apis: string[]
  readModels: string[]
  hooks: string[]
  aggregators: string[]
  notificationEmitters: string[]
  notes: string
}

export const GROWTH_INBOX_CALL_OUTCOME_INVENTORY: GrowthInboxCallInventoryEntry[] = [
  {
    id: "native-dialer-queue",
    label: "Native dialer queue items",
    sourceKind: "native_dialer_queue",
    tables: ["growth.native_dialer_queue_items"],
    apis: ["/api/platform/growth/calls/queue", "/api/platform/growth/calls/dashboard"],
    readModels: ["NativeDialerQueueItemPublicView", "GrowthInboxCallCommunicationItem"],
    hooks: ["useGrowthInboxCallCommunications"],
    aggregators: ["fetchGrowthNativeDialerQueue", "aggregateOperatorInboxQueue"],
    notificationEmitters: ["emitNativeDialerNotifications"],
    notes: "Queue modes callback, missed_callback, priority map to inbox call communication kinds.",
  },
  {
    id: "native-call-sessions",
    label: "Call sessions (missed / no answer)",
    sourceKind: "native_call_session",
    tables: ["growth.native_call_workspace_sessions"],
    apis: ["/api/platform/growth/calls/dashboard"],
    readModels: ["NativeCallWorkspaceSessionPublicView", "GrowthInboxCallCommunicationItem"],
    hooks: ["useGrowthInboxCallCommunications"],
    aggregators: ["fetchNativeCallWorkspaceDashboard"],
    notificationEmitters: [],
    notes: "Recent sessions with status missed or no_answer surface as missed_call read-model items.",
  },
  {
    id: "native-call-wrapups",
    label: "Call wrap-up outcomes",
    sourceKind: "native_call_wrapup",
    tables: ["growth.native_call_wrapups"],
    apis: ["/api/platform/growth/calls/dashboard"],
    readModels: ["NativeCallWrapupPublicView"],
    hooks: [],
    aggregators: ["fetchNativeCallWorkspaceDashboard"],
    notificationEmitters: ["emitNativeDialerNotifications"],
    notes: "Outcomes left_voicemail and follow_up_needed inform voicemail and call_follow_up kinds.",
  },
  {
    id: "call-intelligence",
    label: "Call intelligence scorecards",
    sourceKind: "call_intelligence_scorecard",
    tables: ["growth.call_intelligence_scorecards"],
    apis: ["/api/platform/growth/calls/dashboard"],
    readModels: ["CallIntelligenceScorecardPublicView"],
    hooks: [],
    aggregators: ["fetchGrowthCallCopilotDashboard"],
    notificationEmitters: ["emitCallIntelligenceNotifications"],
    notes: "Coaching recommendations and call_followup_due notifications; CTA currently command lead focus.",
  },
  {
    id: "human-execution",
    label: "Human execution call tasks",
    sourceKind: "human_execution_queue",
    tables: ["growth.human_execution_plans", "growth.human_execution_plan_steps"],
    apis: ["/api/platform/growth/operator-inbox"],
    readModels: ["HumanExecutionQueueItem", "OperatorInboxItem"],
    hooks: ["useGrowthInboxCallCommunications"],
    aggregators: ["fetchHumanExecutionQueue", "normalizeHumanApprovalItem"],
    notificationEmitters: [],
    notes: "manual_call and voicemail channels map to call_follow_up and voicemail inbox kinds.",
  },
  {
    id: "cadence-tasks",
    label: "Cadence manual call / voicemail tasks",
    sourceKind: "cadence_task",
    tables: ["growth.cadence_tasks"],
    apis: [],
    readModels: ["GrowthCadenceTask"],
    hooks: [],
    aggregators: ["fetchCadenceDashboard"],
    notificationEmitters: ["emitCadenceTaskDueNotification", "emitCadenceTaskOverdueNotification"],
    notes: "Due/overdue cadence tasks emit manual_call_due notifications with workspace inbox/call CTAs.",
  },
  {
    id: "lead-disposition",
    label: "Lead call disposition fields",
    sourceKind: "lead_call_disposition",
    tables: ["growth.leads"],
    apis: ["/api/platform/growth/inbox"],
    readModels: ["GrowthInboxThread (email/sms only)"],
    hooks: [],
    aggregators: ["listInboxThreads"],
    notificationEmitters: [],
    notes: "call_disposition, follow_up_at on leads — not directly on inbox threads; used indirectly via queues.",
  },
]

export type GrowthInboxCallNotificationRoutingRow = {
  id: string
  notificationType: string
  currentDestination: string
  idealDestination: string
  inboxCta: boolean
  status: "documented" | "workspace-aligned" | "deferred"
  notes: string
}

/** Notification routing audit — workspace-aligned in Phase 7L. */
export const GROWTH_INBOX_CALL_NOTIFICATION_ROUTING_AUDIT: GrowthInboxCallNotificationRoutingRow[] = [
  {
    id: "callback-due",
    notificationType: "callback_due",
    currentDestination: "growthCallNotificationActionHref → /growth/calls/workspace?dialMode=callback",
    idealDestination: "/growth/calls/workspace?leadId=…&queueItemId=…&dialMode=callback",
    inboxCta: true,
    status: "workspace-aligned",
    notes: "Operator lands in call workspace; inbox read model surfaces same queue item.",
  },
  {
    id: "missed-callback",
    notificationType: "missed_callback",
    currentDestination: "growthCallNotificationActionHref → /growth/calls/workspace?dialMode=missed_callback",
    idealDestination: "/growth/calls/workspace?leadId=…&dialMode=missed_callback",
    inboxCta: true,
    status: "workspace-aligned",
    notes: "Maps to missed_call communication kind in inbox queue views.",
  },
  {
    id: "call-followup-due",
    notificationType: "call_followup_due",
    currentDestination: "growthCallNotificationActionHref → /growth/inbox?view=call_follow_up",
    idealDestination: "/growth/inbox?view=call_follow_up or /growth/calls/workspace?leadId=…",
    inboxCta: true,
    status: "workspace-aligned",
    notes: "Call intelligence follow-up notifications route to inbox call follow-up queue.",
  },
  {
    id: "call-score-low",
    notificationType: "call_score_low",
    currentDestination: "growthWorkspaceCallsCoachingHref → /growth/calls/coaching",
    idealDestination: "/growth/calls/coaching?leadId=…&callSessionId=…",
    inboxCta: false,
    status: "workspace-aligned",
    notes: "Coaching notifications route to Calls coaching workspace.",
  },
  {
    id: "manual-call-due",
    notificationType: "manual_call_due",
    currentDestination: "growthCallNotificationActionHref → /growth/inbox?view=call_follow_up",
    idealDestination: "/growth/inbox?view=call_follow_up&leadId=…",
    inboxCta: true,
    status: "workspace-aligned",
    notes: "Cadence manual call tasks route to inbox call follow-up queue.",
  },
  {
    id: "priority-call-ready",
    notificationType: "priority_call_ready",
    currentDestination: "growthCallNotificationActionHref → /growth/calls/workspace",
    idealDestination: "/growth/calls/workspace?leadId=…",
    inboxCta: true,
    status: "workspace-aligned",
    notes: "Surfaces as call_follow_up in inbox read model when priority queue item present.",
  },
]

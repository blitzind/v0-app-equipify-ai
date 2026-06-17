/**
 * Calls ↔ Inbox convergence architecture manifest (Phase 7K).
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_CALLS_HUB_WORKSPACE_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import {
  GROWTH_INBOX_CALL_QUEUE_VIEWS,
  GROWTH_INBOX_CALL_COMMUNICATION_KINDS,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"

export const GROWTH_INBOX_CALLS_CONVERGENCE_QA_MARKER = "growth-inbox-calls-convergence-v1" as const

export const GROWTH_INBOX_CALLS_CONVERGENCE_PRINCIPLE =
  "Inbox is the Operator Communication Queue; Calls remains the dedicated Calling Workspace." as const

export const GROWTH_INBOX_CALLS_PRESERVED_ROUTES = [
  `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
  `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
  `${GROWTH_WORKSPACE_BASE_PATH}/calls`,
  GROWTH_CALLS_HUB_WORKSPACE_HREF,
] as const

/** Call queue filters — not routes. */
export const GROWTH_INBOX_CALL_CONVERGENCE_QUEUE_VIEWS = GROWTH_INBOX_CALL_QUEUE_VIEWS

export const GROWTH_INBOX_CALL_CONVERGENCE_KINDS = GROWTH_INBOX_CALL_COMMUNICATION_KINDS

export type GrowthInboxCallsConvergenceSurface = {
  id: string
  inboxSurface: string
  callsSurface: string
  status: "available" | "partial" | "deferred"
  notes: string
}

export const GROWTH_INBOX_CALLS_CONVERGENCE_MATRIX: GrowthInboxCallsConvergenceSurface[] = [
  {
    id: "call-queue-filters",
    inboxSurface: "Thread queue call_follow_up / callback_requested / voicemail views",
    callsSurface: "Native dialer queue + call workspace",
    status: "available",
    notes: "Derived read model from existing /calls/queue and /calls/dashboard APIs.",
  },
  {
    id: "call-overview-metrics",
    inboxSurface: "Inbox Overview call metric strip",
    callsSurface: "Call workspace dashboard metrics",
    status: "available",
    notes: "Read-only counts from call communication read model — no new aggregation pipeline.",
  },
  {
    id: "call-action-links",
    inboxSurface: "Action Center Call Actions",
    callsSurface: "/growth/calls/workspace, /growth/calls/coaching",
    status: "available",
    notes: "Registry-driven workspace hrefs; no call execution behavior changes.",
  },
  {
    id: "call-coaching-inline",
    inboxSurface: "Inline coaching recommendations in inbox thread",
    callsSurface: "Live coaching center",
    status: "partial",
    notes: "Coaching link provided; full inline coaching deferred.",
  },
  {
    id: "call-execution",
    inboxSurface: "Dial / bridge / wrap-up",
    callsSurface: "Call workspace execution",
    status: "deferred",
    notes: "Call execution remains Calls-only per Phase 7K constraints.",
  },
]

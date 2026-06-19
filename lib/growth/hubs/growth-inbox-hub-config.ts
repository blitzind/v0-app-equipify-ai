/** Inbox operator home configuration (UX-AUDIT-7). Client-safe. */

import type { GrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { growthWorkspaceInboxViewHref, growthWorkspaceInboxWorkflowHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_INBOX_HUB_UX_QA_MARKER = "growth-inbox-operator-home-v1" as const

export type GrowthInboxHubActionCard = {
  id: string
  label: string
  helper: string
  cta: string
  href: string
  metricKey: keyof Pick<
    GrowthInboxOverviewMetrics,
    "needsAction" | "interested" | "meetingIntent" | "unreadConversations"
  >
  view?: GrowthInboxQueueView
}

export const GROWTH_INBOX_HUB_ACTION_CARDS: GrowthInboxHubActionCard[] = [
  {
    id: "needs-attention",
    label: "Needs Attention",
    helper: "Threads requiring review or follow-up",
    cta: "Open Queue",
    href: growthWorkspaceInboxViewHref("needs_action"),
    metricKey: "needsAction",
    view: "needs_action",
  },
  {
    id: "interested-prospects",
    label: "Interested Prospects",
    helper: "Positive replies and referral signals",
    cta: "Review Replies",
    href: growthWorkspaceInboxViewHref("interested"),
    metricKey: "interested",
    view: "interested",
  },
  {
    id: "meetings-booked",
    label: "Meetings Booked",
    helper: "Meeting intent and booking follow-ups",
    cta: "Prepare Follow-Up",
    href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
    metricKey: "meetingIntent",
    view: "meeting_intent",
  },
  {
    id: "unread-messages",
    label: "Unread Messages",
    helper: "Conversations awaiting operator review",
    cta: "Open Inbox",
    href: growthWorkspaceInboxViewHref("all"),
    metricKey: "unreadConversations",
    view: "all",
  },
]

export const GROWTH_INBOX_HUB_ADVANCED_TOOLS = [
  {
    id: "workflow",
    label: "Workflow",
    description: "Reply workflow actions and copilot drafting",
    href: growthWorkspaceInboxWorkflowHref(),
  },
  {
    id: "approvals",
    label: "Approvals",
    description: "Human approval queues for outbound actions",
    href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
  },
  {
    id: "diagnostics",
    label: "System diagnostics",
    description: "Inbox sync health and operator diagnostics",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations`,
  },
  {
    id: "operations",
    label: "Channel operations",
    description: "Orchestration and archived operator surfaces",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations`,
  },
] as const

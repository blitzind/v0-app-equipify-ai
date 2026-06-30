/** Inbox conversation workspace UX config (UX-AUDIT-8). Client-safe. */

import { GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import {
  growthWorkspaceCallWorkspaceHref,
  growthWorkspaceCallsCoachingHref,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"
import {
  growthWorkspaceInboxWorkflowHref,
  growthWorkspaceLeadHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER = "growth-inbox-conversation-workspace-v2" as const
export const GROWTH_INBOX_FINAL_POLISH_QA_MARKER = "growth-inbox-final-polish-v1" as const

export type GrowthInboxCrmSummaryChip = {
  label: string
  value: string
}

export function buildGrowthInboxCrmSummaryChips(input: {
  fitScore: number | null | undefined
  stageLabel: string | null | undefined
  ownerLabel: string | null | undefined
  meetingLabel: string | null | undefined
  sequenceLabel: string | null | undefined
}): GrowthInboxCrmSummaryChip[] {
  const chips: GrowthInboxCrmSummaryChip[] = []
  if (input.fitScore != null && Number.isFinite(input.fitScore)) {
    chips.push({ label: "Fit", value: String(Math.round(input.fitScore)) })
  }
  if (input.stageLabel?.trim()) chips.push({ label: "Stage", value: input.stageLabel.trim() })
  if (input.ownerLabel?.trim()) chips.push({ label: "Owner", value: input.ownerLabel.trim() })
  if (input.meetingLabel?.trim()) chips.push({ label: "Meeting", value: input.meetingLabel.trim() })
  if (input.sequenceLabel?.trim()) chips.push({ label: "Sequence", value: input.sequenceLabel.trim() })
  return chips
}

export type GrowthInboxConversationRouteAuditEntry = {
  source: string
  action: string
  currentRoute: string
  workspaceRoute: string
  status: "workspace" | "in_panel" | "admin_only"
}

/** Static inventory of destinations reachable from the conversation workspace. */
export const GROWTH_INBOX_CONVERSATION_ROUTE_INVENTORY: GrowthInboxConversationRouteAuditEntry[] = [
  {
    source: "/growth/inbox",
    action: "Open Lead",
    currentRoute: `${GROWTH_WORKSPACE_BASE_PATH}/leads/{leadId}`,
    workspaceRoute: growthWorkspaceLeadHref("{leadId}"),
    status: "workspace",
  },
  {
    source: "/growth/inbox",
    action: "Open Call Workspace",
    currentRoute: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace?leadId={leadId}`,
    workspaceRoute: growthWorkspaceCallWorkspaceHref({ leadId: "{leadId}" }),
    status: "workspace",
  },
  {
    source: "/growth/inbox",
    action: "Start Callback",
    currentRoute: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace?leadId={leadId}&dialMode=callback`,
    workspaceRoute: growthWorkspaceCallWorkspaceHref({ leadId: "{leadId}", dialMode: "callback" }),
    status: "workspace",
  },
  {
    source: "/growth/inbox",
    action: "Review Voicemail",
    currentRoute: `${GROWTH_WORKSPACE_BASE_PATH}/calls/workspace?leadId={leadId}&dialMode=missed_callback`,
    workspaceRoute: growthWorkspaceCallWorkspaceHref({ leadId: "{leadId}", dialMode: "missed_callback" }),
    status: "workspace",
  },
  {
    source: "/growth/inbox",
    action: "Review Coaching",
    currentRoute: `${GROWTH_WORKSPACE_BASE_PATH}/calls/coaching?leadId={leadId}`,
    workspaceRoute: growthWorkspaceCallsCoachingHref({ leadId: "{leadId}" }),
    status: "workspace",
  },
  {
    source: "/growth/inbox",
    action: "Create Task",
    currentRoute: "in-panel workflow action",
    workspaceRoute: "in-panel workflow action",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Create Opportunity",
    currentRoute: "in-panel review dialog",
    workspaceRoute: "in-panel review dialog",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Book Meeting",
    currentRoute: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
    workspaceRoute: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
    status: "workspace",
  },
  {
    source: "/growth/inbox",
    action: "Assign",
    currentRoute: "in-panel thread action",
    workspaceRoute: "in-panel thread action",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Archive",
    currentRoute: "in-panel thread action",
    workspaceRoute: "in-panel thread action",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Reply with Ava",
    currentRoute: "in-panel intelligence sidebar",
    workspaceRoute: "in-panel intelligence sidebar",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Opportunity Recommendations",
    currentRoute: "in-panel intelligence sidebar",
    workspaceRoute: "in-panel intelligence sidebar",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Booking Recommendations",
    currentRoute: "in-panel intelligence sidebar",
    workspaceRoute: "in-panel intelligence sidebar",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Revenue Command Center",
    currentRoute: "in-panel on-demand intelligence",
    workspaceRoute: "in-panel on-demand intelligence",
    status: "in_panel",
  },
  {
    source: "/growth/inbox",
    action: "Reply / Draft",
    currentRoute: growthWorkspaceInboxWorkflowHref("{leadId}"),
    workspaceRoute: growthWorkspaceInboxWorkflowHref("{leadId}"),
    status: "workspace",
  },
]

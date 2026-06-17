/** Client-safe call notification and operator CTA link builders (Phase 7L). */

import type { GrowthInboxCallQueueView } from "@/lib/growth/inbox/inbox-call-communication-read-model"
import { GROWTH_CALLS_HUB_WORKSPACE_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { growthWorkspaceInboxHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_CALL_NOTIFICATION_LINKS_QA_MARKER = "growth-call-notification-links-v1" as const

export const GROWTH_CALL_NOTIFICATION_LINK_TYPES = [
  "manual_call_due",
  "call_followup_due",
  "callback_due",
  "missed_callback",
  "call_score_low",
  "voicemail",
  "priority_call_ready",
] as const

export type GrowthCallNotificationLinkType = (typeof GROWTH_CALL_NOTIFICATION_LINK_TYPES)[number]

export function growthWorkspaceCallWorkspaceHref(input?: {
  leadId?: string | null
  phone?: string | null
  queueItemId?: string | null
  dialMode?: string | null
  callSessionId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.phone) params.set("phone", input.phone)
  if (input?.queueItemId) params.set("queueItemId", input.queueItemId)
  if (input?.dialMode) params.set("dialMode", input.dialMode)
  if (input?.callSessionId) params.set("callSessionId", input.callSessionId)
  const query = params.toString()
  return query ? `${GROWTH_CALLS_HUB_WORKSPACE_HREF}?${query}` : GROWTH_CALLS_HUB_WORKSPACE_HREF
}

export function growthWorkspaceCallsCoachingHref(input?: {
  leadId?: string | null
  callSessionId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.callSessionId) params.set("callSessionId", input.callSessionId)
  const query = params.toString()
  return query ? `${GROWTH_WORKSPACE_BASE_PATH}/calls/coaching?${query}` : `${GROWTH_WORKSPACE_BASE_PATH}/calls/coaching`
}

export function growthWorkspaceLeadQueueHref(leadId?: string | null): string {
  if (!leadId) return `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue`
  const params = new URLSearchParams({ highlight: leadId })
  return `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue?${params.toString()}`
}

export function growthWorkspaceInboxCallViewHref(
  view: GrowthInboxCallQueueView,
  input?: { leadId?: string | null; preserve?: { toString(): string } | null },
): string {
  const params = new URLSearchParams(input?.preserve?.toString() ?? "")
  params.set("view", view)
  if (input?.leadId) params.set("leadId", input.leadId)
  return `${GROWTH_WORKSPACE_BASE_PATH}/inbox?${params.toString()}`
}

export function growthCallNotificationActionHref(input: {
  notificationType: GrowthCallNotificationLinkType | string
  leadId?: string | null
  queueItemId?: string | null
  callSessionId?: string | null
  phone?: string | null
  channel?: string | null
}): string {
  switch (input.notificationType) {
    case "manual_call_due":
    case "call_followup_due":
      return growthWorkspaceInboxHref({ leadId: input.leadId, view: "call_follow_up" })
    case "callback_due":
      return growthWorkspaceCallWorkspaceHref({
        leadId: input.leadId,
        queueItemId: input.queueItemId,
        phone: input.phone,
        dialMode: "callback",
      })
    case "missed_callback":
      return growthWorkspaceCallWorkspaceHref({
        leadId: input.leadId,
        queueItemId: input.queueItemId,
        phone: input.phone,
        dialMode: "missed_callback",
      })
    case "call_score_low":
      return growthWorkspaceCallsCoachingHref({
        leadId: input.leadId,
        callSessionId: input.callSessionId,
      })
    case "voicemail":
      if (input.channel === "voicemail") {
        return growthWorkspaceInboxHref({ leadId: input.leadId, view: "voicemail" })
      }
      return growthWorkspaceCallWorkspaceHref({
        leadId: input.leadId,
        dialMode: "missed_callback",
      })
    case "priority_call_ready":
      return growthWorkspaceCallWorkspaceHref({
        leadId: input.leadId,
        queueItemId: input.queueItemId,
        phone: input.phone,
      })
    default:
      return growthWorkspaceCallWorkspaceHref({ leadId: input.leadId })
  }
}

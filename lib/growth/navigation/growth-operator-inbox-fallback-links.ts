/** Client-safe operator inbox fallback link builders (Phase 7M). */

import { GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import {
  growthWorkspaceCallWorkspaceHref,
  growthWorkspaceCallsCoachingHref,
} from "@/lib/growth/navigation/growth-call-notification-links"
import {
  growthWorkspaceInboxHref,
  growthWorkspaceLeadHref,
  growthWorkspacePipelineHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"

export const GROWTH_OPERATOR_INBOX_FALLBACK_LINKS_QA_MARKER = "growth-operator-inbox-fallback-links-v1" as const

export type GrowthOperatorInboxFallbackInput = {
  notificationType?: string | null
  sourceSystem?: string | null
  leadId?: string | null
  opportunityId?: string | null
  replyId?: string | null
  threadId?: string | null
  callSessionId?: string | null
  channel?: string | null
}

const REPLY_NOTIFICATION_TYPES = new Set([
  "reply_waiting",
  "reply_overdue",
  "meeting_request_received",
  "competitor_mentioned",
  "high_priority_reply",
  "owner_response_gap",
])

const CALL_FOLLOW_UP_NOTIFICATION_TYPES = new Set([
  "manual_call_due",
  "call_followup_due",
  "post_meeting_followup_due",
  "followup_needed",
  "followup_missing",
  "cadence_task_due",
  "cadence_task_overdue",
])

const CALLBACK_NOTIFICATION_TYPES = new Set(["callback_due", "missed_callback"])

const COACHING_NOTIFICATION_TYPES = new Set([
  "call_score_low",
  "next_step_missing",
  "competitor_risk_detected",
  "unresolved_objection",
  "strong_buying_signal",
  "objection_detected",
  "discovery_gap_detected",
  "provider_retry_warning",
])

const LEAD_NOTIFICATION_TYPES = new Set([
  "lead_assigned",
  "reassigned",
  "high_priority_unassigned",
  "high_fit_lead",
  "buying_signal_detected",
  "engagement_spike",
])

const OPPORTUNITY_NOTIFICATION_TYPES = new Set([
  "opportunity_at_risk",
  "stale_opportunity",
  "close_date_passed",
  "deal_risk_increased",
  "high_probability_deal",
  "forecast_confidence_dropped",
  "close_window_detected",
  "deal_needs_action",
  "stale_high_value_deal",
  "close_date_slipped",
  "commit_risk",
])

const CALL_WORKSPACE_NOTIFICATION_TYPES = new Set([
  "priority_call_ready",
  "call_now_opportunity",
  "meeting_booked_from_call",
])

const ADMIN_CONTROL_PLANE_NOTIFICATION_TYPES = new Set([
  "provider_execution_failed",
  "provider_degraded",
  "provider_circuit_open",
  "provider_disconnected",
  "sequence_failed",
  "suppression_blocked",
  "dogfood_failure",
  "dogfood_blocker",
  "validation_complete",
  "calendar_sync_failed",
  "approval_required",
  "execution_ready",
  "execution_approval_needed",
  "execution_stalled",
])

function resolveAdminControlPlaneFallback(notificationType: string, leadId?: string | null): string {
  if (notificationType.startsWith("provider_")) return growthEngineCustomerSettingsHref("connected-mailboxes")
  if (notificationType === "sequence_failed") return GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF
  if (notificationType === "suppression_blocked") return growthEngineCustomerSettingsHref("sending-limits")
  if (notificationType.startsWith("dogfood_") || notificationType === "validation_complete") {
    return "/admin/growth/dogfood"
  }
  if (notificationType === "calendar_sync_failed") return "/admin/growth/calendar"
  if (
    notificationType === "approval_required" ||
    notificationType === "execution_ready" ||
    notificationType === "execution_approval_needed" ||
    notificationType === "execution_stalled"
  ) {
    return leadId ? `/admin/growth/execution?leadId=${encodeURIComponent(leadId)}` : "/admin/growth/execution"
  }
  return "/admin/growth/operations"
}

export function growthOperatorInboxFallbackHref(input?: GrowthOperatorInboxFallbackInput): string {
  const notificationType = input?.notificationType ?? null
  const leadId = input?.leadId ?? null
  const opportunityId = input?.opportunityId ?? null

  if (input?.replyId) {
    return growthWorkspaceInboxHref({ replyId: input.replyId, leadId, view: "needs_action" })
  }
  if (input?.threadId) {
    return growthWorkspaceInboxHref({ threadId: input.threadId, leadId })
  }

  if (notificationType && ADMIN_CONTROL_PLANE_NOTIFICATION_TYPES.has(notificationType)) {
    return resolveAdminControlPlaneFallback(notificationType, leadId)
  }

  if (notificationType) {
    if (input?.channel === "voicemail") {
      return growthWorkspaceInboxHref({ leadId, view: "voicemail" })
    }
    if (REPLY_NOTIFICATION_TYPES.has(notificationType)) {
      return growthWorkspaceInboxHref({ leadId, view: "needs_action" })
    }
    if (CALLBACK_NOTIFICATION_TYPES.has(notificationType)) {
      return growthWorkspaceInboxHref({ leadId, view: "callback_requested" })
    }
    if (CALL_FOLLOW_UP_NOTIFICATION_TYPES.has(notificationType)) {
      return growthWorkspaceInboxHref({ leadId, view: "call_follow_up" })
    }
    if (COACHING_NOTIFICATION_TYPES.has(notificationType)) {
      return growthWorkspaceCallsCoachingHref({ leadId, callSessionId: input?.callSessionId })
    }
    if (CALL_WORKSPACE_NOTIFICATION_TYPES.has(notificationType)) {
      return growthWorkspaceCallWorkspaceHref({ leadId, callSessionId: input?.callSessionId })
    }
    if (OPPORTUNITY_NOTIFICATION_TYPES.has(notificationType) || opportunityId) {
      return growthWorkspacePipelineHref(opportunityId)
    }
    if (LEAD_NOTIFICATION_TYPES.has(notificationType) && leadId) {
      return growthWorkspaceLeadHref(leadId)
    }
  }

  if (opportunityId) return growthWorkspacePipelineHref(opportunityId)
  if (leadId) return growthWorkspaceInboxHref({ leadId })
  return GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox
}

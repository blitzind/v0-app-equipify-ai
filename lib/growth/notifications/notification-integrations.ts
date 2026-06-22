import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import { commandLeadFocusHref, commandOutreachHref } from "@/lib/growth/command/command-action-catalog"
import { growthWorkspaceCallsCoachingHref } from "@/lib/growth/navigation/growth-call-notification-links"
import {
  growthOperatorFollowUpNotificationHref,
  growthOperatorOpportunityNotificationHref,
} from "@/lib/growth/notifications/growth-operator-notification-links"

export async function emitGrowthLeadAssignedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    ownerUserId: string
    companyName: string
    sourceId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "lead_assigned",
    title: "Lead assigned to you",
    body: `${input.companyName} is now in your queue.`,
    sourceSystem: "assignment",
    sourceId: input.sourceId ?? input.leadId,
    actionUrl: commandLeadFocusHref(input.leadId, "command"),
    metadata: { companyName: input.companyName },
  })
}

export async function emitGrowthHighPriorityUnassignedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    sourceId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    leadId: input.leadId,
    notificationType: "high_priority_unassigned",
    title: "High-priority lead unassigned",
    body: `${input.companyName} needs an owner before next action.`,
    sourceSystem: "assignment",
    sourceId: input.sourceId ?? input.leadId,
    actionUrl: `/admin/growth/ownership`,
    metadata: { companyName: input.companyName },
  })
}

export async function emitGrowthCapacityWarningNotification(
  admin: SupabaseClient,
  input: {
    ownerUserId: string
    repEmail: string
    activeLeadCount: number
    maxActiveLeads: number
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    notificationType: "capacity_warning",
    title: "Rep at capacity",
    body: `${input.repEmail} has ${input.activeLeadCount}/${input.maxActiveLeads} active leads.`,
    sourceSystem: "rep_ops",
    sourceId: input.ownerUserId,
    actionUrl: `/admin/growth/ownership`,
    metadata: {
      activeLeadCount: input.activeLeadCount,
      maxActiveLeads: input.maxActiveLeads,
    },
  })
}

export async function emitGrowthApprovalRequiredNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    queueId: string
    companyName: string
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "approval_required",
    title: "Outreach approval required",
    body: `${input.companyName} has outreach waiting for approval.`,
    sourceSystem: "scheduler",
    sourceId: input.queueId,
    actionUrl: commandOutreachHref(input.queueId),
    metadata: { queueId: input.queueId, companyName: input.companyName },
  })
}

export async function emitGrowthSequenceFailedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    stepId: string
    companyName: string
    reason: string
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "sequence_failed",
    title: "Sequence step failed",
    body: `${input.companyName}: ${input.reason}`,
    sourceSystem: "scheduler",
    sourceId: input.stepId,
    actionUrl: `/admin/growth/sequences/execution`,
    metadata: { stepId: input.stepId, reason: input.reason },
  })
}

export async function emitGrowthSuppressionBlockedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "suppression_blocked",
    title: "Outreach suppressed",
    body: `${input.companyName} is suppressed — sequence step skipped.`,
    sourceSystem: "scheduler",
    sourceId: input.leadId,
    actionUrl: commandLeadFocusHref(input.leadId, "outbound"),
    metadata: { companyName: input.companyName },
  })
}

export async function emitGrowthProviderAttentionNotification(
  admin: SupabaseClient,
  input: {
    connectionId: string
    providerLabel: string
    notificationType: "provider_degraded" | "provider_circuit_open" | "provider_disconnected"
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    notificationType: input.notificationType,
    title: `Provider ${input.notificationType.replace(/_/g, " ")}`,
    body: `${input.providerLabel} requires attention before live operations continue.`,
    sourceSystem: "provider",
    sourceId: input.connectionId,
    actionUrl: `/growth/settings/delivery`,
    metadata: { connectionId: input.connectionId, providerLabel: input.providerLabel },
  })
}

export async function emitGrowthLeadReassignedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    ownerUserId: string
    companyName: string
    sourceId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    notificationType: "reassigned",
    title: "Lead reassigned to you",
    body: `${input.companyName} was reassigned to your queue.`,
    sourceSystem: "assignment",
    sourceId: input.sourceId ?? input.leadId,
    actionUrl: commandLeadFocusHref(input.leadId, "command"),
    metadata: { companyName: input.companyName },
  })
}

export async function emitGrowthProviderExecutionFailedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    queueId: string
    companyName: string
    reason: string
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "provider_execution_failed",
    title: "Outreach execution failed",
    body: `${input.companyName}: ${input.reason}`,
    sourceSystem: "outreach",
    sourceId: input.queueId,
    actionUrl: commandOutreachHref(input.queueId),
    metadata: { queueId: input.queueId, reason: input.reason },
  })
}

export async function emitGrowthBuyingSignalDetectedNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    signalKey: string
    ownerUserId?: string | null
    sessionId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "buying_signal_detected",
    title: "Buying signal detected",
    body: `${input.companyName}: ${input.signalKey.replace(/_/g, " ")}.`,
    sourceSystem: "intelligence",
    sourceId: input.sessionId ?? input.signalKey,
    actionUrl: commandLeadFocusHref(input.leadId, "command"),
    metadata: { signalKey: input.signalKey, sessionId: input.sessionId ?? null },
  })
}

export async function emitGrowthEngagementSpikeNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    fromScore: number
    toScore: number
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "engagement_spike",
    title: "Engagement spike",
    body: `${input.companyName} engagement rose ${input.fromScore} → ${input.toScore}.`,
    sourceSystem: "intelligence",
    sourceId: input.leadId,
    actionUrl: commandLeadFocusHref(input.leadId, "command"),
    metadata: { fromScore: input.fromScore, toScore: input.toScore },
  })
}

export async function emitGrowthHighFitLeadNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    fitScore: number
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "high_fit_lead",
    title: "High-fit lead needs attention",
    body: `${input.companyName} (fit ${input.fitScore}) requires ownership or next action.`,
    sourceSystem: "intelligence",
    sourceId: input.leadId,
    actionUrl: commandLeadFocusHref(input.leadId, "command"),
    metadata: { fitScore: input.fitScore },
  })
}

export async function emitGrowthCoachingSignalNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    notificationType: "objection_detected" | "discovery_gap_detected"
    signalKey: string
    ownerUserId?: string | null
    sessionId: string
  },
): Promise<void> {
  const label =
    input.notificationType === "objection_detected" ? "Objection detected" : "Discovery gap detected"
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: input.notificationType,
    title: label,
    body: `${input.companyName}: ${input.signalKey.replace(/_/g, " ")} during live call.`,
    sourceSystem: "coaching",
    sourceId: `${input.sessionId}:${input.signalKey}`,
    actionUrl: growthWorkspaceCallsCoachingHref({
      leadId: input.leadId,
      callSessionId: input.sessionId,
    }),
    metadata: { signalKey: input.signalKey, sessionId: input.sessionId },
  })
}

export async function emitGrowthProviderRetryWarningNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    providerId: string
    attempt: number
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "provider_retry_warning",
    title: "Provider retry warning",
    body: `Live coaching provider retry attempt ${input.attempt} for this call.`,
    sourceSystem: "coaching",
    sourceId: input.sessionId,
    actionUrl: growthWorkspaceCallsCoachingHref({
      leadId: input.leadId,
      callSessionId: input.sessionId,
    }),
    metadata: { providerId: input.providerId, attempt: input.attempt, sessionId: input.sessionId },
  })
}

export async function emitGrowthOpportunityAtRiskNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    score: number
    ownerUserId?: string | null
    opportunityId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    opportunityId: input.opportunityId ?? null,
    notificationType: "opportunity_at_risk",
    title: "Opportunity at risk",
    body: `${input.companyName} readiness is declining (score ${input.score}).`,
    sourceSystem: "opportunity",
    sourceId: input.opportunityId ?? input.leadId,
    actionUrl: growthOperatorOpportunityNotificationHref({
      opportunityId: input.opportunityId,
      leadId: input.leadId,
    }),
    metadata: { score: input.score, opportunityId: input.opportunityId ?? null },
  })
}

export async function emitGrowthStaleOpportunityNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    ownerUserId?: string | null
    opportunityId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    opportunityId: input.opportunityId ?? null,
    notificationType: "stale_opportunity",
    title: "Stale opportunity",
    body: `${input.companyName} has stalled — review next steps.`,
    sourceSystem: "opportunity",
    sourceId: input.opportunityId ?? input.leadId,
    actionUrl: growthOperatorOpportunityNotificationHref({
      opportunityId: input.opportunityId,
      leadId: input.leadId,
    }),
    metadata: { companyName: input.companyName, opportunityId: input.opportunityId ?? null },
  })
}

export async function emitGrowthFollowupNeededNotification(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string
    followUpAt: string
    ownerUserId?: string | null
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    notificationType: "followup_needed",
    title: "Follow-up due",
    body: `${input.companyName} follow-up is overdue.`,
    sourceSystem: "opportunity",
    sourceId: input.leadId,
    actionUrl: growthOperatorFollowUpNotificationHref(input.leadId),
    metadata: { followUpAt: input.followUpAt },
  })
}

export async function emitGrowthWorkloadImbalanceNotification(
  admin: SupabaseClient,
  input: {
    maxRepEmail: string
    minRepEmail: string
    spread: number
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    notificationType: "workload_imbalance",
    title: "Rep workload imbalance",
    body: `Active lead spread ${input.spread}: ${input.maxRepEmail} vs ${input.minRepEmail}.`,
    sourceSystem: "rep_ops",
    sourceId: "workload_imbalance",
    actionUrl: `/admin/growth/ownership`,
    metadata: {
      maxRepEmail: input.maxRepEmail,
      minRepEmail: input.minRepEmail,
      spread: input.spread,
    },
  })
}

export async function emitGrowthOpportunityCloseDatePassedNotification(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    leadId: string
    companyName: string
    ownerUserId?: string | null
    expectedCloseDate: string
  },
): Promise<void> {
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId,
    opportunityId: input.opportunityId,
    notificationType: "close_date_passed",
    title: "Close date passed",
    body: `${input.companyName} expected close date has passed.`,
    sourceSystem: "opportunity",
    sourceId: input.opportunityId,
    actionUrl: growthOperatorOpportunityNotificationHref({
      opportunityId: input.opportunityId,
      leadId: input.leadId,
    }),
    metadata: { expectedCloseDate: input.expectedCloseDate },
  })
}

export async function emitGrowthOpportunityOwnerOverloadedNotification(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    leadId: string
    companyName: string
    ownerUserId: string | null
  },
): Promise<void> {
  if (!input.ownerUserId) return
  await emitGrowthNotification(admin, {
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    opportunityId: input.opportunityId,
    notificationType: "owner_overloaded",
    title: "Owner overloaded",
    body: `${input.companyName} owner is at capacity — review deal load.`,
    sourceSystem: "opportunity",
    sourceId: input.opportunityId,
    actionUrl: growthOperatorOpportunityNotificationHref({
      opportunityId: input.opportunityId,
      leadId: input.leadId,
    }),
    metadata: { companyName: input.companyName },
  })
}

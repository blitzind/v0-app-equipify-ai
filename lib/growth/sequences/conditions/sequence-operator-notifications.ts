import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationSequenceEvent } from "@/lib/growth/notifications/growth-notification-events"
import {
  buildGrowthSequenceOperatorNotificationContent,
  GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "@/lib/growth/notifications/growth-sequence-notification-content"
import {
  createGrowthNotification,
  createGrowthNotificationsForEvent,
} from "@/lib/growth/notifications/growth-notification-service"
import type { GrowthOperatorNotificationRoutingContext } from "@/lib/growth/notifications/growth-notification-routing"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"

export type SequenceOperatorNotificationContext = {
  companyLabel: string
  campaignLabel: string
  organizationId: string | null
  routingContext: GrowthOperatorNotificationRoutingContext
}

async function loadSequenceOperatorLeadContext(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ companyLabel: string; organizationId: string | null; leadOwnerUserId: string | null }> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("company_name, promoted_organization_id, assigned_to")
    .eq("id", leadId)
    .maybeSingle()

  if (error || !data) {
    return { companyLabel: "Lead", organizationId: null, leadOwnerUserId: null }
  }

  return {
    companyLabel: typeof data.company_name === "string" && data.company_name.trim()
      ? data.company_name.trim()
      : "Lead",
    organizationId:
      typeof data.promoted_organization_id === "string" ? data.promoted_organization_id : null,
    leadOwnerUserId: typeof data.assigned_to === "string" ? data.assigned_to : null,
  }
}

async function loadSequenceOperatorEnrollmentContext(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<{ campaignOwnerUserId: string | null; sequencePatternId: string | null }> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("owner_user_id, created_by, sequence_pattern_id")
    .eq("id", enrollmentId)
    .maybeSingle()

  if (error || !data) {
    return { campaignOwnerUserId: null, sequencePatternId: null }
  }

  return {
    campaignOwnerUserId:
      (typeof data.owner_user_id === "string" ? data.owner_user_id : null) ??
      (typeof data.created_by === "string" ? data.created_by : null),
    sequencePatternId:
      typeof data.sequence_pattern_id === "string" ? data.sequence_pattern_id : null,
  }
}

export async function resolveSequenceOperatorNotificationContext(
  admin: SupabaseClient,
  input: { enrollmentId: string; leadId: string },
): Promise<SequenceOperatorNotificationContext> {
  const [lead, enrollment] = await Promise.all([
    loadSequenceOperatorLeadContext(admin, input.leadId),
    loadSequenceOperatorEnrollmentContext(admin, input.enrollmentId),
  ])

  let campaignLabel = "Sequence"
  if (enrollment.sequencePatternId) {
    const patterns = await listGrowthSequencePatterns(admin)
    const pattern = patterns.find((entry) => entry.id === enrollment.sequencePatternId)
    if (pattern?.label?.trim()) campaignLabel = pattern.label.trim()
  }

  return {
    companyLabel: lead.companyLabel,
    campaignLabel,
    organizationId: lead.organizationId,
    routingContext: {
      campaignOwnerUserId: enrollment.campaignOwnerUserId,
      leadOwnerUserId: lead.leadOwnerUserId,
      inboxOwnerUserId: null,
    },
  }
}

export function buildSequenceOperatorNotificationDedupeSourceId(input: {
  enrollmentStepId: string
  waitId?: string | null
  branchDecisionId?: string | null
}): string {
  return [input.enrollmentStepId, input.waitId ?? "", input.branchDecisionId ?? ""]
    .filter((part) => part.length > 0)
    .join(":")
}

export function shouldUseSequenceAdvancementBlockedPlatformAdminFallback(
  routingContext: GrowthOperatorNotificationRoutingContext,
): boolean {
  return !routingContext.campaignOwnerUserId && !routingContext.leadOwnerUserId
}

export async function emitSequenceOperatorNotification(
  admin: SupabaseClient,
  input: {
    event: GrowthOperatorNotificationSequenceEvent
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    waitId?: string | null
    branchDecisionId?: string | null
    waitedForEvent?: string | null
    resolutionReason?: string | null
    blockReason?: string | null
    occurredAt?: string
  },
): Promise<void> {
  const context = await resolveSequenceOperatorNotificationContext(admin, {
    enrollmentId: input.enrollmentId,
    leadId: input.leadId,
  })

  const content = buildGrowthSequenceOperatorNotificationContent({
    event: input.event,
    companyLabel: context.companyLabel,
    campaignLabel: context.campaignLabel,
    waitedForEventLabel: input.waitedForEvent,
    resolutionReason: input.resolutionReason,
    blockReason: input.blockReason,
  })

  const dedupe = {
    sourceSystem: "sequence_branch_wait",
    sourceId: buildSequenceOperatorNotificationDedupeSourceId({
      enrollmentStepId: input.enrollmentStepId,
      waitId: input.waitId,
      branchDecisionId: input.branchDecisionId,
    }),
    leadId: input.leadId,
    enrollmentId: input.enrollmentId,
  }

  const payload = {
    qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
    enrollment_id: input.enrollmentId,
    enrollment_step_id: input.enrollmentStepId,
    lead_id: input.leadId,
    wait_id: input.waitId ?? null,
    branch_decision_id: input.branchDecisionId ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  }

  const hasOwner = Boolean(
    context.routingContext.campaignOwnerUserId || context.routingContext.leadOwnerUserId,
  )

  if (
    input.event === "sequence_advancement_blocked" &&
    shouldUseSequenceAdvancementBlockedPlatformAdminFallback(context.routingContext)
  ) {
    await createGrowthNotification(admin, {
      organizationId: context.organizationId,
      event: input.event,
      title: content.title,
      body: content.body,
      payload,
      targetEntityType: "sequence_enrollment",
      targetEntityId: input.enrollmentId,
      routingContext: context.routingContext,
      recipientRole: "platform_admin",
      recipientUserId: null,
      dedupe,
    })
    return
  }

  if (!hasOwner && input.event !== "sequence_advancement_blocked") {
    return
  }

  await createGrowthNotificationsForEvent(admin, {
    organizationId: context.organizationId,
    event: input.event,
    title: content.title,
    body: content.body,
    payload,
    targetEntityType: "sequence_enrollment",
    targetEntityId: input.enrollmentId,
    routingContext: context.routingContext,
    dedupe,
  })
}

export async function emitSequenceOperatorNotificationSafely(
  admin: SupabaseClient,
  input: Parameters<typeof emitSequenceOperatorNotification>[1],
): Promise<void> {
  await emitSequenceOperatorNotification(admin, input).catch(() => undefined)
}

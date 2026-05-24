import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildGrowthNotificationDeterministicHash,
  resolveGrowthNotificationCooldownMinutes,
  resolveGrowthNotificationExpiryMinutes,
} from "@/lib/growth/notifications/notification-dedupe"
import {
  computeGrowthNotificationPriorityScore,
  resolveGrowthNotificationSeverity,
} from "@/lib/growth/notifications/notification-priority"
import {
  fetchActiveGrowthNotificationByHash,
  insertGrowthNotification,
  refreshGrowthNotification,
  updateGrowthNotificationCollapse,
} from "@/lib/growth/notifications/notification-repository"
import type { EmitGrowthNotificationInput, GrowthNotification } from "@/lib/growth/notifications/notification-types"
import {
  emitGrowthLeadNotificationAcknowledgedTimeline,
  emitGrowthLeadNotificationCompletedTimeline,
  emitGrowthLeadNotificationCreatedTimeline,
  emitGrowthLeadNotificationExpiredTimeline,
} from "@/lib/growth/timeline-emitter"

export async function emitGrowthNotification(
  admin: SupabaseClient,
  input: EmitGrowthNotificationInput,
): Promise<{ created: boolean; notification: GrowthNotification | null; collapsed: boolean }> {
  if (input.dryRun) return { created: false, notification: null, collapsed: false }

  const deterministicHash = buildGrowthNotificationDeterministicHash({
    notificationType: input.notificationType,
    sourceSystem: input.sourceSystem,
    sourceId: input.sourceId,
    ownerUserId: input.ownerUserId,
    leadId: input.leadId,
    orgId: input.orgId,
  })

  const existing = await fetchActiveGrowthNotificationByHash(admin, deterministicHash)
  const cooldownMinutes = resolveGrowthNotificationCooldownMinutes(
    input.notificationType,
    input.cooldownMinutes,
  )

  if (existing) {
    const elapsedMs = Date.now() - Date.parse(existing.createdAt)
    if (elapsedMs < cooldownMinutes * 60 * 1000) {
      const collapseCount = existing.collapseCount + 1
      const body =
        collapseCount > 1
          ? `${input.body} (${collapseCount} similar events collapsed)`
          : input.body
      const updated = await updateGrowthNotificationCollapse(admin, existing.id, {
        collapseCount,
        body,
        priorityScore: computeGrowthNotificationPriorityScore({
          notificationType: input.notificationType,
          collapseCount,
        }),
      })
      logGrowthEngine("notification_collapsed", {
        notificationType: input.notificationType,
        hash: deterministicHash,
        collapseCount,
      })
      return { created: false, notification: updated, collapsed: true }
    }

    const expiryMinutes = resolveGrowthNotificationExpiryMinutes(
      input.notificationType,
      input.expiresInMinutes,
    )
    const expiresAt =
      expiryMinutes != null ? new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString() : null
    const refreshed = await refreshGrowthNotification(admin, existing.id, {
      title: input.title,
      body: input.body,
      priorityScore: computeGrowthNotificationPriorityScore({
        notificationType: input.notificationType,
      }),
      metadata: input.metadata ?? {},
      actionUrl: input.actionUrl ?? null,
      expiresAt,
    })
    return { created: false, notification: refreshed, collapsed: false }
  }

  const severity = resolveGrowthNotificationSeverity(input.notificationType)
  const expiryMinutes = resolveGrowthNotificationExpiryMinutes(
    input.notificationType,
    input.expiresInMinutes,
  )
  const expiresAt =
    expiryMinutes != null ? new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString() : null

  const notification = await insertGrowthNotification(admin, {
    org_id: input.orgId ?? null,
    owner_user_id: input.ownerUserId ?? null,
    lead_id: input.leadId ?? null,
    opportunity_id: input.opportunityId ?? null,
    notification_type: input.notificationType,
    severity,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
    acknowledged_at: null,
    completed_at: null,
    expires_at: expiresAt,
    source_system: input.sourceSystem,
    source_id: input.sourceId ?? null,
    deterministic_hash: deterministicHash,
    priority_score: computeGrowthNotificationPriorityScore({
      notificationType: input.notificationType,
      severity,
    }),
    action_url: input.actionUrl ?? null,
    collapse_count: 1,
  })

  if (input.leadId) {
    await emitGrowthLeadNotificationCreatedTimeline(admin, {
      leadId: input.leadId,
      notificationId: notification.id,
      notificationType: input.notificationType,
      title: input.title,
    })
  }

  logGrowthEngine("notification_created", {
    notificationId: notification.id,
    notificationType: input.notificationType,
    severity,
    ownerUserId: input.ownerUserId ?? null,
    leadId: input.leadId ?? null,
  })

  return { created: true, notification, collapsed: false }
}

export async function acknowledgeGrowthNotificationWithTimeline(
  admin: SupabaseClient,
  notification: GrowthNotification,
  actor?: { userId?: string | null; email?: string | null },
): Promise<GrowthNotification | null> {
  const { acknowledgeGrowthNotification } = await import("@/lib/growth/notifications/notification-repository")
  const updated = await acknowledgeGrowthNotification(admin, notification.id)
  if (!updated) return null

  if (updated.leadId) {
    await emitGrowthLeadNotificationAcknowledgedTimeline(admin, {
      leadId: updated.leadId,
      notificationId: updated.id,
      title: updated.title,
      actor,
    })
  }
  return updated
}

export async function completeGrowthNotificationWithTimeline(
  admin: SupabaseClient,
  notification: GrowthNotification,
  actor?: { userId?: string | null; email?: string | null },
): Promise<GrowthNotification | null> {
  const { completeGrowthNotification } = await import("@/lib/growth/notifications/notification-repository")
  const updated = await completeGrowthNotification(admin, notification.id)
  if (!updated) return null

  if (updated.leadId) {
    await emitGrowthLeadNotificationCompletedTimeline(admin, {
      leadId: updated.leadId,
      notificationId: updated.id,
      title: updated.title,
      actor,
    })
  }
  return updated
}

export async function expireGrowthNotificationWithTimeline(
  admin: SupabaseClient,
  notification: GrowthNotification,
): Promise<void> {
  const { completeGrowthNotification } = await import("@/lib/growth/notifications/notification-repository")
  const updated = await completeGrowthNotification(admin, notification.id)
  if (updated?.leadId) {
    await emitGrowthLeadNotificationExpiredTimeline(admin, {
      leadId: updated.leadId,
      notificationId: updated.id,
      title: updated.title,
    })
  }
}

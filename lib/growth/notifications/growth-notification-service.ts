import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationEvent } from "@/lib/growth/notifications/growth-notification-events"
import {
  buildGrowthOperatorNotificationDedupeKey,
  isGrowthOperatorNotificationDedupeReplacing,
  resolveGrowthOperatorNotificationDedupeRule,
  resolveGrowthOperatorNotificationDedupeWindowMinutes,
} from "@/lib/growth/notifications/growth-notification-dedupe-rules"
import type {
  GrowthOperatorNotificationCreateInput,
  GrowthOperatorNotificationRecord,
} from "@/lib/growth/notifications/growth-notification-persistence-types"
import {
  createNotification,
  dismissNotificationsByIds,
  listActiveNotificationsForDedupeScope,
} from "@/lib/growth/notifications/growth-notification-repository"
import {
  resolveGrowthOperatorNotificationRecipients,
  type GrowthOperatorNotificationRoutingContext,
} from "@/lib/growth/notifications/growth-notification-routing"
import { resolveGrowthOperatorNotificationSeverity } from "@/lib/growth/notifications/growth-notification-severity"
import { dispatchGrowthOperatorNotificationPushSafely } from "@/lib/growth/notifications/growth-notification-push-dispatch"
import { isNotificationAllowedByUserPreferences } from "@/lib/growth/notifications/growth-notification-preferences-repository"

export type CreateGrowthOperatorNotificationInput = {
  organizationId?: string | null
  event: GrowthOperatorNotificationEvent
  title: string
  body: string
  payload?: Record<string, unknown>
  targetEntityType?: string | null
  targetEntityId?: string | null
  expiresAt?: string | null
  routingContext: GrowthOperatorNotificationRoutingContext
  dedupe: {
    sourceSystem: string
    sourceId?: string | null
    leadId?: string | null
    enrollmentId?: string | null
    threadId?: string | null
  }
  dryRun?: boolean
}

export type CreateGrowthOperatorNotificationsForEventResult = {
  created: GrowthOperatorNotificationRecord[]
  skipped: Array<{ recipientRole: string; reason: string }>
  replaced: number
  dryRun: boolean
}

type DedupeDecision =
  | { action: "create" }
  | { action: "skip"; reason: string }
  | { action: "replace"; replaceIds: string[] }

async function resolveDedupeDecision(
  admin: SupabaseClient,
  input: {
    event: GrowthOperatorNotificationEvent
    dedupeKey: string
    recipientRole: GrowthOperatorNotificationCreateInput["recipientRole"]
    recipientUserId: string | null
  },
): Promise<DedupeDecision> {
  const rule = resolveGrowthOperatorNotificationDedupeRule(input.event)
  const active = await listActiveNotificationsForDedupeScope(admin, {
    dedupeKey: input.dedupeKey,
    recipientRole: input.recipientRole,
    recipientUserId: input.recipientUserId,
  })

  if (isGrowthOperatorNotificationDedupeReplacing(rule)) {
    if (active.length === 0) return { action: "create" }
    return { action: "replace", replaceIds: active.map((row) => row.id) }
  }

  const windowMinutes = resolveGrowthOperatorNotificationDedupeWindowMinutes(rule)
  if (windowMinutes == null) return { action: "create" }

  const cutoffMs = Date.now() - windowMinutes * 60 * 1000
  const recent = active.find((row) => Date.parse(row.createdAt) >= cutoffMs)
  if (recent) {
    return { action: "skip", reason: `${rule}_dedupe_window` }
  }

  return { action: "create" }
}

async function persistRecipientNotification(
  admin: SupabaseClient,
  input: CreateGrowthOperatorNotificationInput & {
    recipientRole: GrowthOperatorNotificationCreateInput["recipientRole"]
    recipientUserId: string | null
    dedupeKey: string
    severity: ReturnType<typeof resolveGrowthOperatorNotificationSeverity>
  },
): Promise<{
  record: GrowthOperatorNotificationRecord | null
  skipped?: { recipientRole: string; reason: string }
  replaced: number
}> {
  const decision = await resolveDedupeDecision(admin, {
    event: input.event,
    dedupeKey: input.dedupeKey,
    recipientRole: input.recipientRole,
    recipientUserId: input.recipientUserId,
  })

  if (decision.action === "skip") {
    return {
      record: null,
      skipped: { recipientRole: input.recipientRole, reason: decision.reason },
      replaced: 0,
    }
  }

  if (input.recipientUserId) {
    const allowed = await isNotificationAllowedByUserPreferences(admin, {
      userId: input.recipientUserId,
      eventType: input.event,
      severity: input.severity,
      channel: "in_app",
    })
    if (!allowed) {
      return {
        record: null,
        skipped: { recipientRole: input.recipientRole, reason: "preferences_in_app_blocked" },
        replaced: 0,
      }
    }
  }

  let replaced = 0
  if (decision.action === "replace") {
    replaced = await dismissNotificationsByIds(admin, decision.replaceIds)
  }

  const record = await createNotification(admin, {
    organizationId: input.organizationId,
    eventType: input.event,
    severity: input.severity,
    recipientRole: input.recipientRole,
    recipientUserId: input.recipientUserId,
    dedupeKey: input.dedupeKey,
    title: input.title,
    body: input.body,
    payload: input.payload,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    expiresAt: input.expiresAt,
  })

  if (record) {
    void dispatchGrowthOperatorNotificationPushSafely(admin, record)
  }

  return { record, replaced }
}

export async function createGrowthNotification(
  admin: SupabaseClient,
  input: CreateGrowthOperatorNotificationInput & {
    recipientRole: GrowthOperatorNotificationCreateInput["recipientRole"]
    recipientUserId?: string | null
  },
): Promise<{
  created: boolean
  notification: GrowthOperatorNotificationRecord | null
  skippedReason?: string
  replaced: number
}> {
  if (input.dryRun) {
    return { created: false, notification: null, replaced: 0 }
  }

  const severity = resolveGrowthOperatorNotificationSeverity(input.event)
  const dedupeKey = buildGrowthOperatorNotificationDedupeKey({
    event: input.event,
    sourceSystem: input.dedupe.sourceSystem,
    sourceId: input.dedupe.sourceId,
    leadId: input.dedupe.leadId,
    enrollmentId: input.dedupe.enrollmentId,
    threadId: input.dedupe.threadId,
  })

  const result = await persistRecipientNotification(admin, {
    ...input,
    recipientUserId: input.recipientUserId ?? null,
    dedupeKey,
    severity,
  })

  return {
    created: Boolean(result.record),
    notification: result.record,
    skippedReason: result.skipped?.reason,
    replaced: result.replaced,
  }
}

export async function createGrowthNotificationsForEvent(
  admin: SupabaseClient,
  input: CreateGrowthOperatorNotificationInput,
): Promise<CreateGrowthOperatorNotificationsForEventResult> {
  const severity = resolveGrowthOperatorNotificationSeverity(input.event)
  const dedupeKey = buildGrowthOperatorNotificationDedupeKey({
    event: input.event,
    sourceSystem: input.dedupe.sourceSystem,
    sourceId: input.dedupe.sourceId,
    leadId: input.dedupe.leadId,
    enrollmentId: input.dedupe.enrollmentId,
    threadId: input.dedupe.threadId,
  })

  const recipients = resolveGrowthOperatorNotificationRecipients(input.event, input.routingContext)

  if (input.dryRun) {
    return {
      created: [],
      skipped: recipients.map((recipient) => ({
        recipientRole: recipient.role,
        reason: "dry_run",
      })),
      replaced: 0,
      dryRun: true,
    }
  }

  const created: GrowthOperatorNotificationRecord[] = []
  const skipped: Array<{ recipientRole: string; reason: string }> = []
  let replaced = 0

  for (const recipient of recipients) {
    const result = await persistRecipientNotification(admin, {
      ...input,
      recipientRole: recipient.role,
      recipientUserId: recipient.userId,
      dedupeKey,
      severity,
    })

    if (result.record) created.push(result.record)
    if (result.skipped) skipped.push(result.skipped)
    replaced += result.replaced
  }

  return { created, skipped, replaced, dryRun: false }
}

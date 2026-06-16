import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOperatorNotificationInboxEvent } from "@/lib/growth/notifications/growth-notification-events"
import { fetchInboxAssignmentSettings } from "@/lib/growth/inbox-team-ownership/inbox-assignment-rules-repository"
import { emitInboxThreadSlaOperatorNotificationSafely } from "@/lib/growth/inbox-team-ownership/inbox-operator-notifications"
import { recordInboxThreadSlaAudit } from "@/lib/growth/inbox-team-ownership/inbox-sla-audit"
import { resolveInboxThreadSlaStatus } from "@/lib/growth/inbox-team-ownership/inbox-sla-tracker"

const OPEN_THREAD_STATUSES = ["open", "waiting", "needs_review"] as const

const SLA_AUDIT_DEDUPE_MINUTES: Record<GrowthOperatorNotificationInboxEvent, number> = {
  thread_sla_at_risk: 60,
  thread_sla_overdue: 15,
}

type InboxThreadSlaRow = {
  id: string
  lead_id: string | null
  owner_user_id: string | null
  sla_due_at: string
}

async function hasRecentInboxThreadSlaAudit(
  admin: SupabaseClient,
  input: { threadId: string; event: GrowthOperatorNotificationInboxEvent; windowMinutes: number },
): Promise<boolean> {
  const cutoff = new Date(Date.now() - input.windowMinutes * 60 * 1000).toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .select("id")
    .eq("thread_id", input.threadId)
    .eq("event_type", input.event)
    .gte("created_at", cutoff)
    .limit(1)

  if (error) return false
  return Boolean(data?.length)
}

async function processInboxThreadSlaAlert(
  admin: SupabaseClient,
  input: {
    thread: InboxThreadSlaRow
    event: GrowthOperatorNotificationInboxEvent
    nowIso: string
  },
): Promise<boolean> {
  const windowMinutes = SLA_AUDIT_DEDUPE_MINUTES[input.event]
  const recentlyAudited = await hasRecentInboxThreadSlaAudit(admin, {
    threadId: input.thread.id,
    event: input.event,
    windowMinutes,
  })
  if (recentlyAudited) return false

  await recordInboxThreadSlaAudit(admin, {
    threadId: input.thread.id,
    leadId: input.thread.lead_id,
    event: input.event,
    slaDueAt: input.thread.sla_due_at,
    occurredAt: input.nowIso,
  })

  await emitInboxThreadSlaOperatorNotificationSafely(admin, {
    event: input.event,
    threadId: input.thread.id,
    leadId: input.thread.lead_id,
    inboxOwnerUserId: input.thread.owner_user_id,
    slaDueAt: input.thread.sla_due_at,
    occurredAt: input.nowIso,
  })

  return true
}

export async function evaluateInboxThreadSlaOperatorAlerts(
  admin: SupabaseClient,
  input?: { now?: number; limit?: number },
): Promise<{
  scanned: number
  atRiskProcessed: number
  overdueProcessed: number
  slaAlertsEnabled: boolean
}> {
  const settings = await fetchInboxAssignmentSettings(admin)
  if (!settings.slaAlertsEnabled) {
    return {
      scanned: 0,
      atRiskProcessed: 0,
      overdueProcessed: 0,
      slaAlertsEnabled: false,
    }
  }

  const now = input?.now ?? Date.now()
  const nowIso = new Date(now).toISOString()
  const limit = input?.limit ?? 100

  const { data, error } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id, lead_id, owner_user_id, sla_due_at")
    .not("sla_due_at", "is", null)
    .in("thread_status", [...OPEN_THREAD_STATUSES])
    .order("sla_due_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  let atRiskProcessed = 0
  let overdueProcessed = 0

  for (const row of data ?? []) {
    const thread: InboxThreadSlaRow = {
      id: String(row.id),
      lead_id: row.lead_id ? String(row.lead_id) : null,
      owner_user_id: row.owner_user_id ? String(row.owner_user_id) : null,
      sla_due_at: String(row.sla_due_at),
    }

    const slaStatus = resolveInboxThreadSlaStatus(thread.sla_due_at, now)
    if (slaStatus === "ok") continue

    const event: GrowthOperatorNotificationInboxEvent =
      slaStatus === "at_risk" ? "thread_sla_at_risk" : "thread_sla_overdue"

    const processed = await processInboxThreadSlaAlert(admin, {
      thread,
      event,
      nowIso,
    })

    if (!processed) continue
    if (event === "thread_sla_at_risk") atRiskProcessed += 1
    else overdueProcessed += 1
  }

  return {
    scanned: (data ?? []).length,
    atRiskProcessed,
    overdueProcessed,
    slaAlertsEnabled: true,
  }
}

export async function evaluateInboxThreadSlaOperatorAlertsSafely(
  admin: SupabaseClient,
  input?: { now?: number; limit?: number },
): Promise<void> {
  await evaluateInboxThreadSlaOperatorAlerts(admin, input).catch(() => undefined)
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAttentionDashboard,
  GrowthAttentionFeedInput,
  GrowthAttentionFeedResult,
  GrowthNotification,
  GrowthNotificationSeverity,
  GrowthNotificationType,
} from "@/lib/growth/notifications/notification-types"
import { GROWTH_NOTIFICATIONS_QA_MARKER } from "@/lib/growth/notifications/notification-types"
import { fetchDailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import { boostNotificationPriorityWithDailyWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"

type NotificationRow = {
  id: string
  org_id: string | null
  owner_user_id: string | null
  lead_id: string | null
  opportunity_id: string | null
  notification_type: string
  severity: string
  title: string
  body: string
  metadata: Record<string, unknown> | null
  created_at: string
  acknowledged_at: string | null
  completed_at: string | null
  expires_at: string | null
  source_system: string
  source_id: string | null
  deterministic_hash: string
  priority_score: number
  action_url: string | null
  collapse_count: number
}

const SELECT =
  "id, org_id, owner_user_id, lead_id, opportunity_id, notification_type, severity, title, body, metadata, created_at, acknowledged_at, completed_at, expires_at, source_system, source_id, deterministic_hash, priority_score, action_url, collapse_count"

function notificationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("notifications")
}

function mapRow(row: NotificationRow): GrowthNotification {
  return {
    id: row.id,
    orgId: row.org_id,
    ownerUserId: row.owner_user_id,
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    notificationType: row.notification_type as GrowthNotificationType,
    severity: row.severity as GrowthNotificationSeverity,
    title: row.title,
    body: row.body,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    sourceSystem: row.source_system as GrowthNotification["sourceSystem"],
    sourceId: row.source_id,
    deterministicHash: row.deterministic_hash,
    priorityScore: row.priority_score,
    actionUrl: row.action_url,
    collapseCount: row.collapse_count,
  }
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function fetchActiveGrowthNotificationByHash(
  admin: SupabaseClient,
  deterministicHash: string,
): Promise<GrowthNotification | null> {
  const now = new Date().toISOString()
  const { data, error } = await notificationsTable(admin)
    .select(SELECT)
    .eq("deterministic_hash", deterministicHash)
    .is("completed_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as NotificationRow) : null
}

export async function insertGrowthNotification(
  admin: SupabaseClient,
  row: Omit<NotificationRow, "id" | "created_at">,
): Promise<GrowthNotification> {
  const { data, error } = await notificationsTable(admin)
    .insert({ ...row, qa_marker: GROWTH_NOTIFICATIONS_QA_MARKER })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as NotificationRow)
}

export async function refreshGrowthNotification(
  admin: SupabaseClient,
  notificationId: string,
  input: {
    title: string
    body: string
    priorityScore: number
    metadata?: Record<string, unknown>
    actionUrl?: string | null
    expiresAt?: string | null
  },
): Promise<GrowthNotification | null> {
  const { data, error } = await notificationsTable(admin)
    .update({
      title: input.title,
      body: input.body,
      priority_score: input.priorityScore,
      metadata: input.metadata ?? {},
      action_url: input.actionUrl ?? null,
      expires_at: input.expiresAt ?? null,
      collapse_count: 1,
      created_at: new Date().toISOString(),
      acknowledged_at: null,
    })
    .eq("id", notificationId)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as NotificationRow) : null
}

export async function updateGrowthNotificationCollapse(
  admin: SupabaseClient,
  notificationId: string,
  input: { collapseCount: number; body: string; priorityScore: number },
): Promise<GrowthNotification | null> {
  const { data, error } = await notificationsTable(admin)
    .update({
      collapse_count: input.collapseCount,
      body: input.body,
      priority_score: input.priorityScore,
    })
    .eq("id", notificationId)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as NotificationRow) : null
}

export async function acknowledgeGrowthNotification(
  admin: SupabaseClient,
  notificationId: string,
): Promise<GrowthNotification | null> {
  const { data, error } = await notificationsTable(admin)
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("completed_at", null)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as NotificationRow) : null
}

export async function completeGrowthNotification(
  admin: SupabaseClient,
  notificationId: string,
): Promise<GrowthNotification | null> {
  const now = new Date().toISOString()
  const { data, error } = await notificationsTable(admin)
    .update({ completed_at: now, acknowledged_at: now })
    .eq("id", notificationId)
    .is("completed_at", null)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as NotificationRow) : null
}

export async function bulkAcknowledgeGrowthNotifications(
  admin: SupabaseClient,
  notificationIds: string[],
): Promise<number> {
  if (notificationIds.length === 0) return 0
  const { data, error } = await notificationsTable(admin)
    .update({ acknowledged_at: new Date().toISOString() })
    .in("id", notificationIds)
    .is("completed_at", null)
    .select("id")

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function expireStaleGrowthNotifications(admin: SupabaseClient): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await notificationsTable(admin)
    .update({ completed_at: now })
    .lt("expires_at", now)
    .is("completed_at", null)
    .select("id")

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function listGrowthAttentionFeed(
  admin: SupabaseClient,
  input: GrowthAttentionFeedInput,
): Promise<GrowthAttentionFeedResult> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const now = new Date().toISOString()

  let query = notificationsTable(admin).select(SELECT, { count: "exact" })

  if (input.status === "open") {
    query = query.is("completed_at", null).is("acknowledged_at", null)
  } else if (input.status === "acknowledged") {
    query = query.is("completed_at", null).not("acknowledged_at", "is", null)
  } else if (input.status === "completed") {
    query = query.not("completed_at", "is", null)
  } else {
    query = query.is("completed_at", null)
  }

  query = query.or(`expires_at.is.null,expires_at.gt.${now}`)

  if (input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.severity) query = query.eq("severity", input.severity)
  if (input.notificationType) query = query.eq("notification_type", input.notificationType)
  if (input.sourceSystem) query = query.eq("source_system", input.sourceSystem)

  if (input.view === "critical") query = query.eq("severity", "critical")
  if (input.view === "provider_issues") {
    query = query.in("notification_type", [
      "provider_degraded",
      "provider_circuit_open",
      "provider_disconnected",
      "provider_retry_warning",
      "provider_execution_failed",
    ])
  }
  if (input.view === "approval_queue") query = query.eq("notification_type", "approval_required")
  if (input.view === "unassigned") query = query.eq("notification_type", "high_priority_unassigned")
  if (input.view === "today") query = query.gte("created_at", startOfTodayIso())
  if (input.view === "overdue") query = query.lt("expires_at", now).not("expires_at", "is", null)
  if (input.view === "my_work" && input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.view === "needs_action") query = query.is("acknowledged_at", null)

  const { data, error, count } = await query
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const total = count ?? 0
  let items = ((data ?? []) as NotificationRow[]).map(mapRow)

  if (isDailyRevenueWorkQueueEnabled()) {
    const dailyQueue = (await fetchDailyRevenueWorkQueue(admin, { limit: 100 })).queue
    if (dailyQueue) {
      items = [...items].sort((left, right) => {
        const leftScore = boostNotificationPriorityWithDailyWorkQueue({
          leadId: left.leadId,
          basePriorityScore: left.priorityScore,
          queue: dailyQueue,
        })
        const rightScore = boostNotificationPriorityWithDailyWorkQueue({
          leadId: right.leadId,
          basePriorityScore: right.priorityScore,
          queue: dailyQueue,
        })
        if (rightScore !== leftScore) return rightScore - leftScore
        return right.createdAt.localeCompare(left.createdAt)
      })
    }
  }

  return {
    items,
    total,
    hasMore: offset + limit < total,
  }
}

export async function fetchGrowthAttentionDashboard(
  admin: SupabaseClient,
  ownerUserId?: string | null,
): Promise<GrowthAttentionDashboard> {
  await expireStaleGrowthNotifications(admin)

  const now = new Date().toISOString()

  async function countOpen(extra?: (q: ReturnType<typeof notificationsTable>) => ReturnType<typeof notificationsTable>) {
    let query = notificationsTable(admin)
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
    if (extra) query = extra(query)
    const { count, error } = await query
    if (error) throw new Error(error.message)
    return count ?? 0
  }

  const [
    criticalCount,
    needsApprovalCount,
    highFitWaitingCount,
    providerIssueCount,
    sequenceFailureCount,
    followUpsDueCount,
    staleOpportunityCount,
    workloadImbalanceCount,
    unassignedCount,
    overdueCount,
    myWorkCount,
  ] = await Promise.all([
    countOpen((q) => q.eq("severity", "critical")),
    countOpen((q) => q.eq("notification_type", "approval_required")),
    countOpen((q) => q.eq("notification_type", "high_fit_lead")),
    countOpen((q) =>
      q.in("notification_type", [
        "provider_degraded",
        "provider_circuit_open",
        "provider_disconnected",
        "provider_retry_warning",
      ]),
    ),
    countOpen((q) => q.eq("notification_type", "sequence_failed")),
    countOpen((q) => q.eq("notification_type", "followup_needed")),
    countOpen((q) => q.eq("notification_type", "stale_opportunity")),
    countOpen((q) => q.eq("notification_type", "workload_imbalance")),
    countOpen((q) => q.eq("notification_type", "high_priority_unassigned")),
    countOpen((q) => q.not("expires_at", "is", null).lt("expires_at", now)),
    ownerUserId
      ? countOpen((q) => q.eq("owner_user_id", ownerUserId).is("acknowledged_at", null))
      : Promise.resolve(0),
  ])

  return {
    qaMarker: GROWTH_NOTIFICATIONS_QA_MARKER,
    criticalCount,
    needsApprovalCount,
    highFitWaitingCount,
    providerIssueCount,
    sequenceFailureCount,
    followUpsDueCount,
    staleOpportunityCount,
    workloadImbalanceCount,
    myWorkCount,
    unassignedCount,
    overdueCount,
  }
}

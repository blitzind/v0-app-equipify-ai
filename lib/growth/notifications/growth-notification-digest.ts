import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapNotificationRowForDigest,
} from "@/lib/growth/notifications/growth-notification-analytics"
import {
  GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
  type GrowthOperatorNotificationDigestPreview,
} from "@/lib/growth/notifications/growth-notification-analytics-types"

type DigestRow = {
  id: string
  event_type: string
  severity: string
  title: string
  body: string
  target_entity_type: string | null
  target_entity_id: string | null
  created_at: string
  acknowledged_at: string | null
  dismissed_at: string | null
  expires_at: string | null
}

function operatorNotificationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operator_notifications")
}

function isCurrentlyUnread(row: DigestRow, nowIso: string): boolean {
  if (row.dismissed_at) return false
  if (row.expires_at && row.expires_at <= nowIso) return false
  return !row.acknowledged_at
}

async function listUnreadDigestRows(
  admin: SupabaseClient,
  input: {
    recipientUserId: string
    includePlatformAdminPool?: boolean
    sinceIso?: string
    severities?: string[]
    limit?: number
  },
): Promise<DigestRow[]> {
  const nowIso = new Date().toISOString()
  let query = operatorNotificationsTable(admin)
    .select(
      "id, event_type, severity, title, body, target_entity_type, target_entity_id, created_at, acknowledged_at, dismissed_at, expires_at",
    )
    .is("dismissed_at", null)
    .is("acknowledged_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 25)

  if (input.sinceIso) query = query.gte("created_at", input.sinceIso)

  if (input.includePlatformAdminPool) {
    query = query.or(
      `recipient_user_id.eq.${input.recipientUserId},and(recipient_role.eq.platform_admin,recipient_user_id.is.null)`,
    )
  } else {
    query = query.eq("recipient_user_id", input.recipientUserId)
  }

  if (input.severities?.length) {
    query = query.in("severity", input.severities)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as DigestRow[]).filter((row) => isCurrentlyUnread(row, nowIso))
}

export async function buildDailyDigestPreview(
  admin: SupabaseClient,
  input: {
    recipientUserId: string
    includePlatformAdminPool?: boolean
    limit?: number
  },
): Promise<GrowthOperatorNotificationDigestPreview> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 1)

  const rows = await listUnreadDigestRows(admin, {
    ...input,
    sinceIso: since.toISOString(),
    limit: input.limit ?? 25,
  })

  const items = rows.map(mapNotificationRowForDigest)

  return {
    qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
    kind: "daily",
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    summary: `${items.length} unread operator notification(s) in the last 24 hours.`,
    items,
  }
}

export async function buildCriticalDigestPreview(
  admin: SupabaseClient,
  input: {
    recipientUserId: string
    includePlatformAdminPool?: boolean
    limit?: number
  },
): Promise<GrowthOperatorNotificationDigestPreview> {
  const rows = await listUnreadDigestRows(admin, {
    ...input,
    severities: ["critical", "high"],
    limit: input.limit ?? 25,
  })

  const items = rows.map(mapNotificationRowForDigest)

  return {
    qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
    kind: "critical",
    generatedAt: new Date().toISOString(),
    itemCount: items.length,
    summary: `${items.length} unread critical/high operator notification(s).`,
    items,
  }
}

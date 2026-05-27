import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthInboxOwnerAction,
  GrowthInboxThreadOwnerHistoryEntry,
} from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"
import { maskInboxOwnerLabel } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

type Row = Record<string, unknown>

function historyTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_thread_owner_history")
}

async function resolveUserLabels(
  admin: SupabaseClient,
  userIds: string[],
  actorEmails: Map<string, string>,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueIds.length === 0) return labels

  const { data } = await admin
    .schema("growth")
    .from("rep_roster")
    .select("user_id, display_name, email")
    .in("user_id", uniqueIds)

  for (const row of data ?? []) {
    const record = row as Row
    const userId = String(record.user_id)
    labels.set(userId, maskInboxOwnerLabel(userId, String(record.display_name ?? ""), String(record.email ?? "")))
  }

  for (const userId of uniqueIds) {
    if (labels.has(userId)) continue
    labels.set(userId, maskInboxOwnerLabel(userId, null, actorEmails.get(userId)))
  }

  return labels
}

function mapHistoryEntry(row: Row, labels: Map<string, string>): GrowthInboxThreadOwnerHistoryEntry {
  const actorUserId = String(row.actor_user_id)
  const actorEmail = row.actor_email ? String(row.actor_email) : null
  return {
    id: String(row.id),
    inboxThreadId: String(row.inbox_thread_id),
    action: String(row.action) as GrowthInboxOwnerAction,
    fromUserLabel: row.from_user_id ? labels.get(String(row.from_user_id)) ?? maskInboxOwnerLabel(String(row.from_user_id)) : null,
    toUserLabel: row.to_user_id ? labels.get(String(row.to_user_id)) ?? maskInboxOwnerLabel(String(row.to_user_id)) : null,
    handoffNote: row.handoff_note ? String(row.handoff_note) : null,
    assignmentSource: row.assignment_source ? String(row.assignment_source) : null,
    actorLabel: labels.get(actorUserId) ?? maskInboxOwnerLabel(actorUserId, null, actorEmail),
    createdAt: String(row.created_at),
  }
}

export async function insertInboxThreadOwnerHistory(
  admin: SupabaseClient,
  input: {
    inboxThreadId: string
    action: GrowthInboxOwnerAction
    fromUserId?: string | null
    toUserId?: string | null
    handoffNote?: string | null
    assignmentSource?: string | null
    actorUserId: string
    actorEmail?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthInboxThreadOwnerHistoryEntry> {
  const { data, error } = await historyTable(admin)
    .insert({
      inbox_thread_id: input.inboxThreadId,
      action: input.action,
      from_user_id: input.fromUserId ?? null,
      to_user_id: input.toUserId ?? null,
      handoff_note: input.handoffNote?.trim().slice(0, 2000) ?? null,
      assignment_source: input.assignmentSource ?? null,
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const row = data as Row
  const actorEmails = new Map<string, string>()
  if (input.actorEmail) actorEmails.set(input.actorUserId, input.actorEmail)
  const labels = await resolveUserLabels(
    admin,
    [input.fromUserId, input.toUserId, input.actorUserId].filter(Boolean).map(String),
    actorEmails,
  )
  return mapHistoryEntry(row, labels)
}

export async function listInboxThreadOwnerHistory(
  admin: SupabaseClient,
  threadId: string,
  limit = 50,
): Promise<GrowthInboxThreadOwnerHistoryEntry[]> {
  const { data, error } = await historyTable(admin)
    .select("*")
    .eq("inbox_thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  const userIds: string[] = []
  const actorEmails = new Map<string, string>()
  for (const row of data ?? []) {
    const record = row as Row
    if (record.from_user_id) userIds.push(String(record.from_user_id))
    if (record.to_user_id) userIds.push(String(record.to_user_id))
    userIds.push(String(record.actor_user_id))
    if (record.actor_email) actorEmails.set(String(record.actor_user_id), String(record.actor_email))
  }

  const labels = await resolveUserLabels(admin, userIds, actorEmails)
  return (data ?? []).map((row) => mapHistoryEntry(row as Row, labels))
}

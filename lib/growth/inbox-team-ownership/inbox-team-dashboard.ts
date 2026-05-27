import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"
import { formatLeadLabel } from "@/lib/growth/sequences/sequence-enrollment"
import {
  isInboxReplyAging,
  resolveInboxThreadSlaStatus,
} from "@/lib/growth/inbox-team-ownership/inbox-sla-tracker"
import {
  fetchInboxAssignmentSettings,
  listInboxAssignmentRules,
} from "@/lib/growth/inbox-team-ownership/inbox-assignment-rules-repository"
import {
  GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER,
  maskInboxOwnerLabel,
  type GrowthInboxTeamDashboard,
  type GrowthInboxThreadQueueItem,
} from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

type Row = Record<string, unknown>

const ACTIVE_STATUSES = ["open", "waiting", "needs_review"]

function threadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_threads")
}

async function loadOwnerLabels(admin: SupabaseClient, threadIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (threadIds.length === 0) return labels

  const { data } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .select("thread_id, metadata, created_at")
    .eq("event_type", "thread_owner_assigned")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })

  for (const row of data ?? []) {
    const record = row as Row
    const threadId = String(record.thread_id)
    if (labels.has(threadId)) continue
    const metadata = record.metadata && typeof record.metadata === "object" ? (record.metadata as Row) : {}
    labels.set(threadId, String(metadata.owner_label ?? "Operator"))
  }
  return labels
}

async function loadLeadLabels(admin: SupabaseClient, leadIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (leadIds.length === 0) return labels
  const { data } = await admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
  for (const row of data ?? []) {
    const record = row as Row
    labels.set(String(record.id), formatLeadLabel(String(record.company_name ?? "")))
  }
  return labels
}

function mapQueueItem(
  row: Row,
  leadLabels: Map<string, string>,
  ownerLabels: Map<string, string>,
): GrowthInboxThreadQueueItem {
  const id = String(row.id)
  const ownerUserId = row.owner_user_id ? String(row.owner_user_id) : null
  const slaDueAt = row.sla_due_at ? String(row.sla_due_at) : null
  const lastMessageAt = row.last_message_at ? String(row.last_message_at) : null

  return {
    id,
    leadLabel: leadLabels.get(String(row.lead_id)) ?? "Lead",
    subject: String(row.subject ?? ""),
    threadStatus: String(row.thread_status ?? "open"),
    priorityTier: String(row.priority_tier ?? "normal"),
    classification: String(row.classification ?? "unknown"),
    ownerLabel: ownerUserId ? ownerLabels.get(id) ?? maskInboxOwnerLabel(ownerUserId) : null,
    lastMessageAt,
    slaDueAt,
    slaStatus: resolveInboxThreadSlaStatus(slaDueAt),
    isAging: isInboxReplyAging(lastMessageAt),
    requiresHumanReview: Boolean(row.requires_human_review),
  }
}

export async function fetchInboxTeamDashboard(
  admin: SupabaseClient,
  input: { userId: string },
): Promise<GrowthInboxTeamDashboard> {
  const [settings, rules, threadsRes, reps] = await Promise.all([
    fetchInboxAssignmentSettings(admin),
    listInboxAssignmentRules(admin),
    threadsTable(admin)
      .select("*")
      .in("thread_status", ACTIVE_STATUSES)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(300),
    listGrowthRepRoster(admin),
  ])

  if (threadsRes.error) throw new Error(threadsRes.error.message)
  const rows = (threadsRes.data ?? []) as Row[]
  const threadIds = rows.map((row) => String(row.id))
  const leadIds = [...new Set(rows.map((row) => String(row.lead_id)))]
  const [ownerLabels, leadLabels] = await Promise.all([
    loadOwnerLabels(admin, threadIds),
    loadLeadLabels(admin, leadIds),
  ])

  const items = rows.map((row) => mapQueueItem(row, leadLabels, ownerLabels))

  const myThreads = items.filter((item) => {
    const row = rows.find((entry) => String(entry.id) === item.id)
    return row?.owner_user_id === input.userId
  })
  const unassigned = items.filter((item) => {
    const row = rows.find((entry) => String(entry.id) === item.id)
    return !row?.owner_user_id
  })
  const slaRisk = items.filter((item) => item.slaStatus === "at_risk" || item.slaStatus === "overdue")
  const agingReplies = items.filter((item) => item.isAging)

  return {
    qa_marker: GROWTH_INBOX_TEAM_OWNERSHIP_QA_MARKER,
    myThreads,
    unassigned,
    slaRisk,
    agingReplies,
    counts: {
      myThreads: myThreads.length,
      unassigned: unassigned.length,
      slaRisk: slaRisk.length,
      agingReplies: agingReplies.length,
    },
    settings,
    rules,
    reps: reps
      .filter((rep) => rep.status === "active")
      .map((rep) => ({
        userId: rep.userId,
        label: maskInboxOwnerLabel(rep.userId, rep.displayName, rep.email),
      })),
  }
}

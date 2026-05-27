import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildThreadOwnerAssignedEvent } from "@/lib/growth/inbox/reply-event-builder"
import { persistReplyEventDrafts } from "@/lib/growth/inbox/reply-events"
import { getInboxThread } from "@/lib/growth/inbox/thread-repository"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { insertInboxThreadOwnerHistory } from "@/lib/growth/inbox-team-ownership/inbox-owner-history-repository"
import { recordInboxOwnershipPlatformTimeline } from "@/lib/growth/inbox-team-ownership/inbox-ownership-events"
import { maskInboxOwnerLabel } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

type Row = Record<string, unknown>

function threadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_threads")
}

async function resolveTargetOwnerLabel(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin
    .schema("growth")
    .from("rep_roster")
    .select("user_id, display_name, email")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return maskInboxOwnerLabel(userId)
  const row = data as Row
  return maskInboxOwnerLabel(userId, String(row.display_name ?? ""), String(row.email ?? ""))
}

async function applyOwnershipChange(
  admin: SupabaseClient,
  input: {
    threadId: string
    toUserId: string | null
    fromUserId: string | null
    action: "assigned" | "claimed" | "handoff" | "unassigned"
    assignmentSource: string
    handoffNote?: string | null
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, input.threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  const now = new Date().toISOString()
  const resolvedLabel = input.toUserId ? await resolveTargetOwnerLabel(admin, input.toUserId) : null

  const { error } = await threadsTable(admin)
    .update({
      owner_user_id: input.toUserId,
      assigned_at: input.toUserId ? now : null,
      assigned_by: input.toUserId ? input.actorUserId : null,
      assignment_source: input.toUserId ? input.assignmentSource : null,
      handoff_note: input.handoffNote?.trim().slice(0, 2000) ?? null,
      updated_at: now,
    })
    .eq("id", input.threadId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertInboxThreadOwnerHistory(admin, {
    inboxThreadId: input.threadId,
    action: input.action,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    handoffNote: input.handoffNote,
    assignmentSource: input.assignmentSource,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  if (input.toUserId) {
    const draft = buildThreadOwnerAssignedEvent(existing.lead_label, resolvedLabel ?? "Operator")
    await persistReplyEventDrafts(admin, input.threadId, existing.lead_id, [draft], {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  const timelineType =
    input.action === "claimed"
      ? "thread_claimed"
      : input.action === "handoff"
        ? "thread_handoff"
        : input.action === "unassigned"
          ? "thread_unassigned"
          : "thread_owner_assigned"

  await recordInboxOwnershipPlatformTimeline(admin, {
    eventType: timelineType,
    title:
      input.action === "claimed"
        ? "Thread claimed"
        : input.action === "handoff"
          ? "Thread handoff"
          : input.action === "unassigned"
            ? "Thread unassigned"
            : "Thread owner assigned",
    summary: existing.lead_label,
    threadId: input.threadId,
    leadId: existing.lead_id,
    payload: {
      action: input.action,
      assignment_source: input.assignmentSource,
      handoff_note: input.handoffNote ?? null,
    },
  })

  const updated = await getInboxThread(admin, input.threadId, false)
  if (!updated) throw new Error("inbox_thread_not_found")
  return updated
}

export async function assignInboxThreadToUser(
  admin: SupabaseClient,
  threadId: string,
  input: {
    ownerUserId: string
    assignmentSource?: string
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  return applyOwnershipChange(admin, {
    threadId,
    fromUserId: existing.owner_user_id,
    toUserId: input.ownerUserId,
    action: "assigned",
    assignmentSource: input.assignmentSource ?? "manual",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
}

export async function claimInboxThread(
  admin: SupabaseClient,
  threadId: string,
  input: { actorUserId: string; actorEmail?: string | null },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")
  if (existing.owner_user_id && existing.owner_user_id !== input.actorUserId) {
    throw new Error("thread_already_owned")
  }

  return applyOwnershipChange(admin, {
    threadId,
    fromUserId: existing.owner_user_id,
    toUserId: input.actorUserId,
    action: "claimed",
    assignmentSource: "claim",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
}

export async function handoffInboxThread(
  admin: SupabaseClient,
  threadId: string,
  input: {
    toUserId: string
    handoffNote?: string | null
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")
  if (!input.toUserId) throw new Error("handoff_target_required")

  return applyOwnershipChange(admin, {
    threadId,
    fromUserId: existing.owner_user_id,
    toUserId: input.toUserId,
    action: "handoff",
    assignmentSource: "handoff",
    handoffNote: input.handoffNote,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
}

export async function unassignInboxThread(
  admin: SupabaseClient,
  threadId: string,
  input: { actorUserId: string; actorEmail?: string | null },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  return applyOwnershipChange(admin, {
    threadId,
    fromUserId: existing.owner_user_id,
    toUserId: null,
    action: "unassigned",
    assignmentSource: "manual",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
}

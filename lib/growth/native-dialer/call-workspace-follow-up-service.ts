import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertGrowthCadenceTaskRow } from "@/lib/growth/cadence/cadence-task-repository"
import { emitCadenceTaskCreatedTimeline } from "@/lib/growth/cadence/cadence-timeline-emitter"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { createGrowthMeeting } from "@/lib/growth/meeting-intelligence/mutate-meeting"
import {
  scheduleNativeDialerCallbackQueueItem,
} from "@/lib/growth/native-dialer/native-dialer-repository"
import { sendSms } from "@/lib/growth/sms/send-sms"

export type CallWorkspaceFollowUpAction =
  | {
      kind: "schedule_callback"
      leadId: string
      phoneNumber: string
      callbackAt: string
      ownerUserId?: string | null
      contactName?: string | null
      companyName?: string | null
    }
  | {
      kind: "create_task"
      leadId: string
      title: string
      dueAt?: string | null
      ownerUserId?: string | null
      instructions?: string | null
    }
  | {
      kind: "book_meeting"
      leadId: string
      title: string
      startAt: string
      endAt?: string | null
      ownerUserId?: string | null
    }
  | {
      kind: "send_sms"
      leadId: string
      toE164: string
      body: string
      actingUserId: string
      requestOrigin: string
    }
  | {
      kind: "send_email_task"
      leadId: string
      subject: string
      body: string
      dueAt?: string | null
      ownerUserId?: string | null
    }

export async function executeCallWorkspaceFollowUpAction(
  admin: SupabaseClient,
  action: CallWorkspaceFollowUpAction,
): Promise<{ ok: true; kind: CallWorkspaceFollowUpAction["kind"]; detail?: Record<string, unknown> }> {
  switch (action.kind) {
    case "schedule_callback": {
      const item = await scheduleNativeDialerCallbackQueueItem(admin, {
        leadId: action.leadId,
        phoneNumber: action.phoneNumber,
        callbackDueAt: action.callbackAt,
        ownerUserId: action.ownerUserId,
        contactName: action.contactName,
        companyName: action.companyName,
      })
      return { ok: true, kind: action.kind, detail: { queueItemId: item.id } }
    }
    case "create_task": {
      const lead = await fetchGrowthLeadById(admin, action.leadId)
      if (!lead) throw new Error("Lead not found.")
      const task = await insertGrowthCadenceTaskRow(admin, {
        owner_user_id: action.ownerUserId ?? null,
        lead_id: action.leadId,
        channel: "manual_task",
        title: action.title,
        instructions: action.instructions ?? "Created from call workspace follow-up.",
        due_at: action.dueAt ?? new Date().toISOString(),
        status: "open",
        priority: "medium",
      })
      await emitCadenceTaskCreatedTimeline(admin, { task }).catch(() => undefined)
      return { ok: true, kind: action.kind, detail: { taskId: task.id } }
    }
    case "book_meeting": {
      const endAt =
        action.endAt ??
        new Date(Date.parse(action.startAt) + 30 * 60 * 1000).toISOString()
      const result = await createGrowthMeeting(admin, {
        leadId: action.leadId,
        title: action.title,
        startAt: action.startAt,
        endAt,
        source: "manual",
        ownerUserId: action.ownerUserId ?? null,
        actor: action.ownerUserId ? { userId: action.ownerUserId, email: null } : undefined,
      })
      if (!result.ok) throw new Error(result.message)
      return { ok: true, kind: action.kind, detail: { meetingId: result.meeting.id } }
    }
    case "send_sms": {
      const result = await sendSms(admin, {
        leadId: action.leadId,
        toE164: action.toE164,
        body: action.body,
        actingUserId: action.actingUserId,
        requestOrigin: action.requestOrigin,
      })
      if (!result.ok) throw new Error(result.message)
      return {
        ok: true,
        kind: action.kind,
        detail: { messageId: result.messageId, conversationId: result.conversationId },
      }
    }
    case "send_email_task": {
      const lead = await fetchGrowthLeadById(admin, action.leadId)
      if (!lead) throw new Error("Lead not found.")
      const task = await insertGrowthCadenceTaskRow(admin, {
        owner_user_id: action.ownerUserId ?? null,
        lead_id: action.leadId,
        channel: "manual_follow_up",
        title: action.subject,
        instructions: "Send follow-up email from call workspace.",
        template_draft: action.body,
        due_at: action.dueAt ?? new Date().toISOString(),
        status: "open",
        priority: "medium",
      })
      await emitCadenceTaskCreatedTimeline(admin, { task }).catch(() => undefined)
      return { ok: true, kind: action.kind, detail: { taskId: task.id } }
    }
    default:
      throw new Error("Unsupported follow-up action.")
  }
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { nativeCallWorkspaceHref } from "@/lib/growth/native-dialer/native-dialer-navigation"
import {
  channelIsBlockedPlaceholder,
  channelRequiresApproval,
  mapEnrollmentChannelToMultichannel,
  selectChannelRoutingRule,
} from "@/lib/growth/multichannel/channel-routing"
import { insertChannelTaskEvent, listChannelRoutingRules, recordChannelPlatformTimeline } from "@/lib/growth/multichannel/channel-events"
import type {
  GrowthMultichannelPlanResult,
  GrowthSequenceChannelType,
} from "@/lib/growth/multichannel/multichannel-types"
import {
  isFuturePlaceholderChannel,
  maskMultichannelLeadLabel,
  sanitizeChannelEvidenceSnippet,
} from "@/lib/growth/multichannel/multichannel-types"
import { listDueSequenceSchedulerSteps } from "@/lib/growth/sequence-enrollment/sequence-scheduler-repository"
import {
  createSequenceExecutionJob,
  findActiveSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"

type Row = Record<string, unknown>

function tasksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_channel_tasks")
}

async function resolveLeadLabel(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data } = await admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
  return maskMultichannelLeadLabel(leadId, (data as Row | null)?.company_name as string | null)
}

async function findExistingChannelTask(
  admin: SupabaseClient,
  input: { enrollmentId: string; stepId: string },
): Promise<boolean> {
  const { count, error } = await tasksTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("sequence_enrollment_id", input.enrollmentId)
    .eq("sequence_step_id", input.stepId)
    .in("status", ["pending", "approved", "in_progress", "blocked", "completed", "skipped"])
  if (error) return false
  return (count ?? 0) > 0
}

function buildTaskCopy(channel: GrowthSequenceChannelType, stepOrder: number): { title: string; description: string } {
  switch (channel) {
    case "email":
      return {
        title: `Email step ${stepOrder}`,
        description: "Email step — uses safe sequence execution and provider transport after approval.",
      }
    case "manual_call":
      return {
        title: `Manual call task ${stepOrder}`,
        description: "Human call task — open Call Workspace; no auto-dial or robocalling.",
      }
    case "manual_followup":
      return {
        title: `Manual follow-up ${stepOrder}`,
        description: "Human follow-up touch — operator completes manually.",
      }
    case "linkedin_manual":
      return {
        title: `LinkedIn manual touch ${stepOrder}`,
        description: "LinkedIn reminder only — no API, scraping, or autonomous actions.",
      }
    case "sms_future":
      return {
        title: `SMS future placeholder ${stepOrder}`,
        description: "SMS channel blocked until SMS compliance and provider phase.",
      }
    case "booking_followup":
      return {
        title: `Booking follow-up ${stepOrder}`,
        description: "Follow up on approved booking recommendation — no calendar write.",
      }
    case "voicemail_future":
      return {
        title: `Voicemail future placeholder ${stepOrder}`,
        description: "Voicemail drop blocked until future provider phase.",
      }
    default:
      return { title: `Channel task ${stepOrder}`, description: "Multi-channel sequence task." }
  }
}

async function findApprovedBookingRecommendationId(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("booking_recommendations")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? String((data as Row).id) : null
}

export async function planMultichannelSequenceTasks(
  admin: SupabaseClient,
  input?: { limit?: number; actingUserId?: string | null },
): Promise<GrowthMultichannelPlanResult> {
  const limit = input?.limit ?? 25
  const dueSteps = await listDueSequenceSchedulerSteps(admin, limit)
  const routingRules = await listChannelRoutingRules(admin)
  const result: GrowthMultichannelPlanResult = {
    scanned: dueSteps.length,
    created: 0,
    skippedExisting: 0,
    skippedEmailDelegated: 0,
    blockedFuture: 0,
    bookingFollowups: 0,
    failed: 0,
  }

  for (const step of dueSteps) {
    const channel = mapEnrollmentChannelToMultichannel(step.channel)
    if (!channel) {
      result.failed += 1
      continue
    }

    try {
      if (await findExistingChannelTask(admin, { enrollmentId: step.enrollmentId, stepId: step.id })) {
        result.skippedExisting += 1
        continue
      }

      const blocked = channelIsBlockedPlaceholder(routingRules, channel)
      const copy = buildTaskCopy(channel, step.stepOrder)
      const bookingRecommendationId =
        channel === "booking_followup" ? await findApprovedBookingRecommendationId(admin, step.leadId) : null
      if (channel === "booking_followup" && bookingRecommendationId) result.bookingFollowups += 1

      let sequenceExecutionJobId: string | null = null
      if (channel === "email") {
        const existingJob = await findActiveSequenceExecutionJob(admin, {
          sequenceEnrollmentId: step.enrollmentId,
          sequenceStepId: step.id,
        })
        if (!existingJob) {
          const job = await createSequenceExecutionJob(admin, {
            sequenceEnrollmentId: step.enrollmentId,
            sequenceStepId: step.id,
            leadId: step.leadId,
            scheduledFor: step.scheduledFor ?? new Date().toISOString(),
            status: "pending_approval",
          })
          sequenceExecutionJobId = job.id
        } else {
          sequenceExecutionJobId = existingJob.id
        }
        result.skippedEmailDelegated += 1
      }

      const callWorkspaceHref = channel === "manual_call" ? nativeCallWorkspaceHref({ leadId: step.leadId }) : null
      const status = blocked ? "blocked" : "pending"
      if (blocked) result.blockedFuture += 1

      const { data, error } = await tasksTable(admin)
        .insert({
          lead_id: step.leadId,
          sequence_enrollment_id: step.enrollmentId,
          sequence_step_id: step.id,
          channel,
          status,
          title: copy.title,
          description: copy.description,
          evidence_snippet: sanitizeChannelEvidenceSnippet(
            `Step ${step.stepOrder} · ${channel.replace(/_/g, " ")} · enrollment ${step.enrollmentId.slice(0, 8)}…`,
          ),
          requires_human_approval: channelRequiresApproval(routingRules, channel),
          booking_recommendation_id: bookingRecommendationId,
          sequence_execution_job_id: sequenceExecutionJobId,
          call_workspace_href: callWorkspaceHref,
          scheduled_for: step.scheduledFor,
          metadata: {
            source: "multichannel_planner",
            step_order: step.stepOrder,
            routing_rule: selectChannelRoutingRule(routingRules, channel)?.label ?? null,
            no_autonomous_external_action: true,
          },
        })
        .select("*")
        .single()
      if (error) {
        result.failed += 1
        continue
      }

      const taskId = String((data as Row).id)
      await insertChannelTaskEvent(admin, {
        taskId,
        leadId: step.leadId,
        eventType: blocked ? "channel_task_blocked" : "channel_task_planned",
        title: blocked ? "Channel task blocked" : "Channel task planned",
        description: copy.description,
        metadata: { channel, acting_user_id: input?.actingUserId ?? null },
      }).catch(() => undefined)
      await recordChannelPlatformTimeline(admin, {
        eventType: blocked ? "channel_task_blocked" : "channel_task_planned",
        title: copy.title,
        summary: copy.description,
        leadId: step.leadId,
      }).catch(() => undefined)

      result.created += 1
    } catch {
      result.failed += 1
    }
  }

  return result
}

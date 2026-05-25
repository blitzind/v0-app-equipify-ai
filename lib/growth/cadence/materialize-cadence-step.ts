import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import {
  buildCadenceLinkedInDraft,
  buildCadenceSuggestedSmsText,
  buildCadenceTaskInstructions,
  buildCadenceTaskTitle,
  isCadenceTaskChannel,
} from "@/lib/growth/cadence/cadence-channel-engine"
import { emitCadenceTaskDueNotification } from "@/lib/growth/cadence/cadence-notifications"
import {
  emitCadenceTaskCreatedTimeline,
  emitCadenceTaskDueTimeline,
} from "@/lib/growth/cadence/cadence-timeline-emitter"
import {
  fetchGrowthCadenceTaskByEnrollmentStepId,
  insertGrowthCadenceTaskRow,
} from "@/lib/growth/cadence/cadence-task-repository"
import type { GrowthCadenceTask } from "@/lib/growth/cadence/cadence-types"
import { deriveOutreachQueuePriority } from "@/lib/growth/outreach/outreach-analytics"
import { computeStepExecutionConfidence } from "@/lib/growth/sequence-enrollment/sequence-enrollment-health"
import { updateGrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import { emitGrowthLeadSequenceStepCreatedTimeline, emitGrowthLeadSequenceStepQueuedTimeline } from "@/lib/growth/timeline-emitter"

function mapQueuePriorityToCadence(priority: string): GrowthCadenceTask["priority"] {
  if (priority === "critical") return "critical"
  if (priority === "high") return "high"
  if (priority === "low") return "low"
  return "medium"
}

export async function createCadenceTaskFromEnrollmentStep(
  admin: SupabaseClient,
  input: {
    step: GrowthSequenceEnrollmentStep
    enrollmentId: string
    actingUserId: string
    idempotencyKey?: string | null
    dryRun?: boolean
  },
): Promise<{ task: GrowthCadenceTask | null; reason?: string }> {
  if (!isCadenceTaskChannel(input.step.channel)) {
    return { task: null, reason: "email_channel" }
  }

  const existing = await fetchGrowthCadenceTaskByEnrollmentStepId(admin, input.step.id)
  if (existing || input.step.cadenceTaskId) {
    return { task: existing, reason: "already_created" }
  }

  const lead = await fetchGrowthLeadById(admin, input.step.leadId)
  if (!lead) return { task: null, reason: "lead_not_found" }

  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: input.step.channel === "manual_call" ? "manual_call" : "manual_follow_up",
    toEmail: lead.contactEmail,
    generationType: null,
    generationApproved: true,
  })
  if (!preflight.allowed) return { task: null, reason: preflight.code ?? "preflight_blocked" }

  const opportunity = await fetchGrowthOpportunityByLeadId(admin, lead.id)
  const channel = input.step.channel
  const instructions = buildCadenceTaskInstructions({
    channel,
    companyName: lead.companyName,
    contactName: lead.contactName,
  })
  const title = buildCadenceTaskTitle({
    channel,
    companyName: lead.companyName,
    stepOrder: input.step.stepOrder,
  })
  const dueAt = input.step.scheduledFor ?? input.step.dueAt ?? new Date().toISOString()
  const priority = mapQueuePriorityToCadence(
    deriveOutreachQueuePriority({
      callPriorityTier: lead.callPriorityTier,
      executivePriorityTier: lead.executivePriorityTier,
    }),
  )

  let templateDraft: string | null = null
  let suggestedSmsText: string | null = null
  if (channel === "linkedin_message" || channel === "linkedin_connect") {
    templateDraft = buildCadenceLinkedInDraft({ companyName: lead.companyName, contactName: lead.contactName })
  }
  if (channel === "sms_task") {
    suggestedSmsText = buildCadenceSuggestedSmsText({ companyName: lead.companyName, contactName: lead.contactName })
  }

  if (input.dryRun) {
    return {
      task: {
        id: "dry-run",
        ownerUserId: lead.assignedTo,
        leadId: lead.id,
        opportunityId: opportunity?.id ?? null,
        meetingId: input.step.meetingId,
        sequenceEnrollmentStepId: input.step.id,
        channel,
        title,
        instructions,
        templateDraft,
        suggestedSmsText,
        dueAt,
        status: "open",
        priority,
        outcome: null,
        skippedReason: null,
        completedAt: null,
        completedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  }

  const task = await insertGrowthCadenceTaskRow(admin, {
    owner_user_id: lead.assignedTo ?? input.actingUserId,
    lead_id: lead.id,
    opportunity_id: opportunity?.id ?? input.step.opportunityId ?? null,
    meeting_id: input.step.meetingId ?? null,
    sequence_enrollment_step_id: input.step.id,
    channel,
    title,
    instructions,
    template_draft: templateDraft,
    suggested_sms_text: suggestedSmsText,
    due_at: dueAt,
    status: "open",
    priority,
    idempotency_key: input.idempotencyKey ?? null,
  })

  await updateGrowthSequenceEnrollmentStep(admin, input.step.id, {
    status: "queued",
    cadenceTaskId: task.id,
    instructions,
    dueAt,
    opportunityId: opportunity?.id ?? null,
    stepExecutionConfidence: computeStepExecutionConfidence({ lead, channel: input.step.channel }),
  })

  await emitGrowthLeadSequenceStepCreatedTimeline(admin, {
    leadId: lead.id,
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
    stepOrder: input.step.stepOrder,
    channel: input.step.channel,
  })

  await emitGrowthLeadSequenceStepQueuedTimeline(admin, {
    leadId: lead.id,
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
    queueId: task.id,
  })

  await emitCadenceTaskCreatedTimeline(admin, {
    task,
    enrollmentId: input.enrollmentId,
    stepOrder: input.step.stepOrder,
  })

  if (dueAt && Date.parse(dueAt) <= Date.now()) {
    await emitCadenceTaskDueTimeline(admin, { task })
    await emitCadenceTaskDueNotification(admin, { task, companyName: lead.companyName })
  }

  return { task }
}

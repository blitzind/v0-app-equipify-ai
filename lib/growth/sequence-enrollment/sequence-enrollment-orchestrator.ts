import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  computeOutreachExecutionConfidence,
  deriveOutreachQueuePriority,
} from "@/lib/growth/outreach/outreach-analytics"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import {
  insertGrowthOutreachQueueEvent,
  insertGrowthOutreachQueueItem,
} from "@/lib/growth/outreach/outreach-queue-repository"
import { fetchGrowthOutreachSettings } from "@/lib/growth/outreach/outreach-settings-repository"
import { resolveScheduledFor } from "@/lib/growth/outreach/outreach-scheduling"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  computeEnrollmentHealthScore,
  computeStepExecutionConfidence,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-health"
import {
  fetchGrowthSequenceEnrollmentById,
  fetchGrowthSequenceEnrollmentStepById,
  insertGrowthSequenceEnrollment,
  insertGrowthSequenceEnrollmentStep,
  listGrowthSequenceEnrollmentSteps,
  setLeadActiveSequenceEnrollment,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentWithSteps,
} from "@/lib/growth/sequence-enrollment-types"
import {
  emitGrowthLeadSequenceEnrollmentCancelledTimeline,
  emitGrowthLeadSequenceEnrollmentCompletedTimeline,
  emitGrowthLeadSequenceEnrollmentCreatedTimeline,
  emitGrowthLeadSequenceStepCreatedTimeline,
  emitGrowthLeadSequenceStepExecutedTimeline,
  emitGrowthLeadSequenceStepQueuedTimeline,
} from "@/lib/growth/timeline-emitter"

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
}

async function syncEnrollmentHealth(
  admin: SupabaseClient,
  enrollmentId: string,
  totalSteps: number,
): Promise<GrowthSequenceEnrollment> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, enrollmentId)
  if (!enrollment) throw new Error("not_found")
  const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollmentId)
  const { healthScore, stalled } = computeEnrollmentHealthScore({ enrollment, steps, totalSteps })
  return updateGrowthSequenceEnrollment(admin, enrollmentId, {
    enrollmentHealthScore: healthScore,
    enrollmentStalled: stalled,
  })
}

export async function createGrowthSequenceEnrollmentDraft(
  admin: SupabaseClient,
  input: {
    leadId: string
    patternId?: string | null
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthSequenceEnrollmentWithSteps> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")

  const preflight = await runSequenceEnrollmentPreflight(admin, lead, { patternId: input.patternId })
  if (!preflight.allowed) throw new Error(preflight.code ?? "preflight_blocked")

  const patternId = input.patternId ?? lead.recommendedSequencePatternId
  if (!patternId) throw new Error("pattern_required")

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === patternId)
  if (!pattern) throw new Error("pattern_not_found")

  const enrollment = await insertGrowthSequenceEnrollment(admin, {
    leadId: input.leadId,
    sequencePatternId: pattern.id,
    sequenceVersion: pattern.sequenceVersion,
    status: "draft",
    ownerUserId: input.actingUserId,
    createdBy: input.actingUserId,
  })

  const baseTime = new Date().toISOString()
  let cursor = baseTime
  const steps = []
  for (const patternStep of [...pattern.steps].sort((a, b) => a.stepOrder - b.stepOrder)) {
    if (patternStep.stepOrder > 1) {
      cursor = addDays(cursor, patternStep.delayDaysMin)
    }
    const step = await insertGrowthSequenceEnrollmentStep(admin, {
      enrollmentId: enrollment.id,
      leadId: input.leadId,
      sequencePatternStepId: patternStep.id,
      stepOrder: patternStep.stepOrder,
      channel: patternStep.channel,
      generationType: patternStep.generationType,
      scheduledFor: cursor,
      stepExecutionConfidence: computeStepExecutionConfidence({ lead, channel: patternStep.channel }),
    })
    steps.push(step)
  }

  await emitGrowthLeadSequenceEnrollmentCreatedTimeline(admin, {
    leadId: input.leadId,
    enrollmentId: enrollment.id,
    patternKey: pattern.key,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  logGrowthEngine("sequence_enrollment_draft_created", { leadId: input.leadId, enrollmentId: enrollment.id })

  return {
    ...enrollment,
    steps,
    patternKey: pattern.key,
    patternLabel: pattern.label,
  }
}

export async function confirmGrowthSequenceEnrollment(
  admin: SupabaseClient,
  input: {
    leadId: string
    enrollmentId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthSequenceEnrollmentWithSteps> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")
  if (enrollment.status !== "draft") throw new Error("invalid_status")

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("not_found")

  const preflight = await runSequenceEnrollmentPreflight(admin, lead, {
    patternId: enrollment.sequencePatternId,
  })
  if (!preflight.allowed) throw new Error(preflight.code ?? "preflight_blocked")

  const now = new Date().toISOString()
  await updateGrowthSequenceEnrollment(admin, enrollment.id, {
    status: "active",
    startedAt: now,
    ownerUserId: input.actingUserId,
    pauseReason: null,
  })
  await setLeadActiveSequenceEnrollment(admin, input.leadId, enrollment.id)

  await materializeGrowthSequenceEnrollmentStep(admin, {
    enrollmentId: enrollment.id,
    stepOrder: 1,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === enrollment.sequencePatternId)
  const updated = await syncEnrollmentHealth(admin, enrollment.id, pattern?.steps.length ?? 0)
  const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)

  return {
    ...updated,
    steps,
    patternKey: pattern?.key ?? null,
    patternLabel: pattern?.label ?? null,
  }
}

export async function materializeGrowthSequenceEnrollmentStep(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    stepOrder: number
    actingUserId: string
    actingUserEmail: string
  },
): Promise<void> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.status !== "active") throw new Error("invalid_status")

  const steps = await listGrowthSequenceEnrollmentSteps(admin, input.enrollmentId)
  const step = steps.find((entry) => entry.stepOrder === input.stepOrder)
  if (!step || step.status !== "pending") return

  const lead = await fetchGrowthLeadById(admin, enrollment.leadId)
  if (!lead) throw new Error("not_found")

  if (lead.sequenceFatigueRisk === "high") throw new Error("fatigue_blocked")

  const outreachSettings = await fetchGrowthOutreachSettings(admin)
  const scheduled = resolveScheduledFor({
    sendNow: !step.scheduledFor || Date.parse(step.scheduledFor) <= Date.now(),
    scheduledFor: step.scheduledFor,
    respectBusinessHours: true,
    timezone: outreachSettings.timezone,
    startMinutes: outreachSettings.businessHoursStartMinutes,
    endMinutes: outreachSettings.businessHoursEndMinutes,
  })

  if (scheduled.scheduledFor && Date.parse(scheduled.scheduledFor) > Date.now()) {
    await updateGrowthSequenceEnrollmentStep(admin, step.id, { scheduledFor: scheduled.scheduledFor })
    return
  }

  if (step.channel === "email") {
    const generationType = (step.generationType ?? "follow_up_email") as GrowthAiCopilotGenerationType
    const result = await runGrowthAiCopilotGeneration({
      admin,
      leadId: lead.id,
      generationType,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
    if (!result.ok) throw new Error(result.code)

    await updateGrowthSequenceEnrollmentStep(admin, step.id, {
      status: "draft_created",
      generationId: result.generation.id,
      stepExecutionConfidence: computeStepExecutionConfidence({ lead, channel: step.channel }),
    })

    await emitGrowthLeadSequenceStepCreatedTimeline(admin, {
      leadId: lead.id,
      enrollmentId: enrollment.id,
      stepId: step.id,
      stepOrder: step.stepOrder,
      channel: step.channel,
    })
    return
  }

  const commSettings = await fetchGrowthPlatformCommunicationSettings(admin)
  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: step.channel,
    toEmail: lead.contactEmail,
    generationType: null,
    generationApproved: true,
  })
  if (!preflight.allowed) throw new Error(preflight.code ?? "preflight_blocked")

  const queueItem = await insertGrowthOutreachQueueItem(admin, {
    leadId: lead.id,
    channel: step.channel,
    status: "pending_approval",
    priority: deriveOutreachQueuePriority({
      callPriorityTier: lead.callPriorityTier,
      executivePriorityTier: lead.executivePriorityTier,
    }),
    executionConfidence: computeOutreachExecutionConfidence({
      leadScore: lead.score,
      engagementScore: lead.engagementScore,
      capacityTier: lead.operationalCapacityTier,
      channel: step.channel,
    }),
    providerConnectionId: commSettings.activeEmailConnectionId,
    payloadSnapshot: {
      generationType: step.generationType,
      sequenceStep: step.stepOrder,
    },
    createdBy: input.actingUserId,
    sequencePatternId: enrollment.sequencePatternId,
    sequenceEnrollmentStepId: step.id,
  })

  await updateGrowthSequenceEnrollmentStep(admin, step.id, {
    status: "queued",
    outreachQueueId: queueItem.id,
    stepExecutionConfidence: computeStepExecutionConfidence({ lead, channel: step.channel }),
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: queueItem.id,
    eventType: "queued",
    actorUserId: input.actingUserId,
    metadata: { sequenceEnrollmentId: enrollment.id, sequenceStepId: step.id },
  })

  await emitGrowthLeadSequenceStepQueuedTimeline(admin, {
    leadId: lead.id,
    enrollmentId: enrollment.id,
    stepId: step.id,
    queueId: queueItem.id,
  })
}

export async function queueGrowthSequenceEnrollmentStep(
  admin: SupabaseClient,
  input: {
    stepId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<void> {
  const step = await fetchGrowthSequenceEnrollmentStepById(admin, input.stepId)
  if (!step) throw new Error("not_found")
  if (step.status !== "draft_created" || !step.generationId) throw new Error("invalid_status")

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, step.enrollmentId)
  if (!enrollment || enrollment.status !== "active") throw new Error("invalid_status")

  const lead = await fetchGrowthLeadById(admin, step.leadId)
  if (!lead) throw new Error("not_found")

  const generation = await fetchGrowthAiCopilotGenerationById(admin, step.generationId)
  if (!generation || generation.status !== "approved") throw new Error("generation_not_approved")

  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: "email",
    toEmail: lead.contactEmail,
    generationType: generation.generationType,
    generationApproved: true,
  })
  if (!preflight.allowed) throw new Error(preflight.code ?? "preflight_blocked")

  const commSettings = await fetchGrowthPlatformCommunicationSettings(admin)
  const queueItem = await insertGrowthOutreachQueueItem(admin, {
    leadId: lead.id,
    generationId: generation.id,
    channel: "email",
    status: "pending_approval",
    priority: deriveOutreachQueuePriority({
      callPriorityTier: lead.callPriorityTier,
      executivePriorityTier: lead.executivePriorityTier,
    }),
    executionConfidence: computeOutreachExecutionConfidence({
      leadScore: lead.score,
      engagementScore: lead.engagementScore,
      capacityTier: lead.operationalCapacityTier,
      channel: "email",
    }),
    providerConnectionId: commSettings.activeEmailConnectionId,
    payloadSnapshot: {
      subject: generation.generatedSubject,
      body: generation.generatedContent,
      generationType: generation.generationType,
      toEmail: lead.contactEmail,
    },
    createdBy: input.actingUserId,
    sequencePatternId: enrollment.sequencePatternId,
    sequenceEnrollmentStepId: step.id,
  })

  await updateGrowthSequenceEnrollmentStep(admin, step.id, {
    status: "queued",
    outreachQueueId: queueItem.id,
  })

  await emitGrowthLeadSequenceStepQueuedTimeline(admin, {
    leadId: lead.id,
    enrollmentId: enrollment.id,
    stepId: step.id,
    queueId: queueItem.id,
  })
}

export async function advanceGrowthSequenceEnrollmentAfterStep(
  admin: SupabaseClient,
  input: {
    enrollmentStepId: string
    actingUserId?: string | null
    actingUserEmail?: string | null
  },
): Promise<void> {
  const step = await fetchGrowthSequenceEnrollmentStepById(admin, input.enrollmentStepId)
  if (!step) return

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, step.enrollmentId)
  if (!enrollment || !["active", "paused"].includes(enrollment.status)) return

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.id === enrollment.sequencePatternId)
  const totalSteps = pattern?.steps.length ?? 0

  const now = new Date().toISOString()
  await updateGrowthSequenceEnrollmentStep(admin, step.id, {
    status: "executed",
    completedAt: now,
  })

  await emitGrowthLeadSequenceStepExecutedTimeline(admin, {
    leadId: step.leadId,
    enrollmentId: enrollment.id,
    stepId: step.id,
    stepOrder: step.stepOrder,
  })

  const nextOrder = step.stepOrder + 1
  await updateGrowthSequenceEnrollment(admin, enrollment.id, { currentStepOrder: step.stepOrder })

  if (nextOrder > totalSteps) {
    await updateGrowthSequenceEnrollment(admin, enrollment.id, {
      status: "completed",
      completedAt: now,
      enrollmentStalled: false,
    })
    await setLeadActiveSequenceEnrollment(admin, step.leadId, null)
    await emitGrowthLeadSequenceEnrollmentCompletedTimeline(admin, {
      leadId: step.leadId,
      enrollmentId: enrollment.id,
    })
    return
  }

  await syncEnrollmentHealth(admin, enrollment.id, totalSteps)

  if (enrollment.status === "active" && input.actingUserId && input.actingUserEmail) {
    await materializeGrowthSequenceEnrollmentStep(admin, {
      enrollmentId: enrollment.id,
      stepOrder: nextOrder,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })
  }
}

export async function pauseGrowthSequenceEnrollment(
  admin: SupabaseClient,
  input: { enrollmentId: string; leadId: string; pauseReason: string },
): Promise<GrowthSequenceEnrollment> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")
  if (enrollment.status !== "active") throw new Error("invalid_status")

  return updateGrowthSequenceEnrollment(admin, enrollment.id, {
    status: "paused",
    pauseReason: input.pauseReason,
  })
}

export async function resumeGrowthSequenceEnrollment(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    leadId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthSequenceEnrollment> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")
  if (enrollment.status !== "paused") throw new Error("invalid_status")

  const updated = await updateGrowthSequenceEnrollment(admin, enrollment.id, {
    status: "active",
    pauseReason: null,
  })

  const nextOrder = enrollment.currentStepOrder + 1
  await materializeGrowthSequenceEnrollmentStep(admin, {
    enrollmentId: enrollment.id,
    stepOrder: nextOrder,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })

  return updated
}

export async function cancelGrowthSequenceEnrollment(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    leadId: string
    reason: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthSequenceEnrollment> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment || enrollment.leadId !== input.leadId) throw new Error("not_found")
  if (enrollment.status === "completed" || enrollment.status === "cancelled") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const updated = await updateGrowthSequenceEnrollment(admin, enrollment.id, {
    status: "cancelled",
    cancelledAt: now,
    cancelledReason: input.reason,
    enrollmentStalled: false,
  })
  await setLeadActiveSequenceEnrollment(admin, input.leadId, null)

  await emitGrowthLeadSequenceEnrollmentCancelledTimeline(admin, {
    leadId: input.leadId,
    enrollmentId: enrollment.id,
    reason: input.reason,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return updated
}

export async function completeGrowthSequenceEnrollmentStepManually(
  admin: SupabaseClient,
  input: {
    stepId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<void> {
  const step = await fetchGrowthSequenceEnrollmentStepById(admin, input.stepId)
  if (!step) throw new Error("not_found")

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: step.id,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })
}

export async function skipGrowthSequenceEnrollmentStep(
  admin: SupabaseClient,
  input: { stepId: string; actingUserId: string; actingUserEmail: string },
): Promise<void> {
  const step = await fetchGrowthSequenceEnrollmentStepById(admin, input.stepId)
  if (!step) throw new Error("not_found")

  await updateGrowthSequenceEnrollmentStep(admin, step.id, {
    status: "skipped",
    completedAt: new Date().toISOString(),
  })

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: step.id,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })
}

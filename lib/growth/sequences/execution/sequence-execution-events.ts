import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthSequenceExecutionTimelineEventType } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { insertSequenceExecutionJobEvent } from "@/lib/growth/sequences/execution/sequence-job-repository"

export async function recordSequenceExecutionTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: GrowthSequenceExecutionTimelineEventType
    title: string
    summary?: string
    jobId: string
    enrollmentId: string
    stepId?: string | null
    deliveryAttemptId?: string | null
    occurredAt?: string
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary,
    payload: {
      job_id: input.jobId,
      sequence_enrollment_id: input.enrollmentId,
      sequence_step_id: input.stepId ?? null,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      source: "growth_sequence_safe_execution",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordSequenceExecutionJobAuditEvent(
  admin: SupabaseClient,
  input: {
    jobId: string
    eventType: string
    title: string
    description?: string
    severity?: "info" | "low" | "medium" | "high" | "critical"
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await insertSequenceExecutionJobEvent(admin, {
    jobId: input.jobId,
    eventType: input.eventType,
    title: input.title,
    description: input.description,
    severity: input.severity,
    metadata: input.metadata,
  })
}

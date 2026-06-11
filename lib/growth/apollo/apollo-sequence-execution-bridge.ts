/** Apollo Sequence Execution bridge — multichannel approval → native sequence objects (no send). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  evaluateApolloSequenceExecutionDuplicateBlock,
  mapApolloSequenceExecutionCandidateDbRow,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import type {
  ApolloSequenceExecutionAutomationActionResult,
  ApolloSequenceExecutionCandidateStatus,
  ApolloSequenceExecutionJobLink,
  ApolloSequenceExecutionMultichannelHandoffInput,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { buildSequenceExecutionPipelineFromMultichannelHandoff } from "@/lib/growth/apollo/apollo-sequence-execution-pipeline-builder"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import {
  insertGrowthSequenceEnrollment,
  insertGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  createSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { recordSequenceExecutionJobAuditEvent } from "@/lib/growth/sequences/execution/sequence-execution-events"
import type { GrowthSequenceTransportChannel } from "@/lib/growth/sequences/execution/sequence-execution-types"

export { buildSequenceExecutionPipelineFromMultichannelHandoff } from "@/lib/growth/apollo/apollo-sequence-execution-pipeline-builder"

const TABLE = "apollo_sequence_execution_candidates"

function emptyResult(
  action: ApolloSequenceExecutionAutomationActionResult["action"],
  error: string,
): ApolloSequenceExecutionAutomationActionResult {
  return {
    ok: false,
    action,
    candidate_id: null,
    candidate_ids: [],
    status: null,
    error,
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  }
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
}

function mapJobChannel(channel: string): GrowthSequenceTransportChannel | null {
  if (channel === "email" || channel === "sms" || channel === "voice_drop") return channel
  return null
}

function resolvePatternStepId(
  patternSteps: Array<{ id: string; channel: string; stepOrder: number }>,
  channel: string,
  stepNumber: number,
): string {
  const exact = patternSteps.find((step) => step.channel === channel && step.stepOrder === stepNumber)
  if (exact) return exact.id
  const byChannel = patternSteps.find((step) => step.channel === channel)
  if (byChannel) return byChannel.id
  return patternSteps[Math.min(stepNumber - 1, patternSteps.length - 1)]?.id ?? patternSteps[0]!.id
}

export async function handoffMultichannelApprovedToSequenceExecution(
  admin: SupabaseClient,
  input: ApolloSequenceExecutionMultichannelHandoffInput,
): Promise<ApolloSequenceExecutionAutomationActionResult> {
  if (!input.growth_lead_id?.trim()) {
    return emptyResult("create_from_multichannel", "growth_lead_id_required")
  }

  const { data: existing } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("multichannel_sequence_candidate_id", input.multichannel_sequence_candidate_id)
    .in("status", ["pending_draft_approval", "execution_ready"])
    .limit(1)
    .maybeSingle()

  if (existing) {
    const duplicate = evaluateApolloSequenceExecutionDuplicateBlock({
      existing_status: existing.status as ApolloSequenceExecutionCandidateStatus,
    })
    if (duplicate.blocked) {
      return {
        ok: true,
        action: "create_from_multichannel",
        candidate_id: typeof existing.id === "string" ? existing.id : null,
        candidate_ids: typeof existing.id === "string" ? [existing.id] : [],
        status: existing.status as ApolloSequenceExecutionCandidateStatus,
        outreach_sent: false,
        voice_drop_sent: false,
        email_sent: false,
        sms_sent: false,
        call_placed: false,
        draft_created: true,
        jobs_scheduled: false,
      }
    }
  }

  const pipeline = buildSequenceExecutionPipelineFromMultichannelHandoff(input)
  if (!pipeline.materialization.steps.length) {
    return emptyResult("create_from_multichannel", "sequence_steps_empty")
  }

  const patterns = await listGrowthSequencePatterns(admin)
  const pattern =
    patterns.find((entry) => entry.key === pipeline.materialization.pattern_key) ??
    patterns.find((entry) => entry.key === "multichannel_with_voice_drop") ??
    null
  if (!pattern) {
    return emptyResult("create_from_multichannel", "sequence_pattern_not_found")
  }

  const patternSteps = [...pattern.steps].sort((a, b) => a.stepOrder - b.stepOrder)
  const baseTime = new Date().toISOString()

  const enrollment = await insertGrowthSequenceEnrollment(admin, {
    leadId: input.growth_lead_id,
    sequencePatternId: pattern.id,
    sequenceVersion: pattern.sequenceVersion,
    status: "draft",
    createdBy: "apollo-sequence-execution-automation",
  })

  const executionJobLinks: ApolloSequenceExecutionJobLink[] = []

  for (const stepPlan of pipeline.materialization.steps) {
    const scheduledFor = addDays(baseTime, Math.max(0, stepPlan.scheduled_offset_days - 1))
    const patternStepId = resolvePatternStepId(patternSteps, stepPlan.channel, stepPlan.step_number)

    const step = await insertGrowthSequenceEnrollmentStep(admin, {
      enrollmentId: enrollment.id,
      leadId: input.growth_lead_id,
      sequencePatternStepId: patternStepId,
      stepOrder: stepPlan.step_number,
      channel: stepPlan.channel,
      generationType: stepPlan.generation_type,
      scheduledFor,
      stepExecutionConfidence: 70,
    })

    const draft = pipeline.materialization.drafts.find((d) => d.step_number === stepPlan.step_number)
    const transportChannel = mapJobChannel(stepPlan.channel)
    let executionJobId: string | null = null
    let jobStatus = "planned"

    if (transportChannel) {
      const job = await createSequenceExecutionJob(admin, {
        sequenceEnrollmentId: enrollment.id,
        sequenceStepId: step.id,
        leadId: input.growth_lead_id,
        scheduledFor,
        status: "pending_approval",
        channel: transportChannel,
        smsDraftBody: transportChannel === "sms" ? draft?.body_placeholder ?? null : null,
        smsToE164: transportChannel === "sms" ? input.phone : null,
      })
      executionJobId = job.id
      jobStatus = job.status

      await recordSequenceExecutionJobAuditEvent(admin, {
        jobId: job.id,
        eventType: "job_planned",
        title: "Apollo sequence execution job planned",
        description: "Multichannel-approved sequence materialized — pending human approval, no send.",
        metadata: {
          qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
          multichannel_sequence_candidate_id: input.multichannel_sequence_candidate_id,
          draft_id: draft?.draft_id ?? null,
        },
      })
    }

    executionJobLinks.push({
      step_number: stepPlan.step_number,
      sequence_step_id: step.id,
      execution_job_id: executionJobId,
      channel: stepPlan.channel,
      job_status: jobStatus,
      scheduled_for: scheduledFor,
    })
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      multichannel_sequence_candidate_id: input.multichannel_sequence_candidate_id,
      voice_drop_candidate_id: input.voice_drop_candidate_id,
      enrollment_candidate_id: input.enrollment_candidate_id,
      company_candidate_id: input.company_candidate_id,
      company_contact_id: input.company_contact_id,
      growth_lead_id: input.growth_lead_id,
      sequence_enrollment_id: enrollment.id,
      status: "pending_draft_approval",
      sequence_materialization: pipeline.materialization,
      sequence_steps: pipeline.materialization.steps,
      draft_records: pipeline.materialization.drafts,
      execution_jobs: executionJobLinks,
      source_attribution: pipeline.source_attribution,
      operator_summary: pipeline.operator_summary,
      outreach_sent: false,
      voice_drop_sent: false,
      email_sent: false,
      sms_sent: false,
      call_placed: false,
      draft_created: true,
      jobs_scheduled: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
        company_name: input.company_name,
        full_name: input.full_name,
        title: input.title,
        email: input.email,
        phone: input.phone,
        qualification_score: input.qualification_score,
        multichannel_handoff_at: now,
      },
    })
    .select("*")
    .single()

  if (error || !data) {
    return emptyResult("create_from_multichannel", error?.message ?? "execution_candidate_insert_failed")
  }

  const candidateId = typeof data.id === "string" ? data.id : null
  logGrowthEngine("apollo_sequence_execution_candidate_created", {
    candidate_id: candidateId,
    multichannel_sequence_candidate_id: input.multichannel_sequence_candidate_id,
    sequence_enrollment_id: enrollment.id,
    step_count: pipeline.materialization.steps.length,
    outreach_sent: false,
    jobs_scheduled: false,
  })

  return {
    ok: true,
    action: "create_from_multichannel",
    candidate_id: candidateId,
    candidate_ids: candidateId ? [candidateId] : [],
    status: "pending_draft_approval",
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  }
}

export async function regenerateApolloSequenceExecutionDrafts(
  admin: SupabaseClient,
  input: { candidate_id: string },
): Promise<ApolloSequenceExecutionAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.candidate_id)
    .maybeSingle()

  if (error) return emptyResult("regenerate_draft", error.message)
  if (!data) return emptyResult("regenerate_draft", "candidate_not_found")

  const row = mapApolloSequenceExecutionCandidateDbRow(data as Record<string, unknown>)
  const metadata = (data.metadata ?? {}) as Record<string, unknown>

  const handoff: ApolloSequenceExecutionMultichannelHandoffInput = {
    multichannel_sequence_candidate_id: row.multichannel_sequence_candidate_id,
    voice_drop_candidate_id: row.voice_drop_candidate_id,
    enrollment_candidate_id: row.enrollment_candidate_id,
    company_candidate_id: row.company_candidate_id,
    company_contact_id: row.company_contact_id,
    growth_lead_id: row.growth_lead_id,
    company_name: row.company_name,
    full_name: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    qualification_score: row.qualification_score,
    sequence_key: row.materialization.sequence_key,
    sequence_label: row.materialization.sequence_label,
    channel_order: row.materialization.steps.map((s) => s.orchestration_channel),
    scheduling_plan: {
      total_days: row.materialization.total_days,
      touches: row.materialization.steps.map((step) => ({
        day_offset: step.scheduled_offset_days,
        channel: step.orchestration_channel,
        spacing_days_from_prior: 0,
        cadence_label: step.channel,
        reason: step.scheduled_for_label,
      })),
    },
    source_attribution: row.source_attribution as unknown as Record<string, unknown>,
  }

  const pipeline = buildSequenceExecutionPipelineFromMultichannelHandoff(handoff)
  const now = new Date().toISOString()

  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "pending_draft_approval",
      sequence_materialization: pipeline.materialization,
      sequence_steps: pipeline.materialization.steps,
      draft_records: pipeline.materialization.drafts,
      operator_summary: pipeline.operator_summary,
      updated_at: now,
      metadata: { ...metadata, draft_regenerated_at: now },
    })
    .eq("id", input.candidate_id)

  if (updateError) return emptyResult("regenerate_draft", updateError.message)

  return {
    ok: true,
    action: "regenerate_draft",
    candidate_id: input.candidate_id,
    candidate_ids: [input.candidate_id],
    status: "pending_draft_approval",
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  }
}

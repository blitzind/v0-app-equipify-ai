import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthSequenceSchedulerStatus } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import { getGrowthOutboundMode } from "@/lib/growth/runtime/outbound-mode"
import { canUseGrowthOutboundSoloApproval } from "@/lib/growth/runtime/outbound-solo-approval"
import {
  GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
  type GrowthSequenceSafeExecutionDashboard,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  enrichSequenceExecutionJobViews,
  listSequenceExecutionJobs,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { evaluateApolloSequenceExecutionJobApprovalGate } from "@/lib/growth/apollo/apollo-sequence-execution-job-gate"
import { resolveApolloSequenceExecutionCandidateStatusForEnrollment } from "@/lib/growth/apollo/apollo-sequence-execution-job-gate-server"
import {
  APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINEL,
} from "@/lib/growth/apollo/apollo-sequence-draft-readiness"

export async function fetchGrowthSequenceSafeExecutionDashboard(
  admin: SupabaseClient,
): Promise<GrowthSequenceSafeExecutionDashboard> {
  const now = Date.now()
  const sentSince = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const [jobs, schedulerStatus] = await Promise.all([
    listSequenceExecutionJobs(admin, { limit: 100 }),
    fetchGrowthSequenceSchedulerStatus(admin).catch(() => null),
  ])
  const views = await enrichSequenceExecutionJobViews(admin, jobs)

  const uniqueEnrollmentIds = [...new Set(jobs.map((job) => job.sequenceEnrollmentId))]
  const apolloStatusByEnrollment = new Map<string, Awaited<
    ReturnType<typeof resolveApolloSequenceExecutionCandidateStatusForEnrollment>
  >>()
  await Promise.all(
    uniqueEnrollmentIds.map(async (enrollmentId) => {
      const candidate = await resolveApolloSequenceExecutionCandidateStatusForEnrollment(
        admin,
        enrollmentId,
      )
      apolloStatusByEnrollment.set(enrollmentId, candidate)
    }),
  )

  const enrichedViews = views.map((view) => {
    const apolloCandidate = apolloStatusByEnrollment.get(view.sequenceEnrollmentId) ?? null
    const gate = evaluateApolloSequenceExecutionJobApprovalGate({
      apollo_candidate_status: apolloCandidate?.status ?? null,
    })
    const smsBody = view.smsDraftBody ?? ""
    const isPlaceholderDraft =
      smsBody.includes(APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINEL) ||
      gate.apollo_candidate_status === "pending_draft_approval" ||
      gate.apollo_candidate_status === "draft_rejected"

    return {
      ...view,
      apolloDraftApprovalBlocked: !gate.allowed,
      apolloDraftApprovalMessage: gate.operator_message,
      draftReadinessLabel: isPlaceholderDraft
        ? "Draft Placeholder"
        : gate.allowed
          ? "Draft Approved"
          : "Not Send Ready",
      isPlaceholderDraft,
    }
  })

  const dueJobs = jobs.filter(
    (job) => job.status === "approved" && new Date(job.scheduledFor).getTime() <= now,
  ).length
  const pendingApproval = jobs.filter((job) =>
    ["draft", "pending_approval"].includes(job.status),
  ).length
  const blocked = jobs.filter((job) => job.status === "blocked").length
  const sent24h = jobs.filter(
    (job) => job.status === "sent" && job.updatedAt >= sentSince,
  ).length
  const voiceDropJobs = jobs.filter((job) => job.channel === "voice_drop")
  const voiceDropMetrics = {
    voiceDropsQueued: voiceDropJobs.filter((job) =>
      ["pending_approval", "approved", "scheduled", "running"].includes(job.status),
    ).length,
    voiceDropsDelivered: voiceDropJobs.filter(
      (job) => job.status === "sent" && Boolean(job.voiceDropDeliveryAttemptId),
    ).length,
    voiceDropsFailed: voiceDropJobs.filter((job) => job.status === "failed").length,
  }

  return {
    qa_marker: GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
    dueJobs,
    pendingApproval,
    blocked,
    sent24h,
    voiceDropMetrics,
    jobs: enrichedViews,
    soloApprovalEnabled: canUseGrowthOutboundSoloApproval({ platformAdmin: true }),
    outboundMode: getGrowthOutboundMode(),
    standalonePlanningAutomated: schedulerStatus?.standalonePlanningAutomated ?? false,
    planningCronRoute: schedulerStatus?.planningCronRoute,
    lastSchedulerRun: schedulerStatus?.lastRun ?? null,
  }
}

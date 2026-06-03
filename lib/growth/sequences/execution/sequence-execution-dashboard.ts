import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
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

export async function fetchGrowthSequenceSafeExecutionDashboard(
  admin: SupabaseClient,
): Promise<GrowthSequenceSafeExecutionDashboard> {
  const now = Date.now()
  const sentSince = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const jobs = await listSequenceExecutionJobs(admin, { limit: 100 })
  const views = await enrichSequenceExecutionJobViews(admin, jobs)

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

  return {
    qa_marker: GROWTH_SEQUENCE_SAFE_EXECUTION_QA_MARKER,
    dueJobs,
    pendingApproval,
    blocked,
    sent24h,
    jobs: views,
    soloApprovalEnabled: canUseGrowthOutboundSoloApproval({ platformAdmin: true }),
    outboundMode: getGrowthOutboundMode(),
  }
}

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  aggregateAnalyticsCounts,
  aggregateApprovalStats,
  aggregateBranchStats,
  aggregateCompletionStats,
  aggregateJobStats,
  aggregateWaitStats,
  automationAnalyticsSafetyPayload,
  buildAnalyticsRuntimeHealth,
  buildAnalyticsTimeline,
  collectApprovalRecords,
  detectTopBottlenecks,
  mapEnrollmentRowsToSnapshots,
} from "@/lib/growth/automation/growth-automation-analytics-utils"
import type {
  GrowthAutomationAnalyticsSnapshot,
  GrowthAutomationApprovalAnalyticsStat,
  GrowthAutomationBranchAnalyticsStat,
  GrowthAutomationJobAnalyticsStat,
  GrowthAutomationWaitAnalyticsStat,
} from "@/lib/growth/automation/growth-automation-analytics-types"
import { getAutomationRuntimeStatus } from "@/lib/growth/automation/growth-automation-runtime-publisher-service"
import type { GrowthAutomationRuntimePendingJobSnapshot } from "@/lib/growth/automation/growth-automation-observability-types"
import type { SequenceBranchDecision } from "@/lib/growth/sequences/conditions/sequence-branch-types"

export type AutomationAnalyticsContext = {
  flowId: string
  organizationId: string
  compiledPatternId: string | null
  runtimeStatus: string
  metadata: Awaited<ReturnType<typeof getAutomationRuntimeStatus>>["metadata"]
  enrollmentRows: Array<Record<string, unknown>>
  enrollments: ReturnType<typeof mapEnrollmentRowsToSnapshots>
  enrollmentIds: string[]
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  waitRows: Array<Record<string, unknown>>
  branchDecisions: SequenceBranchDecision[]
  approvals: ReturnType<typeof collectApprovalRecords>
}

async function listFlowEnrollmentRows(
  admin: SupabaseClient,
  flowId: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("*")
    .contains("metadata", { automation_flow_id: flowId })
    .order("updated_at", { ascending: false })
    .limit(250)

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, unknown>>
}

async function listFlowExecutionJobs(
  admin: SupabaseClient,
  enrollmentIds: string[],
): Promise<GrowthAutomationRuntimePendingJobSnapshot[]> {
  if (enrollmentIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, sequence_enrollment_id, lead_id, channel, status, scheduled_for, updated_at, created_at")
    .in("sequence_enrollment_id", enrollmentIds)
    .order("updated_at", { ascending: false })
    .limit(250)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    jobId: String(row.id),
    enrollmentId: String(row.sequence_enrollment_id),
    leadId: String(row.lead_id),
    channel: String(row.channel ?? "email"),
    status: String(row.status ?? "draft"),
    scheduledFor: String(row.scheduled_for ?? row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  }))
}

async function listAllFlowWaits(
  admin: SupabaseClient,
  enrollmentIds: string[],
): Promise<Array<Record<string, unknown>>> {
  if (enrollmentIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("*")
    .in("enrollment_id", enrollmentIds)
    .order("updated_at", { ascending: false })
    .limit(250)

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, unknown>>
}

async function listFlowBranchDecisions(
  admin: SupabaseClient,
  enrollmentIds: string[],
): Promise<SequenceBranchDecision[]> {
  if (enrollmentIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_branch_decisions")
    .select(
      "id, enrollment_id, enrollment_step_id, pattern_step_id, condition_id, edge_id, decision, dsl_version, source, event, outcome_detail, evaluated_at, created_at",
    )
    .in("enrollment_id", enrollmentIds)
    .order("evaluated_at", { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: String(row.id),
    enrollmentId: String(row.enrollment_id),
    enrollmentStepId: row.enrollment_step_id ? String(row.enrollment_step_id) : null,
    patternStepId: row.pattern_step_id ? String(row.pattern_step_id) : null,
    conditionId: row.condition_id ? String(row.condition_id) : null,
    edgeId: row.edge_id ? String(row.edge_id) : null,
    decision: row.decision as SequenceBranchDecision["decision"],
    dslVersion: Number(row.dsl_version ?? 1),
    source: row.source as SequenceBranchDecision["source"],
    event: row.event as SequenceBranchDecision["event"],
    outcomeDetail: row.outcome_detail ? String(row.outcome_detail) : null,
    evaluatedAt: String(row.evaluated_at ?? row.created_at ?? new Date().toISOString()),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }))
}

export async function loadAutomationAnalyticsContext(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<AutomationAnalyticsContext> {
  const status = await getAutomationRuntimeStatus(admin, input)
  const enrollmentRows = await listFlowEnrollmentRows(admin, input.flowId)
  const enrollments = mapEnrollmentRowsToSnapshots(enrollmentRows)
  const enrollmentIds = enrollments.map((entry) => entry.enrollmentId)
  const [jobs, waitRows, branchDecisions] = await Promise.all([
    listFlowExecutionJobs(admin, enrollmentIds),
    listAllFlowWaits(admin, enrollmentIds),
    listFlowBranchDecisions(admin, enrollmentIds),
  ])

  return {
    flowId: input.flowId,
    organizationId: input.organizationId,
    compiledPatternId:
      status.publishedVersion?.compiledPatternId ?? status.metadata?.compiledPatternId ?? null,
    runtimeStatus: status.effectiveFlowStatus,
    metadata: status.metadata,
    enrollmentRows,
    enrollments,
    enrollmentIds,
    jobs,
    waitRows,
    branchDecisions,
    approvals: collectApprovalRecords(enrollmentRows),
  }
}

function buildAnalyticsSnapshotFromContext(context: AutomationAnalyticsContext): GrowthAutomationAnalyticsSnapshot {
  const counts = aggregateAnalyticsCounts({
    enrollmentRows: context.enrollmentRows,
    enrollments: context.enrollments,
  })

  return {
    analyticsId: randomUUID(),
    flowId: context.flowId,
    compiledPatternId: context.compiledPatternId,
    generatedAt: new Date().toISOString(),
    counts,
    branchStats: aggregateBranchStats(context.branchDecisions),
    waitStats: aggregateWaitStats(context.waitRows),
    approvalStats: aggregateApprovalStats(context.approvals),
    jobStats: aggregateJobStats({ jobs: context.jobs, enrollmentRows: context.enrollmentRows }),
    completionStats: aggregateCompletionStats({
      enrollmentRows: context.enrollmentRows,
      enrollments: context.enrollments,
    }),
    runtimeHealth: buildAnalyticsRuntimeHealth({
      counts,
      jobs: context.jobs,
      waitRows: context.waitRows,
      runtimeStatus: context.runtimeStatus,
      metadata: context.metadata,
    }),
    topBottlenecks: detectTopBottlenecks({
      waitRows: context.waitRows,
      approvals: context.approvals,
      jobs: context.jobs,
      enrollmentRows: context.enrollmentRows,
      runtimeStatus: context.runtimeStatus,
      metadata: context.metadata,
    }),
    timeline: buildAnalyticsTimeline({
      enrollmentRows: context.enrollmentRows,
      jobs: context.jobs,
      waitRows: context.waitRows,
      approvals: context.approvals,
    }),
    safety: automationAnalyticsSafetyPayload(),
  }
}

export async function getAutomationAnalytics(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationAnalyticsSnapshot> {
  const context = await loadAutomationAnalyticsContext(admin, input)
  return buildAnalyticsSnapshotFromContext(context)
}

export async function getAutomationAnalyticsSummary(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<
  Pick<
    GrowthAutomationAnalyticsSnapshot,
    "analyticsId" | "flowId" | "compiledPatternId" | "generatedAt" | "counts" | "completionStats" | "runtimeHealth" | "topBottlenecks" | "safety"
  >
> {
  const snapshot = await getAutomationAnalytics(admin, input)
  return {
    analyticsId: snapshot.analyticsId,
    flowId: snapshot.flowId,
    compiledPatternId: snapshot.compiledPatternId,
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
    completionStats: snapshot.completionStats,
    runtimeHealth: snapshot.runtimeHealth,
    topBottlenecks: snapshot.topBottlenecks,
    safety: snapshot.safety,
  }
}

export async function getAutomationBranchAnalytics(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ branchStats: GrowthAutomationBranchAnalyticsStat[]; safety: ReturnType<typeof automationAnalyticsSafetyPayload> }> {
  const context = await loadAutomationAnalyticsContext(admin, input)
  return {
    branchStats: aggregateBranchStats(context.branchDecisions),
    safety: automationAnalyticsSafetyPayload(),
  }
}

export async function getAutomationWaitAnalytics(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ waitStats: GrowthAutomationWaitAnalyticsStat[]; safety: ReturnType<typeof automationAnalyticsSafetyPayload> }> {
  const context = await loadAutomationAnalyticsContext(admin, input)
  return {
    waitStats: aggregateWaitStats(context.waitRows),
    safety: automationAnalyticsSafetyPayload(),
  }
}

export async function getAutomationApprovalAnalytics(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ approvalStats: GrowthAutomationApprovalAnalyticsStat; safety: ReturnType<typeof automationAnalyticsSafetyPayload> }> {
  const context = await loadAutomationAnalyticsContext(admin, input)
  return {
    approvalStats: aggregateApprovalStats(context.approvals),
    safety: automationAnalyticsSafetyPayload(),
  }
}

export async function getAutomationJobAnalytics(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<{ jobStats: GrowthAutomationJobAnalyticsStat; safety: ReturnType<typeof automationAnalyticsSafetyPayload> }> {
  const context = await loadAutomationAnalyticsContext(admin, input)
  return {
    jobStats: aggregateJobStats({ jobs: context.jobs, enrollmentRows: context.enrollmentRows }),
    safety: automationAnalyticsSafetyPayload(),
  }
}

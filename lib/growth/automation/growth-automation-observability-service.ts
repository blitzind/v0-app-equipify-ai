import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getFlow, getFlowGraph, updateAutomationRuntimeMetadata } from "@/lib/growth/automation/growth-automation-repository"
import {
  GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
  type GrowthAutomationRuntimeManagementResult,
  type GrowthAutomationRuntimeObservabilitySnapshot,
  type GrowthAutomationRuntimePendingJobSnapshot,
} from "@/lib/growth/automation/growth-automation-observability-types"
import {
  aggregateRuntimeCounts,
  buildEnrollmentSnapshot,
  buildFailureSnapshots,
  calculateRuntimeHealth,
  detectStuckWaits,
  formatRecentActivityEntries,
  mergeRuntimeKillSwitch,
  readRuntimeKillSwitch,
} from "@/lib/growth/automation/growth-automation-observability-utils"
import { cancelAutomationRuntimeExecution } from "@/lib/growth/automation/growth-automation-runtime-orchestrator"
import {
  activateAutomationRuntime,
  getAutomationRuntimeStatus,
  pauseAutomationRuntime,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-service"
import {
  extractRuntimeMetadata,
  mergeRuntimeMetadataIntoCanvasLayout,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-utils"

async function loadPublishedGraphForFlow(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
) {
  const flow = await getFlow(admin, input)
  if (!flow.publishedVersionId) throw new Error("automation_published_version_missing")
  const graph = await getFlowGraph(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
    versionId: flow.publishedVersionId,
  })
  return { flow, graph }
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

async function listFlowWaits(
  admin: SupabaseClient,
  enrollmentIds: string[],
): Promise<Array<Record<string, unknown>>> {
  if (enrollmentIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_step_waits")
    .select("*")
    .in("enrollment_id", enrollmentIds)
    .eq("status", "waiting")
    .limit(250)

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function getAutomationRuntimeObservability(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationRuntimeObservabilitySnapshot> {
  const status = await getAutomationRuntimeStatus(admin, input)
  const enrollmentRows = await listFlowEnrollmentRows(admin, input.flowId)
  const enrollments = enrollmentRows.map((row) => buildEnrollmentSnapshot(row))
  const enrollmentIds = enrollments.map((entry) => entry.enrollmentId)
  const jobs = await listFlowExecutionJobs(admin, enrollmentIds)
  const waitRows = await listFlowWaits(admin, enrollmentIds)
  const stuckWaits = detectStuckWaits(waitRows)
  const failures = buildFailureSnapshots(enrollments)
  const counts = aggregateRuntimeCounts({ enrollments, jobs, stuckWaits, failures })
  const killSwitch = readRuntimeKillSwitch(status.metadata)
  const health = calculateRuntimeHealth({
    counts,
    runtimeStatus: status.effectiveFlowStatus,
    activationStatus: status.metadata?.activationStatus ?? null,
    killSwitch,
  })

  return {
    observabilityId: randomUUID(),
    flowId: input.flowId,
    compiledPatternId:
      status.publishedVersion?.compiledPatternId ?? status.metadata?.compiledPatternId ?? null,
    generatedAt: new Date().toISOString(),
    runtimeStatus: status.effectiveFlowStatus,
    health,
    counts,
    killSwitch,
    activeEnrollments: enrollments.filter((entry) => entry.runtimeStatus === "active"),
    waitingEnrollments: enrollments.filter((entry) => entry.runtimeStatus === "waiting"),
    approvalRequiredEnrollments: enrollments.filter(
      (entry) => entry.runtimeStatus === "approval_required" || entry.runtimeStatus === "blocked",
    ),
    pendingJobs: jobs.filter((job) => job.status === "pending_approval" || job.status === "approved"),
    recentActivity: formatRecentActivityEntries({ enrollments, jobs, stuckWaits, failures }),
    stuckWaits,
    failures,
    safety: {
      observability_enabled: true,
      management_controls_enabled: true,
      message_send_execution_enabled: false,
      provider_execution_enabled: false,
      notifications_enabled: false,
      autonomous_execution_enabled: false,
      requires_human_review: true,
      no_message_sends: true,
      no_provider_execution: true,
      no_notifications: true,
      no_autonomous_execution: true,
      no_background_jobs: true,
    },
  }
}

export async function getAutomationRuntimeHealth(
  admin: SupabaseClient,
  input: { flowId: string; organizationId: string },
): Promise<GrowthAutomationRuntimeObservabilitySnapshot["health"]> {
  const snapshot = await getAutomationRuntimeObservability(admin, input)
  return snapshot.health
}

export async function resumeAutomationRuntime(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    clearKillSwitch?: boolean
    actingUserEmail?: string | null
  },
): Promise<GrowthAutomationRuntimeManagementResult> {
  const { graph } = await loadPublishedGraphForFlow(admin, input)
  const metadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)

  if (input.clearKillSwitch && metadata) {
    const nextMetadata = mergeRuntimeKillSwitch(metadata, {
      enabled: false,
      reason: null,
      enabledAt: null,
      enabledBy: null,
    })
    await updateAutomationRuntimeMetadata(admin, {
      flowId: input.flowId,
      versionId: graph.version.id,
      organizationId: input.organizationId,
      canvasLayoutJson: mergeRuntimeMetadataIntoCanvasLayout({
        canvasLayoutJson: graph.version.canvasLayoutJson,
        metadata: nextMetadata,
      }),
    })
  }

  const activation = await activateAutomationRuntime(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
  })

  return {
    ok: activation.ok,
    action: "resume_runtime",
    runtimeStatus: activation.effectiveFlowStatus,
    killSwitch: readRuntimeKillSwitch(activation.metadata),
    detail: activation.ok
      ? "Runtime resumed — new enrollments allowed; no auto-advance or sends."
      : "Runtime resume blocked by activation gates.",
  }
}

export async function setAutomationRuntimeKillSwitch(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    enabled: boolean
    reason?: string | null
    actingUserEmail?: string | null
  },
): Promise<GrowthAutomationRuntimeManagementResult> {
  const { graph } = await loadPublishedGraphForFlow(admin, input)
  const metadata = extractRuntimeMetadata(graph.version.canvasLayoutJson)
  if (!metadata) throw new Error("runtime_metadata_missing")

  const now = new Date().toISOString()
  const killSwitch = {
    enabled: input.enabled,
    reason: input.enabled ? input.reason ?? `${GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER}: kill switch enabled` : null,
    enabledAt: input.enabled ? now : null,
    enabledBy: input.enabled ? input.actingUserEmail ?? null : null,
  }

  const nextMetadata = mergeRuntimeKillSwitch(metadata, killSwitch)
  await updateAutomationRuntimeMetadata(admin, {
    flowId: input.flowId,
    versionId: graph.version.id,
    organizationId: input.organizationId,
    canvasLayoutJson: mergeRuntimeMetadataIntoCanvasLayout({
      canvasLayoutJson: graph.version.canvasLayoutJson,
      metadata: nextMetadata,
    }),
  })

  if (input.enabled) {
    await pauseAutomationRuntime(admin, {
      flowId: input.flowId,
      organizationId: input.organizationId,
    })
  }

  const status = await getAutomationRuntimeStatus(admin, input)

  return {
    ok: true,
    action: input.enabled ? "kill_switch_enable" : "kill_switch_disable",
    runtimeStatus: status.effectiveFlowStatus,
    killSwitch,
    detail: input.enabled
      ? "Kill switch enabled — trigger matches and manual enrollments blocked unless override."
      : "Kill switch disabled — management metadata updated only.",
  }
}

export async function safeCancelAutomationEnrollment(
  admin: SupabaseClient,
  input: {
    flowId: string
    organizationId: string
    enrollmentId: string
    leadId: string
    reason?: string | null
    actingUserId?: string | null
    actingUserEmail?: string | null
  },
): Promise<GrowthAutomationRuntimeManagementResult> {
  await getFlow(admin, { flowId: input.flowId, organizationId: input.organizationId })

  const execution = await cancelAutomationRuntimeExecution(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
    enrollmentId: input.enrollmentId,
    leadId: input.leadId,
    reason: input.reason ?? `${GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER}: safe cancel`,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })

  const status = await getAutomationRuntimeStatus(admin, {
    flowId: input.flowId,
    organizationId: input.organizationId,
  })

  return {
    ok: execution.status === "cancelled",
    action: "safe_cancel_enrollment",
    runtimeStatus: status.effectiveFlowStatus,
    killSwitch: readRuntimeKillSwitch(status.metadata),
    detail: `Enrollment ${input.enrollmentId} cancelled — row preserved with audit metadata.`,
  }
}
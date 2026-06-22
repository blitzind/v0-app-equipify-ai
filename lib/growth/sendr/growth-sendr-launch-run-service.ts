import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  continueAudienceEnrollmentPreview,
  startAudienceEnrollmentPreview,
} from "@/lib/growth/audiences/growth-audience-enrollment-preview-service"
import {
  continueAudienceEnrollmentRun,
  startAudienceEnrollmentRun,
} from "@/lib/growth/audiences/growth-audience-enrollment-run-service"
import { getGrowthAudienceEnrollmentPreview } from "@/lib/growth/audiences/growth-audience-enrollment-repository"
import { getGrowthAudience } from "@/lib/growth/audiences/growth-audience-repository"
import {
  GROWTH_SENDR_LAUNCH_QA_MARKER,
  GROWTH_SENDR_LIMITS,
} from "@/lib/growth/sendr/growth-sendr-config"
import { consumeSendrBudget, checkSendrKillSwitch, recordSendrGuardrailFailure } from "@/lib/growth/sendr/growth-sendr-guardrails"
import {
  createSendrLaunchRun,
  getSendrLaunchRun,
  updateSendrLaunchRun,
} from "@/lib/growth/sendr/growth-sendr-launch-run-repository"
import { attachSendrPageToSequence } from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"
import { listSendrSequencePageLinks } from "@/lib/growth/sendr/growth-sendr-sequence-link-repository"
import type {
  GrowthSendrLaunchNextAction,
  GrowthSendrLaunchRun,
  GrowthSendrLaunchRunProgress,
} from "@/lib/growth/sendr/growth-sendr-types"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const RESUMABLE_STATUSES = new Set<GrowthSendrLaunchRun["status"]>([
  "pending",
  "previewing",
  "ready_to_enroll",
  "enrolling",
])

async function assertLaunchEnabled(admin: SupabaseClient): Promise<void> {
  const launchSwitch = await isRuntimeKillSwitchEnabled(admin, "sendr_launch_enabled")
  if (!launchSwitch) throw new Error("sendr_launch_disabled")
}

async function consumeLaunchContinueBudget(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const kill = await checkSendrKillSwitch(admin, "sendr_launches")
  if (!kill.allowed) throw new Error(kill.reason ?? "sendr_launch_disabled")

  const budget = await consumeSendrBudget(admin, {
    organizationId,
    resourceType: "sendr_launches",
  })
  if (!budget.allowed) throw new Error(budget.reason ?? "sendr_launch_budget_exceeded")
}

async function ensureSendrSequenceLink(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    sequencePatternId: string
    attachedBy: string
    enrollmentRunId?: string | null
    preferredSenderAccountId?: string | null
  },
) {
  const existing = await listSendrSequencePageLinks(admin, {
    organizationId: input.organizationId,
    sequencePatternId: input.sequencePatternId,
    landingPageId: input.landingPageId,
    limit: 1,
  })
  if (existing[0]) return existing[0]

  return attachSendrPageToSequence(admin, {
    organizationId: input.organizationId,
    landingPageId: input.landingPageId,
    sequencePatternId: input.sequencePatternId,
    enrollmentRunId: input.enrollmentRunId ?? null,
    attachedBy: input.attachedBy,
    metadata: input.preferredSenderAccountId
      ? { preferredSenderAccountId: input.preferredSenderAccountId }
      : undefined,
  })
}

function resolveNextAction(run: GrowthSendrLaunchRun): GrowthSendrLaunchNextAction {
  if (run.status === "cancelled") return "cancelled"
  if (run.status === "completed" || run.status === "failed") return "done"
  return "continue"
}

function toProgress(
  run: GrowthSendrLaunchRun,
  chunk: { rowsRead: number; rowsWritten: number },
): GrowthSendrLaunchRunProgress {
  const nextAction = resolveNextAction(run)
  return {
    launchRunId: run.id,
    enrollmentRunId: run.enrollmentRunId,
    sequenceLinkId: run.sequenceLinkId,
    previewId: run.previewId,
    status: run.status,
    requestedCount: run.requestedCount,
    enrolledCount: run.enrolledCount,
    processedCount: run.processedCount,
    remainingCount: run.remainingCount,
    nextAction,
    hasMore: nextAction === "continue",
    rowsRead: chunk.rowsRead,
    rowsWritten: chunk.rowsWritten,
    error: run.lastError,
  }
}

async function failLaunchRun(
  admin: SupabaseClient,
  launchRunId: string,
  message: string,
): Promise<GrowthSendrLaunchRun> {
  await recordSendrGuardrailFailure(admin, message)
  return updateSendrLaunchRun(admin, launchRunId, {
    status: "failed",
    lastError: message,
    completedAt: new Date().toISOString(),
    metadata: { source: "sendr_launch_wizard", error: message },
  })
}

async function processPreviewChunk(
  admin: SupabaseClient,
  input: {
    run: GrowthSendrLaunchRun
    userId: string
    snapshotId: string
    deadlineMs: number
    previewMembersBudget: number
  },
): Promise<{
  run: GrowthSendrLaunchRun
  rowsRead: number
  rowsWritten: number
  membersProcessed: number
  phaseComplete: boolean
}> {
  let current = input.run
  let rowsRead = 0
  let rowsWritten = 0
  let membersProcessed = 0
  let previousProcessed = current.processedCount

  while (Date.now() < input.deadlineMs && membersProcessed < input.previewMembersBudget) {
    let previewProgress
    if (!current.previewId) {
      previewProgress = await startAudienceEnrollmentPreview(admin, {
        audienceId: current.audienceId,
        organizationId: current.organizationId,
        userId: input.userId,
        snapshotId: input.snapshotId,
        sequencePatternId: current.sequencePatternId,
        sendrLandingPageId: current.landingPageId,
      })
      current = await updateSendrLaunchRun(admin, current.id, {
        previewId: previewProgress.previewId,
        status: "previewing",
        lastStep: "preview_start",
      })
    } else {
      const existing = await getGrowthAudienceEnrollmentPreview(admin, current.previewId)
      if (existing?.status === "completed") {
        return {
          run: await updateSendrLaunchRun(admin, current.id, {
            status: "ready_to_enroll",
            processedCount: existing.processedCount,
            remainingCount: Math.max(0, existing.totalMembers - existing.processedCount),
            lastStep: "preview_complete",
          }),
          rowsRead,
          rowsWritten,
          membersProcessed,
          phaseComplete: true,
        }
      }

      previewProgress = await continueAudienceEnrollmentPreview(admin, {
        audienceId: current.audienceId,
        organizationId: current.organizationId,
        previewId: current.previewId,
        sequencePatternId: current.sequencePatternId,
        sendrLandingPageId: current.landingPageId,
      })
    }

    rowsRead += previewProgress.rowsRead
    rowsWritten += previewProgress.rowsWritten

    const delta = Math.max(0, previewProgress.processedCount - previousProcessed)
    membersProcessed += delta
    previousProcessed = previewProgress.processedCount

    current = await updateSendrLaunchRun(admin, current.id, {
      status: previewProgress.hasMore ? "previewing" : "ready_to_enroll",
      processedCount: previewProgress.processedCount,
      remainingCount: Math.max(0, previewProgress.totalMembers - previewProgress.processedCount),
      lastStep: previewProgress.hasMore ? "preview_batch" : "preview_complete",
      lastError: previewProgress.error,
    })

    if (!previewProgress.hasMore) {
      return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: true }
    }

    if (membersProcessed >= input.previewMembersBudget) break
  }

  return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: current.status === "ready_to_enroll" }
}

async function processEnrollmentChunk(
  admin: SupabaseClient,
  input: {
    run: GrowthSendrLaunchRun
    userId: string
    userEmail: string
    snapshotId: string
    deadlineMs: number
    enrollmentMembersBudget: number
  },
): Promise<{
  run: GrowthSendrLaunchRun
  rowsRead: number
  rowsWritten: number
  membersProcessed: number
  phaseComplete: boolean
}> {
  let current = input.run
  let rowsRead = 0
  let rowsWritten = 0
  let membersProcessed = 0
  let previousProcessed = current.processedCount

  if (current.status === "ready_to_enroll") {
    if (!current.previewId) throw new Error("preview_id_required")
    const enrollment = await startAudienceEnrollmentRun(admin, {
      audienceId: current.audienceId,
      organizationId: current.organizationId,
      userId: input.userId,
      userEmail: input.userEmail,
      snapshotId: input.snapshotId,
      sequencePatternId: current.sequencePatternId,
      previewId: current.previewId,
      enrollEligible: true,
      startImmediately: false,
      dryRun: false,
    })

    rowsRead += enrollment.rowsRead
    rowsWritten += enrollment.rowsWritten
    membersProcessed += Math.max(0, enrollment.processedCount - previousProcessed)
    previousProcessed = enrollment.processedCount

    current = await updateSendrLaunchRun(admin, current.id, {
      status: enrollment.hasMore ? "enrolling" : "completed",
      enrollmentRunId: enrollment.runId,
      requestedCount: enrollment.requestedCount,
      enrolledCount: enrollment.enrolledCount,
      processedCount: enrollment.processedCount,
      remainingCount: Math.max(0, enrollment.requestedCount - enrollment.processedCount),
      lastStep: enrollment.hasMore ? "enroll_batch" : "enroll_complete",
      lastError: enrollment.error,
      completedAt: enrollment.hasMore ? null : new Date().toISOString(),
      metadata: {
        ...current.metadata,
        previewId: current.previewId,
        qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER,
      },
    })

    if (!enrollment.hasMore) {
      logGrowthEngine("sendr_launch_completed", {
        qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER,
        launch_run_id: current.id,
        enrollment_run_id: enrollment.runId,
        enrolled_count: enrollment.enrolledCount,
      })
      return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: true }
    }

    if (membersProcessed >= input.enrollmentMembersBudget || Date.now() >= input.deadlineMs) {
      return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: false }
    }
  }

  while (
    Date.now() < input.deadlineMs &&
    membersProcessed < input.enrollmentMembersBudget &&
    current.status === "enrolling" &&
    current.enrollmentRunId
  ) {
    const enrollment = await continueAudienceEnrollmentRun(admin, {
      audienceId: current.audienceId,
      runId: current.enrollmentRunId,
      userId: input.userId,
      userEmail: input.userEmail,
    })

    rowsRead += enrollment.rowsRead
    rowsWritten += enrollment.rowsWritten

    const delta = Math.max(0, enrollment.processedCount - previousProcessed)
    membersProcessed += delta
    previousProcessed = enrollment.processedCount

    if (enrollment.status === "failed") {
      current = await failLaunchRun(admin, current.id, enrollment.error ?? "enrollment_failed")
      return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: true }
    }

    current = await updateSendrLaunchRun(admin, current.id, {
      status: enrollment.hasMore ? "enrolling" : "completed",
      requestedCount: enrollment.requestedCount,
      enrolledCount: enrollment.enrolledCount,
      processedCount: enrollment.processedCount,
      remainingCount: Math.max(0, enrollment.requestedCount - enrollment.processedCount),
      lastStep: enrollment.hasMore ? "enroll_batch" : "enroll_complete",
      lastError: enrollment.error,
      completedAt: enrollment.hasMore ? null : new Date().toISOString(),
    })

    if (!enrollment.hasMore) {
      logGrowthEngine("sendr_launch_completed", {
        qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER,
        launch_run_id: current.id,
        enrollment_run_id: enrollment.runId,
        enrolled_count: enrollment.enrolledCount,
      })
      return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: true }
    }

    if (membersProcessed >= input.enrollmentMembersBudget) break
  }

  return { run: current, rowsRead, rowsWritten, membersProcessed, phaseComplete: current.status === "completed" }
}

async function processSendrLaunchChunk(
  admin: SupabaseClient,
  input: {
    run: GrowthSendrLaunchRun
    userId: string
    userEmail: string
  },
): Promise<GrowthSendrLaunchRunProgress> {
  if (!RESUMABLE_STATUSES.has(input.run.status)) {
    return toProgress(input.run, { rowsRead: 0, rowsWritten: 0 })
  }

  const audience = await getGrowthAudience(admin, input.run.audienceId)
  const snapshotId =
    audience?.lastSnapshotId ??
    (typeof input.run.metadata.snapshotId === "string" ? input.run.metadata.snapshotId : null)
  if (!snapshotId) throw new Error("audience_snapshot_required")

  const deadlineMs = Date.now() + GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_STEP_DURATION_MS
  let current = input.run
  let rowsRead = 0
  let rowsWritten = 0

  try {
    if (current.status === "pending") {
      const preferredSenderAccountId =
        typeof current.metadata.preferredSenderAccountId === "string"
          ? current.metadata.preferredSenderAccountId
          : null
      const link = await ensureSendrSequenceLink(admin, {
        organizationId: current.organizationId,
        landingPageId: current.landingPageId,
        sequencePatternId: current.sequencePatternId,
        attachedBy: input.userId,
        preferredSenderAccountId,
      })
      current = await updateSendrLaunchRun(admin, current.id, {
        sequenceLinkId: link.id,
        status: "previewing",
        lastStep: "ensure_link",
        metadata: { ...current.metadata, snapshotId },
      })
    }

    if (current.status === "previewing" || (current.status === "pending" && current.previewId)) {
      const previewChunk = await processPreviewChunk(admin, {
        run: current,
        userId: input.userId,
        snapshotId,
        deadlineMs,
        previewMembersBudget: GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_PREVIEW_CHUNK,
      })
      current = previewChunk.run
      rowsRead += previewChunk.rowsRead
      rowsWritten += previewChunk.rowsWritten
    }

    if (
      Date.now() < deadlineMs &&
      (current.status === "ready_to_enroll" || current.status === "enrolling")
    ) {
      if (current.status === "ready_to_enroll") {
        current = await updateSendrLaunchRun(admin, current.id, {
          processedCount: 0,
          remainingCount: current.requestedCount || current.remainingCount,
          lastStep: "enroll_start",
        })
      }

      const enrollChunk = await processEnrollmentChunk(admin, {
        run: current,
        userId: input.userId,
        userEmail: input.userEmail,
        snapshotId,
        deadlineMs,
        enrollmentMembersBudget: GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_ENROLLMENT_CHUNK,
      })
      current = enrollChunk.run
      rowsRead += enrollChunk.rowsRead
      rowsWritten += enrollChunk.rowsWritten
    }

    return toProgress(current, { rowsRead, rowsWritten })
  } catch (error) {
    const message = error instanceof Error ? error.message : "sendr_launch_failed"
    current = await failLaunchRun(admin, current.id, message)
    return toProgress(current, { rowsRead, rowsWritten })
  }
}

export async function startSendrLaunchRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    userEmail: string
    audienceId: string
    sequencePatternId: string
    landingPageId: string
    senderAccountId?: string | null
  },
): Promise<GrowthSendrLaunchRunProgress> {
  await assertLaunchEnabled(admin)
  await consumeLaunchContinueBudget(admin, input.organizationId)

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }
  if (!audience.lastSnapshotId) throw new Error("audience_snapshot_required")

  const launchRun = await createSendrLaunchRun(admin, {
    organizationId: input.organizationId,
    audienceId: input.audienceId,
    sequencePatternId: input.sequencePatternId,
    landingPageId: input.landingPageId,
    metadata: {
      source: "sendr_launch_wizard",
      snapshotId: audience.lastSnapshotId,
      qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER,
      ...(input.senderAccountId ? { preferredSenderAccountId: input.senderAccountId } : {}),
    },
  })

  return processSendrLaunchChunk(admin, {
    run: launchRun,
    userId: input.userId,
    userEmail: input.userEmail,
  })
}

export async function continueSendrLaunchRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    userEmail: string
    launchRunId: string
  },
): Promise<GrowthSendrLaunchRunProgress> {
  await assertLaunchEnabled(admin)
  await consumeLaunchContinueBudget(admin, input.organizationId)

  const launchRun = await getSendrLaunchRun(admin, input.launchRunId)
  if (!launchRun || launchRun.organizationId !== input.organizationId) {
    throw new Error("launch_run_not_found")
  }

  if (!RESUMABLE_STATUSES.has(launchRun.status)) {
    return toProgress(launchRun, { rowsRead: 0, rowsWritten: 0 })
  }

  return processSendrLaunchChunk(admin, {
    run: launchRun,
    userId: input.userId,
    userEmail: input.userEmail,
  })
}

export async function cancelSendrLaunchRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    launchRunId: string
  },
): Promise<GrowthSendrLaunchRunProgress> {
  const launchRun = await getSendrLaunchRun(admin, input.launchRunId)
  if (!launchRun || launchRun.organizationId !== input.organizationId) {
    throw new Error("launch_run_not_found")
  }

  if (launchRun.status === "completed" || launchRun.status === "failed") {
    return toProgress(launchRun, { rowsRead: 0, rowsWritten: 0 })
  }

  const cancelled = await updateSendrLaunchRun(admin, launchRun.id, {
    status: "cancelled",
    lastStep: "cancelled",
    completedAt: new Date().toISOString(),
  })

  return toProgress(cancelled, { rowsRead: 0, rowsWritten: 0 })
}

export { GROWTH_SENDR_LAUNCH_QA_MARKER }

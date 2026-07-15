/**
 * GE-AIOS-OPERATOR-UX-1A — Stop autonomous progression for a lead (server-only).
 *
 * Reuses Draft Factory durable state + Growth 5F package reject path.
 * Does not send, enroll, or create a parallel lifecycle store.
 *
 * GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A — Extended terminal propagation contract.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER } from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import {
  findAutonomousOutreachPreparationRunByPackageId,
  listOutreachPreparationRunsForLead,
  markAutonomousOutreachPackageApprovalDecision,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-core"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import type { AiOsDraftFactoryDurableLeadState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  formatTerminalReasonOperatorMessage,
  getTerminalReasonPolicy,
  isHardTerminalReason,
  mapLegacyStopReasonToCanonical,
  type GrowthCanonicalTerminalReason,
  type GrowthLegacyStopAutonomousWorkReason,
} from "@/lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"
import {
  listGrowthSequenceEnrollmentSteps,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  cancelSequenceEnrollment,
  pauseSequenceEnrollment,
} from "@/lib/growth/sequences/sequence-repository"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStepStatus,
} from "@/lib/growth/sequence-enrollment-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

export type StopAutonomousWorkReason = GrowthLegacyStopAutonomousWorkReason

export type CanonicalTerminalPropagationReason =
  | GrowthCanonicalTerminalReason
  | StopAutonomousWorkReason

const TERMINAL_PROPAGATION_IDEMPOTENCY_PREFIX = "terminal_propagation"

const QUEUED_STEP_STATUSES: GrowthSequenceEnrollmentStepStatus[] = [
  "pending",
  "draft_created",
  "queued",
  "approved",
  "waiting",
]

export type StopAutonomousWorkForLeadResult = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER
  organizationId: string
  leadId: string
  reason: StopAutonomousWorkReason
  draftFactoryPaused: boolean
  packagesRejected: number
  packageIds: string[]
  sequencesHalted: number
  sequenceStepsSuppressed: number
  operatorMessage: string
  idempotentReplay: boolean
}

export type PropagateCanonicalTerminalStateResult = StopAutonomousWorkForLeadResult & {
  canonicalReason: GrowthCanonicalTerminalReason
  hardTerminal: boolean
}

function resolveCanonicalReason(
  reason: CanonicalTerminalPropagationReason,
): GrowthCanonicalTerminalReason {
  if (
    reason === "operator_canceled" ||
    reason === "lead_archived" ||
    reason === "lead_disqualified" ||
    reason === "operator_permanent_delete"
  ) {
    return mapLegacyStopReasonToCanonical(reason)
  }
  return reason
}

function mapCanonicalReasonToLegacyStop(reason: GrowthCanonicalTerminalReason): StopAutonomousWorkReason {
  switch (reason) {
    case "archived":
    case "duplicate":
    case "invalid":
    case "company_closed":
      return "lead_archived"
    case "disqualified":
      return "lead_disqualified"
    case "operator_paused":
    case "prospect_wait":
    case "relationship_protection":
    case "provider_budget_wait":
      return "operator_canceled"
    default:
      return "operator_canceled"
  }
}

async function listActiveSequenceEnrollmentsForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthSequenceEnrollment[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id, sequence_pattern_id, sequence_version, status, current_step_order, enrollment_health_score, enrollment_stalled, owner_user_id, pause_reason, started_at, completed_at, cancelled_at, cancelled_reason, metadata, created_by, created_at, updated_at")
    .eq("lead_id", leadId)
    .in("status", ["draft", "active", "paused"])
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      leadId: String(record.lead_id),
      sequencePatternId: String(record.sequence_pattern_id),
      sequenceVersion: Number(record.sequence_version),
      status: record.status as GrowthSequenceEnrollment["status"],
      currentStepOrder: Number(record.current_step_order ?? 0),
      enrollmentHealthScore: Number(record.enrollment_health_score ?? 0),
      enrollmentStalled: Boolean(record.enrollment_stalled),
      ownerUserId: (record.owner_user_id as string | null) ?? null,
      pauseReason: (record.pause_reason as string | null) ?? null,
      startedAt: (record.started_at as string | null) ?? null,
      completedAt: (record.completed_at as string | null) ?? null,
      cancelledAt: (record.cancelled_at as string | null) ?? null,
      cancelledReason: (record.cancelled_reason as string | null) ?? null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdBy: (record.created_by as string | null) ?? null,
      createdAt: String(record.created_at),
      updatedAt: String(record.updated_at),
    }
  })
}

async function haltSequenceEnrollmentsForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    canonicalReason: GrowthCanonicalTerminalReason
    now: string
    idempotencyKey: string
  },
): Promise<{ sequencesHalted: number; sequenceStepsSuppressed: number }> {
  const policy = getTerminalReasonPolicy(input.canonicalReason)
  const enrollments = await listActiveSequenceEnrollmentsForLead(admin, input.leadId)
  let sequencesHalted = 0
  let sequenceStepsSuppressed = 0

  for (const enrollment of enrollments) {
    const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
    for (const step of steps) {
      if (!QUEUED_STEP_STATUSES.includes(step.status)) continue
      await updateGrowthSequenceEnrollmentStep(admin, step.id, {
        status: "cancelled",
        skipReason: `${input.idempotencyKey}:${input.canonicalReason}`,
      } as Partial<{ status: GrowthSequenceEnrollmentStepStatus; skipReason: string | null }>)
      sequenceStepsSuppressed += 1
    }

    if (policy.sequencesAction === "cancel") {
      if (enrollment.status !== "cancelled") {
        await cancelSequenceEnrollment(admin, enrollment.id, {
          reason: `${input.idempotencyKey}:${input.canonicalReason}`,
        })
        sequencesHalted += 1
      }
    } else if (policy.sequencesAction === "pause" && enrollment.status === "active") {
      await pauseSequenceEnrollment(admin, enrollment.id)
      sequencesHalted += 1
    }
  }

  return { sequencesHalted, sequenceStepsSuppressed }
}

async function listPendingPackagesForLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<string[]> {
  try {
    const runs = await listOutreachPreparationRunsForLead(admin, organizationId, leadId)
    return runs
      .map((run) => run.approvalPackage)
      .filter(
        (pkg) =>
          pkg &&
          pkg.pendingHumanApproval === true &&
          pkg.packageApprovalDecision !== "approved" &&
          pkg.packageApprovalDecision !== "rejected",
      )
      .map((pkg) => pkg!.packageId)
  } catch {
    return []
  }
}

export async function pauseDraftFactoryWorkForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    reason: StopAutonomousWorkReason | GrowthCanonicalTerminalReason
    now?: string
    retainFutureWake?: boolean
    nextEligibleWakeAt?: string | null
  },
): Promise<boolean> {
  const now = input.now ?? new Date().toISOString()
  const repo = createPostgresDraftFactoryRepository(admin)
  const available = await repo.assertAvailable?.()
  if (available && !available.ok) {
    logGrowthEngine("completed_work_df_pause_skipped", {
      qa_marker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
      reason: available.reason,
      lead_id: input.leadId,
    })
    return false
  }

  const existing = await repo.getLeadState(input.organizationId, input.leadId)
  if (!existing) return false

  const pausedReason = String(input.reason)
  if (
    existing.state === "paused" &&
    existing.pausedReason === pausedReason &&
    (input.retainFutureWake ? existing.nextEligibleWakeAt != null : existing.nextEligibleWakeAt == null)
  ) {
    return true
  }

  const next: AiOsDraftFactoryDurableLeadState = {
    ...existing,
    state: "paused",
    pausedReason,
    nextEligibleWakeAt: input.retainFutureWake ? input.nextEligibleWakeAt ?? existing.nextEligibleWakeAt : null,
    leaseOwner: null,
    leaseExpiresAt: null,
    updatedAt: now,
  }

  return repo.upsertLeadState(next, existing.version)
}

export async function stopAutonomousWorkForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    reason: StopAutonomousWorkReason
    now?: string
    packageId?: string | null
    skipTimeline?: boolean
  },
): Promise<StopAutonomousWorkForLeadResult> {
  const canonicalReason = mapLegacyStopReasonToCanonical(input.reason)
  const propagated = await propagateCanonicalTerminalStateForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    reason: canonicalReason,
    now: input.now,
    packageId: input.packageId,
    skipTimeline: input.skipTimeline,
  })

  return {
    qaMarker: propagated.qaMarker,
    organizationId: propagated.organizationId,
    leadId: propagated.leadId,
    reason: input.reason,
    draftFactoryPaused: propagated.draftFactoryPaused,
    packagesRejected: propagated.packagesRejected,
    packageIds: propagated.packageIds,
    sequencesHalted: propagated.sequencesHalted,
    sequenceStepsSuppressed: propagated.sequenceStepsSuppressed,
    operatorMessage: propagated.operatorMessage,
    idempotentReplay: propagated.idempotentReplay,
  }
}

export async function propagateCanonicalTerminalStateForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    reason: GrowthCanonicalTerminalReason
    now?: string
    packageId?: string | null
    skipTimeline?: boolean
    idempotencyKey?: string
  },
): Promise<PropagateCanonicalTerminalStateResult> {
  const now = input.now ?? new Date().toISOString()
  const canonicalReason = resolveCanonicalReason(input.reason)
  const policy = getTerminalReasonPolicy(canonicalReason)
  const legacyReason = mapCanonicalReasonToLegacyStop(canonicalReason)
  const idempotencyKey = input.idempotencyKey ?? `${TERMINAL_PROPAGATION_IDEMPOTENCY_PREFIX}:${canonicalReason}:${input.leadId}`
  const operatorMessage = formatTerminalReasonOperatorMessage(canonicalReason)

  const packageIds = new Set<string>()
  if (input.packageId) packageIds.add(input.packageId)
  for (const id of await listPendingPackagesForLead(admin, input.organizationId, input.leadId)) {
    packageIds.add(id)
  }

  try {
    const repo = createPostgresDraftFactoryRepository(admin)
    const df = await repo.getLeadState(input.organizationId, input.leadId)
    if (df?.packageId) packageIds.add(df.packageId)
    if (
      df?.state === "paused" &&
      df.pausedReason === canonicalReason
    ) {
      return {
        qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
        organizationId: input.organizationId,
        leadId: input.leadId,
        reason: legacyReason,
        draftFactoryPaused: true,
        packagesRejected: 0,
        packageIds: [...packageIds],
        sequencesHalted: 0,
        sequenceStepsSuppressed: 0,
        operatorMessage,
        idempotentReplay: true,
        canonicalReason,
        hardTerminal: isHardTerminalReason(canonicalReason),
      }
    }
  } catch {
    // continue
  }

  let packagesRejected = 0
  for (const packageId of packageIds) {
    const existing = await findAutonomousOutreachPreparationRunByPackageId(
      admin,
      input.organizationId,
      packageId,
    ).catch(() => null)
    if (!existing?.approvalPackage) continue
    if (
      existing.approvalPackage.packageApprovalDecision === "approved" ||
      existing.approvalPackage.packageApprovalDecision === "rejected"
    ) {
      continue
    }
    await markAutonomousOutreachPackageApprovalDecision({
      admin,
      organizationId: input.organizationId,
      packageId,
      decision: "rejected",
      now,
    })
    packagesRejected += 1
  }

  const draftFactoryPaused = await pauseDraftFactoryWorkForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    reason: canonicalReason,
    now,
    retainFutureWake: policy.retainFutureWake,
  })

  const { sequencesHalted, sequenceStepsSuppressed } = await haltSequenceEnrollmentsForLead(admin, {
    leadId: input.leadId,
    canonicalReason,
    now,
    idempotencyKey,
  })

  invalidateCanonicalDecisionCacheForLead(input.leadId, `terminal_propagation:${canonicalReason}`)

  if (!input.skipTimeline) {
    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: "autonomous_work_stopped",
      title: "Autonomous work stopped",
      summary: operatorMessage,
      payload: {
        canonical_reason: canonicalReason,
        hard_terminal: isHardTerminalReason(canonicalReason),
        sequences_halted: sequencesHalted,
        sequence_steps_suppressed: sequenceStepsSuppressed,
        packages_rejected: packagesRejected,
        idempotency_key: idempotencyKey,
      },
    }).catch(() => undefined)
  }

  logGrowthEngine("completed_work_autonomous_work_stopped", {
    qa_marker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    reason: canonicalReason,
    draft_factory_paused: draftFactoryPaused,
    packages_rejected: packagesRejected,
    package_ids: [...packageIds],
    sequences_halted: sequencesHalted,
    sequence_steps_suppressed: sequenceStepsSuppressed,
    idempotency_key: idempotencyKey,
  })

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    reason: legacyReason,
    draftFactoryPaused,
    packagesRejected,
    packageIds: [...packageIds],
    sequencesHalted,
    sequenceStepsSuppressed,
    operatorMessage,
    idempotentReplay: false,
    canonicalReason,
    hardTerminal: isHardTerminalReason(canonicalReason),
  }
}

export async function propagateContactTerminalStateForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    contactId?: string | null
    sequenceEnrollmentId?: string | null
    reason?: "wrong_contact"
    now?: string
  },
): Promise<{ sequenceStepsSuppressed: number; enrollmentPaused: boolean }> {
  const now = input.now ?? new Date().toISOString()
  const reason = input.reason ?? "wrong_contact"
  let sequenceStepsSuppressed = 0
  let enrollmentPaused = false

  if (input.sequenceEnrollmentId) {
    const steps = await listGrowthSequenceEnrollmentSteps(admin, input.sequenceEnrollmentId)
    for (const step of steps) {
      if (!QUEUED_STEP_STATUSES.includes(step.status)) continue
      await updateGrowthSequenceEnrollmentStep(admin, step.id, {
        status: "cancelled",
        skipReason: `contact_terminal:${reason}`,
      } as Partial<{ status: GrowthSequenceEnrollmentStepStatus; skipReason: string | null }>)
      sequenceStepsSuppressed += 1
    }
    const enrollment = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("status")
      .eq("id", input.sequenceEnrollmentId)
      .maybeSingle()
    if (enrollment.data && (enrollment.data as { status: string }).status === "active") {
      await updateGrowthSequenceEnrollment(admin, input.sequenceEnrollmentId, {
        status: "paused",
        pauseReason: `contact_terminal:${reason}`,
      })
      enrollmentPaused = true
    }
  }

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "contact_outreach_stopped",
    title: "Contact outreach stopped",
    summary: "Ava stopped outreach to this contact. Account-level research can continue when appropriate.",
    payload: {
      contact_id: input.contactId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      reason,
      occurred_at: now,
    },
  }).catch(() => undefined)

  return { sequenceStepsSuppressed, enrollmentPaused }
}

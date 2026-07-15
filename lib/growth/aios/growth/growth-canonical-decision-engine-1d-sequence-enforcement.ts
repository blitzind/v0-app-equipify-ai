/**
 * GE-AIOS-DECISION-ENGINE-1D — Shared sequence channel enforcement (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { evaluateCanonicalSequenceStepExecution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-types"
import type { GrowthCanonicalSequenceStepEnforcement } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-types"
import type { GrowthSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import type { GrowthSequenceExecutionRunResult } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  buildCanonicalDecisionOperatorOverrideRecord,
  validateCanonicalDecisionOperatorOverride,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-enforcement"
import { recordCanonicalDecisionOperatorOverride } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-operator-override"
import type { CanonicalSequenceEnforcementTrustedGate } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"
import { isCanonicalSequenceEnforcementTrustedGateValid } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-trusted-gate"

export async function finalizeCanonicalDecisionSuppressedJob(
  admin: SupabaseClient,
  job: {
    id: string
    leadId: string
    sequenceEnrollmentId: string
    sequenceStepId: string | null
    attemptCount: number
    lastError: string | null
  },
  enforcement: GrowthCanonicalSequenceStepEnforcement,
): Promise<void> {
  const alreadyRecorded = job.lastError === enforcement.enforcementFingerprint

  await updateSequenceExecutionJob(admin, job.id, {
    status: "blocked",
    lastError: enforcement.enforcementFingerprint,
    lockedAt: null,
    lockedBy: null,
    attemptCount: job.attemptCount,
  })

  if (alreadyRecorded) return

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "canonical_decision_suppressed",
    title: "Sequence step suppressed by canonical decision",
    description: enforcement.reason,
    severity: "medium",
    metadata: {
      outcome: enforcement.outcome,
      enforcement_fingerprint: enforcement.enforcementFingerprint,
      wait_until: enforcement.waitUntil,
    },
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: job.leadId,
    eventType: "sequence_step_blocked",
    title: "Sequence step suppressed",
    summary: `${enforcement.outcome}: ${enforcement.reason}`,
    jobId: job.id,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
  })
}

export async function enforceCanonicalDecisionForSequenceChannelJob(
  admin: SupabaseClient,
  input: {
    job: GrowthSequenceExecutionJob
    channelLabel?: string | null
    operatorOverride?: boolean
    operatorOverrideReason?: string | null
    operatorId?: string | null
    operatorEmail?: string | null
    cacheScope?: string
    trustedGate?: CanonicalSequenceEnforcementTrustedGate | null
  },
): Promise<
  | {
      allowed: true
      enforcement: GrowthCanonicalSequenceStepEnforcement
      decisionFingerprint: string | null
      overrideRecorded?: boolean
      trustedGateConsumed?: boolean
    }
  | {
      allowed: false
      enforcement: GrowthCanonicalSequenceStepEnforcement
      decisionFingerprint: string | null
      result: GrowthSequenceExecutionRunResult
    }
> {
  const channelLabel = input.channelLabel ?? input.job.channel ?? null

  if (
    input.trustedGate &&
    isCanonicalSequenceEnforcementTrustedGateValid(input.trustedGate, {
      jobId: input.job.id,
      leadId: input.job.leadId,
      channelLabel,
    })
  ) {
    return {
      allowed: true,
      decisionFingerprint: input.trustedGate.decisionFingerprint,
      trustedGateConsumed: true,
      enforcement: {
        qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER,
        allowed: true,
        outcome: "canonical_decision_suppressed",
        reason: "Trusted canonical gate from parent sequence runner.",
        waitUntil: null,
        enforcementFingerprint: input.trustedGate.enforcementFingerprint,
      },
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.job.leadId).catch(() => null)
  const organizationId = lead?.promotedOrganizationId ?? null
  if (!organizationId) {
    const enforcement = evaluateCanonicalSequenceStepExecution(null, {
      stepLabel: channelLabel,
      stepChannel: input.job.channel ?? null,
      executionPhase: "dispatch",
    })
    await finalizeCanonicalDecisionSuppressedJob(admin, input.job, enforcement)
    return {
      allowed: false,
      enforcement,
      decisionFingerprint: null,
      result: {
        ok: false,
        jobId: input.job.id,
        status: "blocked",
        message: enforcement.outcome,
        blocked: true,
      },
    }
  }

  const resolution = await resolveGrowthCanonicalDecisionForLeadCached(admin, {
    organizationId,
    leadId: input.job.leadId,
    cacheScope: input.cacheScope ?? `sequence-channel:${input.job.id}`,
  }).catch(() => null)

  const enforcement = evaluateCanonicalSequenceStepExecution(resolution, {
    stepLabel: channelLabel,
    stepChannel: input.job.channel ?? null,
    operatorOverride: false,
    executionPhase: "dispatch",
  })
  const decisionFingerprint = resolution?.decision.decisionFingerprint ?? null

  if (!enforcement.allowed && input.operatorOverrideReason?.trim()) {
    const validation = validateCanonicalDecisionOperatorOverride({
      resolution,
      scope: "sequence",
      reason: input.operatorOverrideReason,
      suppressionCode: enforcement.outcome,
    })
    if (validation.allowed && resolution) {
      const override = buildCanonicalDecisionOperatorOverrideRecord({
        operatorId: input.operatorId ?? "operator",
        operatorEmail: input.operatorEmail ?? null,
        reason: input.operatorOverrideReason,
        resolution,
        suppressionCode: enforcement.outcome,
        enforcementFingerprint: enforcement.enforcementFingerprint,
        scope: "sequence",
      })
      await recordCanonicalDecisionOperatorOverride(admin, {
        leadId: input.job.leadId,
        jobId: input.job.id,
        override,
        channel: channelLabel,
        action: "sequence_step_execution",
      })
      return { allowed: true, enforcement, decisionFingerprint, overrideRecorded: true }
    }
  }

  if (enforcement.allowed) {
    return { allowed: true, enforcement, decisionFingerprint }
  }

  await finalizeCanonicalDecisionSuppressedJob(admin, input.job, enforcement)

  return {
    allowed: false,
    enforcement,
    decisionFingerprint,
    result: {
      ok: false,
      jobId: input.job.id,
      status: "blocked",
      message: enforcement.outcome,
      blocked: true,
    },
  }
}

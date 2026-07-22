/** GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Wake observability handle + invariants (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildDraftFactoryWakeFingerprint } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import {
  evaluateDraftFactoryWakeEvidence,
  finalizeDraftFactoryWakeAttempt,
  insertDraftFactoryWakeAttempt,
  insertDraftFactoryWakeAttemptTransition,
  insertDraftFactoryWakeSubscriberTelemetry,
} from "@/lib/growth/draft-factory/draft-factory-wake-observability-repository"
import { captureFailureLocation } from "@/lib/growth/draft-factory/draft-factory-wake-observability-runtime"
import type {
  DraftFactoryWakeAttemptStage,
  DraftFactoryWakeTerminalOutcome,
} from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"
import { logGrowthEngine } from "@/lib/growth/access"

export type DraftFactoryWakeObservabilityHandle = {
  wakeAttemptId: string
  eventId: string
  organizationId: string
  leadId: string
  researchRunId: string | null
  wakeType: string
  wakeFingerprint: string | null
  recordTransition: (
    stage: DraftFactoryWakeAttemptStage,
    metadata?: Record<string, unknown>,
  ) => Promise<void>
  recordFailure: (
    error: unknown,
    stage: DraftFactoryWakeAttemptStage,
    metadata?: Record<string, unknown>,
  ) => Promise<void>
  finalize: (
    outcome: DraftFactoryWakeTerminalOutcome,
    reason?: string | null,
    metadata?: Record<string, unknown>,
  ) => Promise<void>
  assertResearchCompleteEvidence: () => Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorStack(error: unknown): string | null {
  return error instanceof Error ? error.stack ?? null : null
}

export async function createDraftFactoryWakeObservabilityHandle(
  admin: SupabaseClient,
  input: {
    eventId: string
    organizationId: string
    leadId: string
    researchRunId: string | null
    wakeType: string
    subscriberId: string
    invocationSource: string
    runtimeInstance: string
    sourceId: string
  },
): Promise<DraftFactoryWakeObservabilityHandle> {
  const wakeFingerprint = buildDraftFactoryWakeFingerprint({
    organizationId: input.organizationId,
    leadId: input.leadId,
    wakeType: input.wakeType,
    sourceVersionOrEventId: input.sourceId,
  })

  const attempt = await insertDraftFactoryWakeAttempt(admin, {
    eventId: input.eventId,
    organizationId: input.organizationId,
    leadId: input.leadId,
    researchRunId: input.researchRunId,
    wakeType: input.wakeType,
    subscriberId: input.subscriberId,
    wakeFingerprint,
    invocationSource: input.invocationSource,
    runtimeInstance: input.runtimeInstance,
    correlationEventId: input.eventId,
  })

  const wakeAttemptId = attempt.id

  async function recordTransition(stage: DraftFactoryWakeAttemptStage, metadata?: Record<string, unknown>) {
    await insertDraftFactoryWakeAttemptTransition(admin, {
      wakeAttemptId,
      stage,
      metadata: {
        event_id: input.eventId,
        lead_id: input.leadId,
        research_run_id: input.researchRunId,
        wake_fingerprint: wakeFingerprint,
        ...(metadata ?? {}),
      },
    })
  }

  async function recordFailure(
    error: unknown,
    stage: DraftFactoryWakeAttemptStage,
    metadata?: Record<string, unknown>,
  ) {
    const location = captureFailureLocation(error)
    await insertDraftFactoryWakeAttemptTransition(admin, {
      wakeAttemptId,
      stage: "FAILED",
      metadata: {
        event_id: input.eventId,
        lead_id: input.leadId,
        research_run_id: input.researchRunId,
        failed_stage: stage,
        ...(metadata ?? {}),
      },
      failure: {
        type: location.failureType,
        message: errorMessage(error).slice(0, 2000),
        stack: errorStack(error)?.slice(0, 8000) ?? null,
        function: location.failureFunction,
        file: location.failureFile,
        line: location.failureLine,
      },
    })
    logGrowthEngine("draft_factory_wake_attempt_failed", {
      wake_attempt_id: wakeAttemptId,
      event_id: input.eventId,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      research_run_id: input.researchRunId,
      wake_type: input.wakeType,
      failed_stage: stage,
      message: errorMessage(error).slice(0, 240),
    })
  }

  async function finalize(
    outcome: DraftFactoryWakeTerminalOutcome,
    reason?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    await finalizeDraftFactoryWakeAttempt(admin, {
      wakeAttemptId,
      outcome,
      reason,
      metadata: {
        event_id: input.eventId,
        lead_id: input.leadId,
        research_run_id: input.researchRunId,
        ...(metadata ?? {}),
      },
    })
  }

  async function assertResearchCompleteEvidence() {
    if (input.wakeType !== "research_completed") return
    const evidence = await evaluateDraftFactoryWakeEvidence(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeAttemptId,
      wakeFingerprint,
    })
    if (evidence.invariantSatisfied) return
    const message =
      "research_complete wake invariant violated — no DF row, receipt, or durable failure record"
    await recordFailure(new Error(message), "FAILED", { invariant: "research_complete_first_write" })
    await finalize("FAILED", message, { invariant_violation: true })
    logGrowthEngine("draft_factory_wake_invariant_violation", {
      wake_attempt_id: wakeAttemptId,
      event_id: input.eventId,
      lead_id: input.leadId,
      research_run_id: input.researchRunId,
      evidence,
    })
  }

  return {
    wakeAttemptId,
    eventId: input.eventId,
    organizationId: input.organizationId,
    leadId: input.leadId,
    researchRunId: input.researchRunId,
    wakeType: input.wakeType,
    wakeFingerprint,
    recordTransition,
    recordFailure,
    finalize,
    assertResearchCompleteEvidence,
  }
}

export async function recordDraftFactoryWakeSubscriberObservation(
  admin: SupabaseClient,
  input: {
    wakeAttemptId: string | null
    eventId: string
    organizationId: string
    subscriberId: string
    received: boolean
    status: "received" | "started" | "completed" | "failed" | "skipped"
    startedAt?: string | null
    completedAt?: string | null
    durationMs?: number | null
    skipReason?: string | null
    errorMessage?: string | null
  },
): Promise<void> {
  await insertDraftFactoryWakeSubscriberTelemetry(admin, input)
}

export async function createSkippedDraftFactoryWakeAttempt(
  admin: SupabaseClient,
  input: {
    eventId: string
    organizationId: string
    leadId: string | null
    researchRunId: string | null
    wakeType: string
    subscriberId: string
    invocationSource: string
    runtimeInstance: string
    sourceId: string
    reason: string
  },
): Promise<string> {
  const wakeFingerprint =
    input.leadId != null
      ? buildDraftFactoryWakeFingerprint({
          organizationId: input.organizationId,
          leadId: input.leadId,
          wakeType: input.wakeType,
          sourceVersionOrEventId: input.sourceId,
        })
      : null

  const attempt = await insertDraftFactoryWakeAttempt(admin, {
    eventId: input.eventId,
    organizationId: input.organizationId,
    leadId: input.leadId,
    researchRunId: input.researchRunId,
    wakeType: input.wakeType,
    subscriberId: input.subscriberId,
    wakeFingerprint,
    invocationSource: input.invocationSource,
    runtimeInstance: input.runtimeInstance,
    correlationEventId: input.eventId,
  })

  await insertDraftFactoryWakeAttemptTransition(admin, {
    wakeAttemptId: attempt.id,
    stage: "SKIPPED",
    metadata: { reason: input.reason, event_id: input.eventId, lead_id: input.leadId },
  })

  await recordDraftFactoryWakeSubscriberObservation(admin, {
    wakeAttemptId: attempt.id,
    eventId: input.eventId,
    organizationId: input.organizationId,
    subscriberId: input.subscriberId,
    received: true,
    status: "skipped",
    skipReason: input.reason,
    completedAt: new Date().toISOString(),
  })

  return attempt.id
}

export async function createFailedDraftFactoryWakeAttempt(
  admin: SupabaseClient,
  input: {
    eventId: string
    organizationId: string
    leadId: string | null
    researchRunId: string | null
    wakeType: string
    subscriberId: string
    invocationSource: string
    runtimeInstance: string
    sourceId: string
    reason: string
    error: unknown
    stage?: DraftFactoryWakeAttemptStage
  },
): Promise<string> {
  const wakeFingerprint =
    input.leadId != null
      ? buildDraftFactoryWakeFingerprint({
          organizationId: input.organizationId,
          leadId: input.leadId,
          wakeType: input.wakeType,
          sourceVersionOrEventId: input.sourceId,
        })
      : null

  const attempt = await insertDraftFactoryWakeAttempt(admin, {
    eventId: input.eventId,
    organizationId: input.organizationId,
    leadId: input.leadId,
    researchRunId: input.researchRunId,
    wakeType: input.wakeType,
    subscriberId: input.subscriberId,
    wakeFingerprint,
    invocationSource: input.invocationSource,
    runtimeInstance: input.runtimeInstance,
    correlationEventId: input.eventId,
  })

  const failedStage = input.stage ?? "HANDLER_STARTED"
  await recordFailureOnAttempt(admin, attempt.id, input.error, failedStage, {
    reason: input.reason,
    event_id: input.eventId,
    lead_id: input.leadId,
  })

  await recordDraftFactoryWakeSubscriberObservation(admin, {
    wakeAttemptId: attempt.id,
    eventId: input.eventId,
    organizationId: input.organizationId,
    subscriberId: input.subscriberId,
    received: true,
    status: "failed",
    errorMessage: errorMessage(input.error).slice(0, 500),
    completedAt: new Date().toISOString(),
  })

  return attempt.id
}

async function recordFailureOnAttempt(
  admin: SupabaseClient,
  wakeAttemptId: string,
  error: unknown,
  stage: DraftFactoryWakeAttemptStage,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const location = captureFailureLocation(error)
  await insertDraftFactoryWakeAttemptTransition(admin, {
    wakeAttemptId,
    stage: "FAILED",
    metadata: { failed_stage: stage, ...(metadata ?? {}) },
    failure: {
      type: location.failureType,
      message: errorMessage(error).slice(0, 2000),
      stack: errorStack(error)?.slice(0, 8000) ?? null,
      function: location.failureFunction,
      file: location.failureFile,
      line: location.failureLine,
    },
  })
}

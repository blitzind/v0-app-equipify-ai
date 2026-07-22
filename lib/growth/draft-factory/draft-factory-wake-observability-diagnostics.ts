/** GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Operator diagnostics timeline (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiOsEventById } from "@/lib/growth/aios/ai-event-repository"
import {
  evaluateDraftFactoryWakeEvidence,
  fetchAiOsEventHandlerTelemetry,
  fetchLatestDraftFactoryWakeAttemptForEvent,
  listDraftFactoryWakeAttemptTransitions,
  listDraftFactoryWakeSubscriberTelemetry,
} from "@/lib/growth/draft-factory/draft-factory-wake-observability-repository"
import {
  GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
  type DraftFactoryWakeDiagnosticTimeline,
  type DraftFactoryWakeDiagnosticStep,
} from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"

function transitionAt(
  transitions: Array<{ stage: string; occurredAt: string; metadata: Record<string, unknown> }>,
  stage: string,
): { occurredAt: string | null; detail: string | null } {
  const row = [...transitions].reverse().find((entry) => entry.stage === stage)
  if (!row) return { occurredAt: null, detail: null }
  const detail =
    typeof row.metadata.reason === "string"
      ? row.metadata.reason
      : typeof row.metadata.outcome === "string"
        ? row.metadata.outcome
        : null
  return { occurredAt: row.occurredAt, detail }
}

export async function buildDraftFactoryWakeDiagnosticTimeline(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventId: string
    leadId?: string | null
  },
): Promise<DraftFactoryWakeDiagnosticTimeline> {
  const event = await fetchAiOsEventById(admin, {
    organizationId: input.organizationId,
    eventId: input.eventId,
  })

  const attempt = await fetchLatestDraftFactoryWakeAttemptForEvent(admin, {
    organizationId: input.organizationId,
    eventId: input.eventId,
    leadId: input.leadId ?? event?.entityId ?? null,
  })

  const transitions = attempt
    ? await listDraftFactoryWakeAttemptTransitions(admin, attempt.id)
    : []

  const subscriberTelemetry = attempt
    ? await listDraftFactoryWakeSubscriberTelemetry(admin, { wakeAttemptId: attempt.id })
    : await listDraftFactoryWakeSubscriberTelemetry(admin, { eventId: input.eventId })

  const handlerTelemetry = await fetchAiOsEventHandlerTelemetry(admin, input.eventId)

  const leadId = attempt?.leadId ?? input.leadId ?? event?.entityId ?? null
  const evidence =
    leadId && attempt
      ? await evaluateDraftFactoryWakeEvidence(admin, {
          organizationId: input.organizationId,
          leadId,
          wakeAttemptId: attempt.id,
          wakeFingerprint: attempt.wakeFingerprint,
        })
      : {
          draftFactoryRowExists: false,
          wakeReceiptExists: false,
          durableFailureExists: Boolean(attempt?.terminalOutcome === "FAILED" || attempt?.terminalOutcome === "SKIPPED"),
          invariantSatisfied: Boolean(attempt?.terminalOutcome),
        }

  const stepDefs: Array<{ key: DraftFactoryWakeDiagnosticStep["key"]; label: string; stage?: string }> = [
    { key: "research_complete", label: "Research Complete" },
    { key: "wake_received", label: "Wake Received", stage: "CREATED" },
    { key: "subscriber_started", label: "Subscriber Started", stage: "HANDLER_STARTED" },
    { key: "plan_built", label: "Plan Built", stage: "PLAN_CREATED" },
    { key: "advance_started", label: "Advance Started", stage: "ADVANCE_STARTED" },
    { key: "df_row_written", label: "DF Row Written", stage: "UPSERT_COMPLETED" },
    { key: "receipt_written", label: "Receipt Written", stage: "RECEIPT_WRITTEN" },
    { key: "complete", label: "Complete", stage: "SUCCESS" },
  ]

  const steps: DraftFactoryWakeDiagnosticStep[] = stepDefs.map((def) => {
    if (def.key === "research_complete") {
      return {
        key: def.key,
        label: def.label,
        occurredAt: event?.occurredAt ?? null,
        detail: typeof event?.payload?.workflow_status === "string" ? event.payload.workflow_status : null,
      }
    }
    if (!def.stage) {
      return { key: def.key, label: def.label, occurredAt: null, detail: null }
    }
    const point = transitionAt(transitions, def.stage)
    return { key: def.key, label: def.label, occurredAt: point.occurredAt, detail: point.detail }
  })

  return {
    qaMarker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
    wakeAttemptId: attempt?.id ?? null,
    eventId: input.eventId,
    organizationId: input.organizationId,
    leadId,
    researchRunId: attempt?.researchRunId ?? null,
    terminalOutcome: attempt?.terminalOutcome ?? null,
    terminalReason: attempt?.terminalReason ?? null,
    steps,
    transitions,
    subscriberTelemetry: subscriberTelemetry.map((row) => ({
      subscriberId: row.subscriberId,
      status: row.status,
      durationMs: row.durationMs,
      skipReason: row.skipReason,
      errorMessage: row.errorMessage,
    })),
    handlerTelemetry,
    evidence,
  }
}

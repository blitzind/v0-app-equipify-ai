/** GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Durable wake ledger persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
  type DraftFactoryWakeAttemptRecord,
  type DraftFactoryWakeAttemptStage,
  type DraftFactoryWakeAttemptTransitionRecord,
  type DraftFactoryWakeSubscriberStatus,
  type DraftFactoryWakeTerminalOutcome,
} from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"

function attemptsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("draft_factory_wake_attempts")
}

function transitionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("draft_factory_wake_attempt_transitions")
}

function handlerTelemetryTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_event_handler_telemetry")
}

function subscriberTelemetryTable(admin: SupabaseClient) {
  return admin.schema("growth").from("draft_factory_wake_subscriber_telemetry")
}

function mapAttempt(row: Record<string, unknown>): DraftFactoryWakeAttemptRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    organizationId: String(row.organization_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    researchRunId: row.research_run_id ? String(row.research_run_id) : null,
    wakeType: String(row.wake_type),
    subscriberId: String(row.subscriber_id),
    wakeFingerprint: row.wake_fingerprint ? String(row.wake_fingerprint) : null,
    invocationSource: String(row.invocation_source ?? ""),
    runtimeInstance: String(row.runtime_instance ?? ""),
    currentStage: row.current_stage as DraftFactoryWakeAttemptRecord["currentStage"],
    terminalOutcome: (row.terminal_outcome as DraftFactoryWakeTerminalOutcome | null) ?? null,
    terminalReason: row.terminal_reason ? String(row.terminal_reason) : null,
    correlationEventId: String(row.correlation_event_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }
}

function mapTransition(row: Record<string, unknown>): DraftFactoryWakeAttemptTransitionRecord {
  return {
    id: String(row.id),
    wakeAttemptId: String(row.wake_attempt_id),
    stage: row.stage as DraftFactoryWakeAttemptTransitionRecord["stage"],
    occurredAt: String(row.occurred_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    failureType: row.failure_type ? String(row.failure_type) : null,
    failureMessage: row.failure_message ? String(row.failure_message) : null,
    failureStack: row.failure_stack ? String(row.failure_stack) : null,
    failureFunction: row.failure_function ? String(row.failure_function) : null,
    failureFile: row.failure_file ? String(row.failure_file) : null,
    failureLine: typeof row.failure_line === "number" ? row.failure_line : null,
  }
}

export async function insertDraftFactoryWakeAttempt(
  admin: SupabaseClient,
  input: {
    eventId: string
    organizationId: string
    leadId: string | null
    researchRunId: string | null
    wakeType: string
    subscriberId: string
    wakeFingerprint: string | null
    invocationSource: string
    runtimeInstance: string
    correlationEventId: string
  },
): Promise<DraftFactoryWakeAttemptRecord> {
  const now = new Date().toISOString()
  const { data, error } = await attemptsTable(admin)
    .insert({
      event_id: input.eventId,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      research_run_id: input.researchRunId,
      wake_type: input.wakeType,
      subscriber_id: input.subscriberId,
      wake_fingerprint: input.wakeFingerprint,
      invocation_source: input.invocationSource,
      runtime_instance: input.runtimeInstance,
      current_stage: "CREATED",
      correlation_event_id: input.correlationEventId,
      qa_marker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(`insertDraftFactoryWakeAttempt failed: ${error.message}`)
  await insertDraftFactoryWakeAttemptTransition(admin, {
    wakeAttemptId: String(data.id),
    stage: "CREATED",
    metadata: {
      event_id: input.eventId,
      lead_id: input.leadId,
      research_run_id: input.researchRunId,
    },
  })
  return mapAttempt(data as Record<string, unknown>)
}

export async function insertDraftFactoryWakeAttemptTransition(
  admin: SupabaseClient,
  input: {
    wakeAttemptId: string
    stage: DraftFactoryWakeAttemptStage
    metadata?: Record<string, unknown>
    failure?: {
      type: string
      message: string
      stack?: string | null
      function?: string | null
      file?: string | null
      line?: number | null
    }
  },
): Promise<DraftFactoryWakeAttemptTransitionRecord> {
  const { data, error } = await transitionsTable(admin)
    .insert({
      wake_attempt_id: input.wakeAttemptId,
      stage: input.stage,
      metadata: input.metadata ?? {},
      failure_type: input.failure?.type ?? null,
      failure_message: input.failure?.message ?? null,
      failure_stack: input.failure?.stack ?? null,
      failure_function: input.failure?.function ?? null,
      failure_file: input.failure?.file ?? null,
      failure_line: input.failure?.line ?? null,
      qa_marker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(`insertDraftFactoryWakeAttemptTransition failed: ${error.message}`)

  const now = new Date().toISOString()
  const terminal =
    input.stage === "SUCCESS" || input.stage === "FAILED" || input.stage === "SKIPPED"
      ? (input.stage as DraftFactoryWakeTerminalOutcome)
      : null

  await attemptsTable(admin)
    .update({
      current_stage: input.stage,
      updated_at: now,
      ...(terminal
        ? {
            terminal_outcome: terminal,
            terminal_reason:
              typeof input.metadata?.reason === "string" ? input.metadata.reason : input.failure?.message ?? null,
            completed_at: now,
          }
        : {}),
    })
    .eq("id", input.wakeAttemptId)

  return mapTransition(data as Record<string, unknown>)
}

export async function finalizeDraftFactoryWakeAttempt(
  admin: SupabaseClient,
  input: {
    wakeAttemptId: string
    outcome: DraftFactoryWakeTerminalOutcome
    reason?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await insertDraftFactoryWakeAttemptTransition(admin, {
    wakeAttemptId: input.wakeAttemptId,
    stage: input.outcome,
    metadata: { ...(input.metadata ?? {}), reason: input.reason ?? null },
  })
}

export async function persistAiOsEventHandlerTelemetry(
  admin: SupabaseClient,
  input: {
    eventId: string
    organizationId: string
    handlersDiscovered: string[]
    handlersInvoked: string[]
    handlersSkipped: string[]
    handlerFailures: Array<{ subscriberId: string; errorMessage?: string }>
    runtimeInstance: string
  },
): Promise<void> {
  const { error } = await handlerTelemetryTable(admin).upsert(
    {
      event_id: input.eventId,
      organization_id: input.organizationId,
      handlers_discovered: input.handlersDiscovered,
      handlers_invoked: input.handlersInvoked,
      handlers_skipped: input.handlersSkipped,
      handler_failures: input.handlerFailures,
      runtime_instance: input.runtimeInstance,
      qa_marker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
    },
    { onConflict: "event_id" },
  )
  if (error) throw new Error(`persistAiOsEventHandlerTelemetry failed: ${error.message}`)
}

export async function insertDraftFactoryWakeSubscriberTelemetry(
  admin: SupabaseClient,
  input: {
    wakeAttemptId: string | null
    eventId: string
    organizationId: string
    subscriberId: string
    received: boolean
    startedAt?: string | null
    completedAt?: string | null
    status: DraftFactoryWakeSubscriberStatus
    durationMs?: number | null
    skipReason?: string | null
    errorMessage?: string | null
  },
): Promise<void> {
  const { error } = await subscriberTelemetryTable(admin).insert({
    wake_attempt_id: input.wakeAttemptId,
    event_id: input.eventId,
    organization_id: input.organizationId,
    subscriber_id: input.subscriberId,
    received: input.received,
    started_at: input.startedAt ?? null,
    completed_at: input.completedAt ?? null,
    status: input.status,
    duration_ms: input.durationMs ?? null,
    skip_reason: input.skipReason ?? null,
    error_message: input.errorMessage ?? null,
    qa_marker: GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
  })
  if (error) throw new Error(`insertDraftFactoryWakeSubscriberTelemetry failed: ${error.message}`)
}

export async function fetchDraftFactoryWakeAttemptById(
  admin: SupabaseClient,
  wakeAttemptId: string,
): Promise<DraftFactoryWakeAttemptRecord | null> {
  const { data, error } = await attemptsTable(admin).select("*").eq("id", wakeAttemptId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAttempt(data as Record<string, unknown>) : null
}

export async function fetchLatestDraftFactoryWakeAttemptForEvent(
  admin: SupabaseClient,
  input: { organizationId: string; eventId: string; leadId?: string | null },
): Promise<DraftFactoryWakeAttemptRecord | null> {
  let query = attemptsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("event_id", input.eventId)
    .order("created_at", { ascending: false })
    .limit(1)
  if (input.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAttempt(data as Record<string, unknown>) : null
}

export async function listDraftFactoryWakeAttemptTransitions(
  admin: SupabaseClient,
  wakeAttemptId: string,
): Promise<DraftFactoryWakeAttemptTransitionRecord[]> {
  const { data, error } = await transitionsTable(admin)
    .select("*")
    .eq("wake_attempt_id", wakeAttemptId)
    .order("occurred_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapTransition(row as Record<string, unknown>))
}

export async function fetchAiOsEventHandlerTelemetry(
  admin: SupabaseClient,
  eventId: string,
): Promise<{
  handlersDiscovered: string[]
  handlersInvoked: string[]
  handlersSkipped: string[]
  handlerFailures: Array<{ subscriberId: string; errorMessage?: string }>
} | null> {
  const { data, error } = await handlerTelemetryTable(admin).select("*").eq("event_id", eventId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    handlersDiscovered: (row.handlers_discovered as string[]) ?? [],
    handlersInvoked: (row.handlers_invoked as string[]) ?? [],
    handlersSkipped: (row.handlers_skipped as string[]) ?? [],
    handlerFailures: (row.handler_failures as Array<{ subscriberId: string; errorMessage?: string }>) ?? [],
  }
}

export async function listDraftFactoryWakeSubscriberTelemetry(
  admin: SupabaseClient,
  input: { wakeAttemptId?: string; eventId?: string },
): Promise<
  Array<{
    subscriberId: string
    status: DraftFactoryWakeSubscriberStatus
    durationMs: number | null
    skipReason: string | null
    errorMessage: string | null
    startedAt: string | null
    completedAt: string | null
  }>
> {
  let query = subscriberTelemetryTable(admin).select("*").order("created_at", { ascending: true })
  if (input.wakeAttemptId) query = query.eq("wake_attempt_id", input.wakeAttemptId)
  if (input.eventId) query = query.eq("event_id", input.eventId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      subscriberId: String(r.subscriber_id),
      status: r.status as DraftFactoryWakeSubscriberStatus,
      durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
      skipReason: r.skip_reason ? String(r.skip_reason) : null,
      errorMessage: r.error_message ? String(r.error_message) : null,
      startedAt: r.started_at ? String(r.started_at) : null,
      completedAt: r.completed_at ? String(r.completed_at) : null,
    }
  })
}

export async function evaluateDraftFactoryWakeEvidence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeAttemptId: string | null
    wakeFingerprint: string | null
  },
): Promise<{
  draftFactoryRowExists: boolean
  wakeReceiptExists: boolean
  durableFailureExists: boolean
  invariantSatisfied: boolean
}> {
  const [{ data: df }, receiptQuery, attemptQuery] = await Promise.all([
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("lead_id")
      .eq("organization_id", input.organizationId)
      .eq("lead_id", input.leadId)
      .maybeSingle(),
    input.wakeFingerprint
      ? admin
          .schema("growth")
          .from("draft_factory_wake_receipts")
          .select("id")
          .eq("organization_id", input.organizationId)
          .eq("lead_id", input.leadId)
          .eq("wake_fingerprint", input.wakeFingerprint)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.wakeAttemptId
      ? admin
          .schema("growth")
          .from("draft_factory_wake_attempts")
          .select("terminal_outcome")
          .eq("id", input.wakeAttemptId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const draftFactoryRowExists = Boolean(df)
  const wakeReceiptExists = Boolean(receiptQuery.data)
  const attempt = attemptQuery.data as { terminal_outcome?: string | null } | null
  const durableFailureExists =
    attempt?.terminal_outcome === "FAILED" ||
    attempt?.terminal_outcome === "SKIPPED" ||
    Boolean(
      input.wakeAttemptId &&
        (await admin
          .schema("growth")
          .from("draft_factory_wake_attempt_transitions")
          .select("id")
          .eq("wake_attempt_id", input.wakeAttemptId)
          .eq("stage", "FAILED")
          .limit(1)
          .maybeSingle()).data,
    )

  return {
    draftFactoryRowExists,
    wakeReceiptExists,
    durableFailureExists,
    invariantSatisfied: draftFactoryRowExists || wakeReceiptExists || durableFailureExists,
  }
}

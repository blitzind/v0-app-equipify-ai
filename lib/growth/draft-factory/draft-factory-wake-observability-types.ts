/** GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Wake observability types (client-safe). */

export const GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER =
  "ge-aios-draft-factory-wake-observability-1a-v1" as const

export const DRAFT_FACTORY_WAKE_ATTEMPT_STAGES = [
  "CREATED",
  "HANDLER_STARTED",
  "PLAN_CREATED",
  "ADVANCE_STARTED",
  "UPSERT_COMPLETED",
  "RECEIPT_WRITTEN",
  "SUCCESS",
  "FAILED",
  "SKIPPED",
] as const

export type DraftFactoryWakeAttemptStage = (typeof DRAFT_FACTORY_WAKE_ATTEMPT_STAGES)[number]

export const DRAFT_FACTORY_WAKE_TERMINAL_OUTCOMES = ["SUCCESS", "FAILED", "SKIPPED"] as const

export type DraftFactoryWakeTerminalOutcome = (typeof DRAFT_FACTORY_WAKE_TERMINAL_OUTCOMES)[number]

export type DraftFactoryWakeSubscriberStatus = "received" | "started" | "completed" | "failed" | "skipped"

export type DraftFactoryWakeAttemptRecord = {
  id: string
  eventId: string
  organizationId: string
  leadId: string | null
  researchRunId: string | null
  wakeType: string
  subscriberId: string
  wakeFingerprint: string | null
  invocationSource: string
  runtimeInstance: string
  currentStage: DraftFactoryWakeAttemptStage
  terminalOutcome: DraftFactoryWakeTerminalOutcome | null
  terminalReason: string | null
  correlationEventId: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type DraftFactoryWakeAttemptTransitionRecord = {
  id: string
  wakeAttemptId: string
  stage: DraftFactoryWakeAttemptStage
  occurredAt: string
  metadata: Record<string, unknown>
  failureType: string | null
  failureMessage: string | null
  failureStack: string | null
  failureFunction: string | null
  failureFile: string | null
  failureLine: number | null
}

export type DraftFactoryWakeDiagnosticStep = {
  key:
    | "research_complete"
    | "wake_received"
    | "subscriber_started"
    | "plan_built"
    | "advance_started"
    | "df_row_written"
    | "receipt_written"
    | "complete"
  label: string
  occurredAt: string | null
  detail: string | null
}

export type DraftFactoryWakeDiagnosticTimeline = {
  qaMarker: typeof GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER
  wakeAttemptId: string | null
  eventId: string
  organizationId: string
  leadId: string | null
  researchRunId: string | null
  terminalOutcome: DraftFactoryWakeTerminalOutcome | null
  terminalReason: string | null
  steps: DraftFactoryWakeDiagnosticStep[]
  transitions: DraftFactoryWakeAttemptTransitionRecord[]
  subscriberTelemetry: Array<{
    subscriberId: string
    status: DraftFactoryWakeSubscriberStatus
    durationMs: number | null
    skipReason: string | null
    errorMessage: string | null
  }>
  handlerTelemetry: {
    handlersDiscovered: string[]
    handlersInvoked: string[]
    handlersSkipped: string[]
    handlerFailures: Array<{ subscriberId: string; errorMessage?: string }>
  } | null
  evidence: {
    draftFactoryRowExists: boolean
    wakeReceiptExists: boolean
    durableFailureExists: boolean
    invariantSatisfied: boolean
  }
}

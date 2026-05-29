/** Bulk acquisition failure diagnostics — instrumentation only (no logic changes). */

import { logGrowthEngine } from "@/lib/growth/access"
import type {
  GrowthBulkAcquisitionLastErrorDiagnostics,
  GrowthBulkAcquisitionPhase,
  GrowthBulkAcquisitionRunState,
  GrowthBulkAcquisitionTickLogEntry,
} from "@/lib/growth/acquisition/acquisition-types"

export const GROWTH_BULK_ACQUISITION_DIAGNOSTICS_QA_MARKER =
  "growth-bulk-acquisition-diagnostics-v1" as const

export type AcquisitionDiagnosticContext = {
  runId?: string | null
  phase?: GrowthBulkAcquisitionPhase | null
  action?: string | null
  companyId?: string | null
  contactId?: string | null
}

let activeDiagnosticContext: AcquisitionDiagnosticContext | null = null

export function getAcquisitionDiagnosticContext(): AcquisitionDiagnosticContext | null {
  return activeDiagnosticContext
}

export async function withAcquisitionDiagnosticContext<T>(
  context: AcquisitionDiagnosticContext,
  fn: () => Promise<T>,
): Promise<T> {
  const prior = activeDiagnosticContext
  activeDiagnosticContext = { ...prior, ...context }
  try {
    return await fn()
  } finally {
    activeDiagnosticContext = prior
  }
}

function resolveDiagnosticFields(
  action: string,
  fields?: AcquisitionDiagnosticContext & Record<string, unknown>,
): Record<string, unknown> {
  const ctx = activeDiagnosticContext
  return {
    qa_marker: GROWTH_BULK_ACQUISITION_DIAGNOSTICS_QA_MARKER,
    action,
    runId: fields?.runId ?? ctx?.runId ?? null,
    phase: fields?.phase ?? ctx?.phase ?? null,
    companyId: fields?.companyId ?? ctx?.companyId ?? null,
    contactId: fields?.contactId ?? ctx?.contactId ?? null,
  }
}

/** Structured step log for Vercel (event: acquisition_diagnostic). */
export function logAcquisitionStep(
  action: string,
  fields?: AcquisitionDiagnosticContext & Record<string, unknown>,
): void {
  logGrowthEngine("acquisition_diagnostic", resolveDiagnosticFields(action, fields))
}

export function acquisitionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "tick_failed"
}

export function acquisitionErrorStack(error: unknown): string | null {
  return error instanceof Error ? error.stack ?? null : null
}

export function clearAcquisitionDiagnosticsFields(): Pick<
  GrowthBulkAcquisitionRunState,
  "last_error" | "last_error_stack" | "last_error_diagnostics"
> {
  return {
    last_error: null,
    last_error_stack: null,
    last_error_diagnostics: null,
  }
}

export function buildAcquisitionLastErrorDiagnostics(input: {
  error: unknown
  runId: string
  phase: GrowthBulkAcquisitionPhase
  action?: string | null
  companyId?: string | null
  contactId?: string | null
}): GrowthBulkAcquisitionLastErrorDiagnostics {
  const ctx = activeDiagnosticContext
  return {
    at: new Date().toISOString(),
    message: acquisitionErrorMessage(input.error),
    stack: acquisitionErrorStack(input.error),
    runId: input.runId,
    phase: input.phase,
    action: input.action ?? ctx?.action ?? null,
    companyId: input.companyId ?? ctx?.companyId ?? null,
    contactId: input.contactId ?? ctx?.contactId ?? null,
  }
}

export function buildFailedAcquisitionTickLogEntry(input: {
  phase: GrowthBulkAcquisitionPhase
  error: unknown
  duration_ms: number
  action?: string | null
}): GrowthBulkAcquisitionTickLogEntry {
  const message = acquisitionErrorMessage(input.error)
  const stack = acquisitionErrorStack(input.error)
  return {
    at: new Date().toISOString(),
    phase: input.phase,
    actions: [`error:${message}`],
    duration_ms: input.duration_ms,
    done: false,
    error_message: message,
    error_stack: stack,
    error_action: input.action ?? activeDiagnosticContext?.action ?? null,
  }
}

export function applyAcquisitionTickFailureToState(input: {
  state: GrowthBulkAcquisitionRunState
  error: unknown
  runId: string
  phase: GrowthBulkAcquisitionPhase
  action?: string | null
  companyId?: string | null
  contactId?: string | null
}): GrowthBulkAcquisitionRunState {
  const diagnostics = buildAcquisitionLastErrorDiagnostics(input)
  return {
    ...input.state,
    last_error: diagnostics.message,
    last_error_stack: diagnostics.stack,
    last_error_diagnostics: diagnostics,
  }
}

export function logAcquisitionTickFailure(input: {
  error: unknown
  runId: string
  phase: GrowthBulkAcquisitionPhase
  action?: string | null
  companyId?: string | null
  contactId?: string | null
}): void {
  const diagnostics = buildAcquisitionLastErrorDiagnostics(input)
  logGrowthEngine("acquisition_tick_failed", {
    qa_marker: GROWTH_BULK_ACQUISITION_DIAGNOSTICS_QA_MARKER,
    runId: diagnostics.runId,
    phase: diagnostics.phase,
    action: diagnostics.action,
    companyId: diagnostics.companyId,
    contactId: diagnostics.contactId,
    message: diagnostics.message,
    stack: diagnostics.stack,
  })
}

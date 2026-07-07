/** GE-AVA-LAUNCH-RUN-TRACE-1 — Ava launch run trace contract (client-safe). */

import { AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE } from "@/lib/growth/mission-center/growth-ava-launch-search-validation-trace"

export const GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER = "ge-ava-launch-run-trace-1-v1" as const

export const AVA_LAUNCH_STAGE = {
  audience_draft: "audience_draft",
  mission_lookup: "mission_lookup",
  bound_search_lookup: "bound_search_lookup",
  provider_request: "provider_request",
  datamoon_validation: "datamoon_validation",
  provider_launch: "provider_launch",
  bind_results: "bind_results",
  autonomy_start: "autonomy_start",
} as const

export type AvaLaunchStage = (typeof AVA_LAUNCH_STAGE)[keyof typeof AVA_LAUNCH_STAGE]

export type AvaLaunchRunFailureResult = {
  ok: false
  error: string
  status: number
  runId?: string | null
}

export type AvaLaunchFailureTraceRecord = {
  qa_marker: typeof GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER
  stage: AvaLaunchStage
  code: string
  message: string
  original: unknown
  validator: string
  cause?: unknown
  stack?: string
  payload?: unknown
}

export type AvaLaunchFailureTraceInput = {
  stage: AvaLaunchStage
  code: string
  message: string
  original?: unknown
  validator?: string
  cause?: unknown
  stack?: string
  payload?: unknown
}

export function buildAvaLaunchFailureTraceRecord(
  input: AvaLaunchFailureTraceInput,
): AvaLaunchFailureTraceRecord {
  return {
    qa_marker: GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER,
    stage: input.stage,
    code: input.code,
    message: input.message,
    original: input.original ?? null,
    validator: input.validator ?? AVA_LAUNCH_VALIDATOR_LAUNCH_SERVICE,
    cause: input.cause,
    stack: input.stack,
    payload: input.payload,
  }
}

export function resolveExceptionTrace(error: unknown): {
  message: string
  original: unknown
  cause?: unknown
  stack?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      original: error,
      cause: error.cause ?? error,
      stack: error.stack,
    }
  }
  return {
    message: typeof error === "string" ? error : "unknown_error",
    original: error,
    cause: error,
  }
}

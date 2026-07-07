/** GE-AVA-LAUNCH-RUN-TRACE-1 — Ava launch run service stage/failure trace logging (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildAvaLaunchFailureTraceRecord,
  GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER,
  type AvaLaunchFailureTraceInput,
  type AvaLaunchRunFailureResult,
  type AvaLaunchStage,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-trace-types"

export {
  AVA_LAUNCH_STAGE,
  GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER,
  buildAvaLaunchFailureTraceRecord,
  resolveExceptionTrace,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-trace-types"
export type {
  AvaLaunchFailureTraceInput,
  AvaLaunchFailureTraceRecord,
  AvaLaunchRunFailureResult,
  AvaLaunchStage,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-trace-types"

export function logAvaLaunchStage(stage: AvaLaunchStage, payload?: Record<string, unknown>): void {
  console.log(`AVA_LAUNCH_STAGE ${stage}`, payload ?? {})
  logGrowthEngine("ava_launch_stage", {
    qa_marker: GROWTH_AVA_LAUNCH_RUN_TRACE_1_QA_MARKER,
    stage,
    ...(payload ?? {}),
  })
}

export function logAvaLaunchFailureReturn(input: AvaLaunchFailureTraceInput): void {
  const record = buildAvaLaunchFailureTraceRecord(input)
  console.warn("AVA_LAUNCH_FAILURE_RETURN", JSON.stringify(record, null, 2))
  logGrowthEngine("ava_launch_run_failure", record)
}

export function returnAvaLaunchFailure(
  failure: AvaLaunchRunFailureResult,
  trace: AvaLaunchFailureTraceInput,
): AvaLaunchRunFailureResult {
  logAvaLaunchFailureReturn({
    ...trace,
    code: trace.code || failure.error,
    message: trace.message || failure.error,
  })
  return failure
}

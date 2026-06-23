import "server-only"

import { NextResponse } from "next/server"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildWarmupExecutorErrorBody,
  buildWarmupExecutorSuccessBody,
  GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
} from "@/lib/growth/warmup/warmup-executor-api-response"
import type { GrowthWarmupExecutorRunResult } from "@/lib/growth/warmup/warmup-executor-types"

export function warmupExecutorJsonSuccess(
  result: GrowthWarmupExecutorRunResult,
  options?: { clientBuildMarker?: string | null },
): NextResponse {
  return NextResponse.json(buildWarmupExecutorSuccessBody(result, options), { status: 200 })
}

export function warmupExecutorJsonError(input: {
  error: string
  code: string
  status?: number
  details?: Record<string, unknown>
}): NextResponse {
  logGrowthEngine("warmup_executor_api_error", {
    qa_marker: GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
    code: input.code,
    error: input.error,
    details: input.details ?? {},
  })
  return NextResponse.json(buildWarmupExecutorErrorBody(input), {
    status: input.status ?? 500,
  })
}

export function logWarmupExecutorFailure(
  event: string,
  details: Record<string, unknown>,
): void {
  logGrowthEngine(event, {
    qa_marker: GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
    ...details,
  })
}

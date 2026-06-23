/** GS-GROWTH-WARMUP-EXECUTOR-1C — API response helpers (client-safe). */

import type { GrowthWarmupExecutorRunResult } from "@/lib/growth/warmup/warmup-executor-types"
import { GROWTH_WARMUP_EXECUTOR_QA_MARKER } from "@/lib/growth/warmup/warmup-executor-types"

export const GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER = "growth-warmup-executor-1c-v1" as const

export type WarmupExecutorApiSuccessBody = {
  ok: true
  result: GrowthWarmupExecutorRunResult
  run: {
    runId: string | null
    runKind: GrowthWarmupExecutorRunResult["runKind"]
    status: GrowthWarmupExecutorRunResult["status"]
    idempotencyKey: string
    profilesScanned: number
    sendsAttempted: number
    sendsSucceeded: number
    sendsFailed: number
    sendsSkipped: number
  }
  summary: GrowthWarmupExecutorRunResult["runSummary"] | null
  profileResults: GrowthWarmupExecutorRunResult["senderResults"]
  qa_marker: typeof GROWTH_WARMUP_EXECUTOR_QA_MARKER
}

export type WarmupExecutorApiErrorBody = {
  ok: false
  error: string
  code: string
  message?: string
  details?: Record<string, unknown>
  qa_marker: typeof GROWTH_WARMUP_EXECUTOR_QA_MARKER
}

export function buildWarmupExecutorSuccessBody(
  result: GrowthWarmupExecutorRunResult,
): WarmupExecutorApiSuccessBody {
  return {
    ok: true,
    result,
    run: {
      runId: result.runId,
      runKind: result.runKind,
      status: result.status,
      idempotencyKey: result.idempotencyKey,
      profilesScanned: result.profilesScanned,
      sendsAttempted: result.sendsAttempted,
      sendsSucceeded: result.sendsSucceeded,
      sendsFailed: result.sendsFailed,
      sendsSkipped: result.sendsSkipped,
    },
    summary: result.runSummary ?? null,
    profileResults: result.senderResults,
    qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  }
}

export function buildWarmupExecutorErrorBody(input: {
  error: string
  code: string
  details?: Record<string, unknown>
}): WarmupExecutorApiErrorBody {
  return {
    ok: false,
    error: input.error,
    message: input.error,
    code: input.code,
    details: input.details,
    qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  }
}

export type WarmupExecutorClientParseResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error: string }

export function parseWarmupExecutorClientResponse<T extends { ok?: boolean; error?: string; message?: string }>(
  rawText: string,
  status: number,
): WarmupExecutorClientParseResult<T> {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      ok: false,
      status,
      error: "Empty response from warmup executor.",
    }
  }

  try {
    const data = JSON.parse(trimmed) as T
    return { ok: true, data, status }
  } catch {
    const preview = trimmed.replace(/\s+/g, " ").slice(0, 300)
    return {
      ok: false,
      status,
      error: `Invalid JSON from warmup executor: ${preview}`,
    }
  }
}

export async function fetchWarmupExecutorJson<T extends { ok?: boolean; error?: string; message?: string }>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<WarmupExecutorClientParseResult<T>> {
  try {
    const response = await fetch(input, init)
    const rawText = await response.text()
    const parsed = parseWarmupExecutorClientResponse<T>(rawText, response.status)
    if (!parsed.ok) return parsed
    if (!response.ok || parsed.data.ok === false) {
      return {
        ok: false,
        status: response.status,
        error: parsed.data.error ?? parsed.data.message ?? "Warmup executor request failed.",
      }
    }
    return parsed
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Warmup executor network error.",
    }
  }
}

/** GE-AVA-DATAMOON-POLL-COMPLETION-1 — Bounded Datamoon audience poll wait (client-safe). */

import type { DatamoonAudienceImportRunStatus } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_AVA_DATAMOON_POLL_COMPLETION_1_QA_MARKER =
  "ge-ava-datamoon-poll-completion-1-v1" as const

export const DATAMOON_AUDIENCE_POLL_WAIT_INTERVAL_MS = 2_500 as const
export const DATAMOON_AUDIENCE_POLL_WAIT_MAX_MS = 25_000 as const

export const GROWTH_DATAMOON_POLL_PENDING_ERROR = "datamoon_poll_pending" as const

export const GROWTH_DATAMOON_POLL_PENDING_MESSAGE =
  "Audience is still building. Try again shortly." as const

export type DatamoonAudiencePollWaitPhase = "ready" | "building" | "other"

export function isDatamoonAudienceImportRunImportReady(status: DatamoonAudienceImportRunStatus | string): boolean {
  return status === "completed" || status === "imported_partial"
}

export function classifyDatamoonAudiencePollRunStatus(
  status: DatamoonAudienceImportRunStatus | string,
): DatamoonAudiencePollWaitPhase {
  if (isDatamoonAudienceImportRunImportReady(status)) return "ready"
  if (status === "building" || status === "pending_build") return "building"
  return "other"
}

export function shouldContinueDatamoonAudiencePollWait(input: {
  elapsedMs: number
  maxWaitMs: number
  runStatus: DatamoonAudienceImportRunStatus | string
}): boolean {
  if (classifyDatamoonAudiencePollRunStatus(input.runStatus) === "ready") return false
  if (classifyDatamoonAudiencePollRunStatus(input.runStatus) === "building") {
    return input.elapsedMs < input.maxWaitMs
  }
  return false
}

export function resolveDatamoonAudiencePollWaitTimeoutError(input: {
  runStatus: DatamoonAudienceImportRunStatus | string
}):
  | { error: typeof GROWTH_DATAMOON_POLL_PENDING_ERROR; message: typeof GROWTH_DATAMOON_POLL_PENDING_MESSAGE }
  | { error: "datamoon_poll_incomplete"; message: string } {
  if (classifyDatamoonAudiencePollRunStatus(input.runStatus) === "building") {
    return {
      error: GROWTH_DATAMOON_POLL_PENDING_ERROR,
      message: GROWTH_DATAMOON_POLL_PENDING_MESSAGE,
    }
  }
  return {
    error: "datamoon_poll_incomplete",
    message: `Datamoon audience run is not ready for import (status: ${input.runStatus}).`,
  }
}

export async function sleepForDatamoonAudiencePollWait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** GE-AIOS-RUNTIME-1 — Shared API responses for mission route guards (server-only). */

import "server-only"

import { NextResponse } from "next/server"
import {
  GROWTH_AI_OS_MISSION_ID_INVALID_ERROR,
  aiOsMissionIdValidationMessage,
  resolveAiOsMissionIdParam,
  type AiOsMissionIdValidationResult,
} from "@/lib/growth/aios/ai-os-mission-route-params"

export function resolveAiOsMissionIdFromRouteParam(
  raw: string | null | undefined,
): AiOsMissionIdValidationResult {
  return resolveAiOsMissionIdParam(raw)
}

export function aiOsInvalidMissionIdResponse(
  input: Extract<AiOsMissionIdValidationResult, { ok: false }>,
  qaMarker: string,
  messagePrefix: string,
) {
  return NextResponse.json(
    {
      ok: false,
      qaMarker,
      error: GROWTH_AI_OS_MISSION_ID_INVALID_ERROR,
      reason: input.reason,
      message: `${messagePrefix} ${aiOsMissionIdValidationMessage(input.reason)}`.trim(),
    },
    { status: 400 },
  )
}

export function aiOsPlanningReviewErrorStatus(detail: string): number {
  if (detail === GROWTH_AI_OS_MISSION_ID_INVALID_ERROR) return 400
  if (detail === "growth_objective_not_found") return 404
  if (detail === "planning_review_id_required") return 400
  return 500
}

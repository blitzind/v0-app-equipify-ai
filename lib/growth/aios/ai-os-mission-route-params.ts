/** GE-AIOS-RUNTIME-1 — Mission route param guards (client-safe). */

export const GROWTH_AIOS_RUNTIME_1_PHASE = "GE-AIOS-RUNTIME-1" as const

export const GROWTH_AI_OS_MISSION_ID_INVALID_ERROR = "growth_ai_os_mission_id_invalid" as const

/** Safe fallback when no real mission id is available for AI OS planning links. */
export const GROWTH_AI_OS_SAFE_INDEX_HREF = "/growth/objectives" as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ROUTE_PARAM_PLACEHOLDER_RE = /^\[[a-zA-Z0-9_]+\]$/

export type AiOsMissionIdValidationFailureReason = "missing" | "placeholder" | "invalid"

export type AiOsMissionIdValidationResult =
  | { ok: true; missionId: string }
  | { ok: false; reason: AiOsMissionIdValidationFailureReason; error: typeof GROWTH_AI_OS_MISSION_ID_INVALID_ERROR }

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value)
}

export function isAiOsRouteParamPlaceholder(value: string): boolean {
  return ROUTE_PARAM_PLACEHOLDER_RE.test(value.trim())
}

export function resolveAiOsMissionIdParam(
  raw: string | null | undefined,
): AiOsMissionIdValidationResult {
  const missionId = raw?.trim() ?? ""
  if (!missionId) {
    return { ok: false, reason: "missing", error: GROWTH_AI_OS_MISSION_ID_INVALID_ERROR }
  }
  if (isAiOsRouteParamPlaceholder(missionId)) {
    return { ok: false, reason: "placeholder", error: GROWTH_AI_OS_MISSION_ID_INVALID_ERROR }
  }
  if (!isUuidLike(missionId)) {
    return { ok: false, reason: "invalid", error: GROWTH_AI_OS_MISSION_ID_INVALID_ERROR }
  }
  return { ok: true, missionId }
}

export function buildAiOsMissionPlanningHref(missionId: string | null | undefined): string | null {
  const resolved = resolveAiOsMissionIdParam(missionId)
  if (!resolved.ok) return null
  return `/growth/ai-os/missions/${resolved.missionId}/planning`
}

export function aiOsMissionIdValidationMessage(
  reason: AiOsMissionIdValidationFailureReason,
): string {
  switch (reason) {
    case "missing":
      return "Mission id is required to open Mission Planning Review."
    case "placeholder":
      return "This URL uses a route placeholder instead of a real mission id. Open planning review from an objective or pilot observation."
    case "invalid":
      return "Mission id must be a valid UUID."
  }
}

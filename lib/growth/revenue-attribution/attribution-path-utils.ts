/** Client-safe attribution path helpers (Phase 6.32B-1 / 6.33A). */

import { buildStoredTouchCreditsByModel } from "@/lib/growth/revenue-attribution/attribution-credit-model"
import type {
  GrowthAttributionPathScope,
  GrowthAttributionTouch,
  GrowthAttributionTouchType,
} from "@/lib/growth/revenue-attribution/attribution-touch-types"

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))]
}

function buildPathSummary(touches: GrowthAttributionTouch[]): Record<string, unknown> {
  const byType: Partial<Record<GrowthAttributionTouchType, number>> = {}
  for (const touch of touches) {
    byType[touch.touchType] = (byType[touch.touchType] ?? 0) + 1
  }
  const anchorAt = touches[touches.length - 1]?.touchedAt ?? new Date().toISOString()
  return {
    touch_types: byType,
    first_touched_at: touches[0]?.touchedAt ?? null,
    last_touched_at: anchorAt,
    sequence_ids: uniqueStrings(touches.map((t) => t.sequenceId)),
    sender_account_ids: uniqueStrings(touches.map((t) => t.senderAccountId)),
    rep_user_ids: uniqueStrings(touches.map((t) => t.repUserId)),
    touch_credits_by_model: buildStoredTouchCreditsByModel(touches, anchorAt),
  }
}

export function buildAttributionPathFromTouches(
  touches: GrowthAttributionTouch[],
  input: { leadId: string; opportunityId: string | null; pathScope: GrowthAttributionPathScope },
): {
  leadId: string
  opportunityId: string | null
  pathScope: GrowthAttributionPathScope
  touchIds: string[]
  firstTouchId: string | null
  lastTouchId: string | null
  firstTouchType: GrowthAttributionTouchType | null
  lastTouchType: GrowthAttributionTouchType | null
  touchCount: number
  channels: string[]
  attributionSources: string[]
  pathSummary: Record<string, unknown>
  rebuiltAt: string
} {
  const ordered = [...touches].sort((a, b) => a.touchedAt.localeCompare(b.touchedAt))
  const first = ordered[0] ?? null
  const last = ordered[ordered.length - 1] ?? null

  return {
    leadId: input.leadId,
    opportunityId: input.pathScope === "opportunity" ? input.opportunityId : null,
    pathScope: input.pathScope,
    touchIds: ordered.map((t) => t.id),
    firstTouchId: first?.id ?? null,
    lastTouchId: last?.id ?? null,
    firstTouchType: first?.touchType ?? null,
    lastTouchType: last?.touchType ?? null,
    touchCount: ordered.length,
    channels: uniqueStrings(ordered.map((t) => t.channel)),
    attributionSources: uniqueStrings(ordered.map((t) => t.attributionSource)),
    pathSummary: buildPathSummary(ordered),
    rebuiltAt: new Date().toISOString(),
  }
}

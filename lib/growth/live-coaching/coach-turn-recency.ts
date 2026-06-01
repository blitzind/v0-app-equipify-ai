/** Compare conversation coach turns for display merge (client-safe). */

import type { ConversationCoachTurn } from "@/lib/growth/live-coaching/types"

export function coachTurnUpdatedAtMs(coach: ConversationCoachTurn | null | undefined): number {
  if (!coach?.updatedAt) return 0
  const parsed = Date.parse(coach.updatedAt)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isBootstrapCoachTurn(coach: ConversationCoachTurn | null | undefined): boolean {
  if (!coach) return false
  return coach.source === "bootstrap" || coach.triggeredBySequenceNumber == null
}

export function coachTurnSequence(coach: ConversationCoachTurn | null | undefined): number {
  if (!coach || coach.triggeredBySequenceNumber == null) return -1
  return coach.triggeredBySequenceNumber
}

/** Positive when left should win over right. */
export function compareCoachTurnRecency(
  left: ConversationCoachTurn,
  right: ConversationCoachTurn,
): number {
  const leftBootstrap = isBootstrapCoachTurn(left)
  const rightBootstrap = isBootstrapCoachTurn(right)
  if (!leftBootstrap && rightBootstrap) return 1
  if (leftBootstrap && !rightBootstrap) return -1

  const sequenceDelta = coachTurnSequence(left) - coachTurnSequence(right)
  if (sequenceDelta !== 0) return sequenceDelta

  return coachTurnUpdatedAtMs(left) - coachTurnUpdatedAtMs(right)
}

export function pickPreferredCoachTurn(
  ...candidates: Array<ConversationCoachTurn | null | undefined>
): ConversationCoachTurn | null {
  let best: ConversationCoachTurn | null = null
  for (const candidate of candidates) {
    if (!candidate) continue
    if (!best || compareCoachTurnRecency(candidate, best) > 0) {
      best = candidate
    }
  }
  return best
}

import "server-only"

import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"

/**
 * Milestone A stub — Command Center will consume ranked signals in a later milestone.
 */
export function buildCommandCenterSignalFeed(
  signals: GrowthSignalRow[],
): { title: string; items: Array<{ id: string; label: string; score: number }> } {
  return {
    title: "Intent signals (foundation preview)",
    items: signals.slice(0, 5).map((signal) => ({
      id: signal.id,
      label: signal.evidence_summary || signal.company_name || signal.signal_type,
      score: signal.signal_score,
    })),
  }
}

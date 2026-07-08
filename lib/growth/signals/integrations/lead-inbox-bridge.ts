import "server-only"

import type { GrowthSignalDetailRow } from "@/lib/growth/signals/signal-types"

/**
 * Milestone A stub — explicit operator action required before Revenue Queue handoff.
 */
export async function buildLeadInboxHandoffFromSignal(
  _signal: GrowthSignalDetailRow,
): Promise<{ ok: false; reason: string }> {
  return {
    ok: false,
    reason: "Revenue Queue bridge is not enabled in Milestone A. Use manual review first.",
  }
}

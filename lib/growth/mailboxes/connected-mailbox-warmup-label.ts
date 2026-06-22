/**
 * Growth Engine — Connected mailbox warmup display labels (client-safe).
 */

import type { GrowthConnectedMailboxRow } from "@/lib/growth/mailboxes/connected-mailboxes-dashboard-types"
import {
  warmupProfileStatusAllowsStart,
  warmupProfileStatusIsActive,
} from "@/lib/growth/warmup/warmup-startup-actions"

export type GrowthConnectedMailboxWarmupDisplay = {
  label:
    | "Not Started"
    | "Ready to Generate"
    | "Warming"
    | "Active"
    | "Paused"
    | "Throttled"
    | "Disabled"
    | "Unknown"
  tone: "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"
  canStart: boolean
}

export function resolveConnectedMailboxWarmupDisplay(
  row: Pick<GrowthConnectedMailboxRow, "warmupStatus" | "warmupProfileId" | "senderStatus">,
): GrowthConnectedMailboxWarmupDisplay {
  const raw = row.warmupStatus?.trim().toLowerCase() ?? ""

  if (!raw && !row.warmupProfileId) {
    return { label: "Not Started", tone: "neutral", canStart: true }
  }

  switch (raw) {
    case "new":
      return { label: "Ready to Generate", tone: "neutral", canStart: true }
    case "warming":
      return { label: "Warming", tone: "medium", canStart: false }
    case "active":
      return { label: "Active", tone: "healthy", canStart: false }
    case "paused":
      return { label: "Paused", tone: "attention", canStart: false }
    case "throttled":
      return { label: "Throttled", tone: "attention", canStart: false }
    case "disabled":
      return { label: "Disabled", tone: "blocked", canStart: false }
    default:
      if (raw && warmupProfileStatusIsActive(raw)) {
        return { label: "Active", tone: "healthy", canStart: false }
      }
      if (raw && warmupProfileStatusAllowsStart(raw)) {
        return { label: "Ready to Generate", tone: "neutral", canStart: true }
      }
      if (raw) return { label: "Unknown", tone: "neutral", canStart: false }
      return { label: "Not Started", tone: "neutral", canStart: true }
  }
}

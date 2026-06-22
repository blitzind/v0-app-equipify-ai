/**
 * Growth Engine — Connected mailbox warmup display labels (client-safe).
 */

import type { GrowthConnectedMailboxRow } from "@/lib/growth/mailboxes/connected-mailboxes-dashboard-types"

export type GrowthConnectedMailboxWarmupDisplay = {
  label: "Not Started" | "Warming" | "Active" | "Paused" | "Throttled" | "Disabled" | "Unknown"
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
      return { label: "Not Started", tone: "neutral", canStart: true }
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
      if (raw) return { label: "Unknown", tone: "neutral", canStart: false }
      return { label: "Not Started", tone: "neutral", canStart: true }
  }
}

/** Infer stable dedupe keys for legacy live guidance rows missing dedupe_key. Client-safe. */

import type { GrowthLiveGuidanceEvent } from "@/lib/growth/live-guidance/live-guidance-types"

export function inferGuidanceDedupeKey(
  event: Pick<GrowthLiveGuidanceEvent, "eventType" | "title" | "dedupeKey">,
): string {
  if (event.dedupeKey?.trim()) return event.dedupeKey.trim()

  const title = event.title.trim().toLowerCase()
  if (title.includes("decision maker")) return "discovery_gap_guidance:dm"
  if (title.includes("timeline")) return "discovery_gap_guidance:timeline"
  if (title.includes("budget")) return "objection_guidance:budget"
  if (title.includes("pricing")) return "pricing_pressure"
  if (title.includes("competitor")) return "competitor_response"
  if (title.includes("implementation") || title.includes("migration")) {
    return "objection_guidance:implementation"
  }
  if (title.includes("demo")) return "meeting_lock_prompt:demo"
  if (title.includes("high intent")) return "buying_signal_detected"
  if (title.includes("committee") || title.includes("buying committee")) {
    return "buying_signal_detected:dm_confirmed"
  }

  return `${event.eventType}:${title.replace(/\s+/g, "_").slice(0, 48)}`
}

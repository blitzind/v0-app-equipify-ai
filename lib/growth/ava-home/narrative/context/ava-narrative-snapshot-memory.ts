/** GE-AIOS-10A — Client-side narrative snapshot for since-yesterday deltas (no schema). */

import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"

export const AVA_NARRATIVE_SNAPSHOT_STORAGE_KEY = "equipify:ava-narrative:snapshot/v1" as const

export function readAvaNarrativeMetricsSnapshot(): AvaNarrativeMetricsSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(AVA_NARRATIVE_SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AvaNarrativeMetricsSnapshot
  } catch {
    return null
  }
}

export function writeAvaNarrativeMetricsSnapshot(snapshot: AvaNarrativeMetricsSnapshot): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AVA_NARRATIVE_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore
  }
}

export function buildSinceYesterdayLines(
  current: AvaNarrativeMetricsSnapshot,
  previous: AvaNarrativeMetricsSnapshot | null,
): string[] {
  if (!previous) return []

  const lines: string[] = []
  const researchedDelta = current.researched - previous.researched
  const qualifiedDelta = current.qualified - previous.qualified
  const readyDelta = current.readyForReview - previous.readyForReview
  const repliesDelta = current.repliesToday - previous.repliesToday
  const meetingsDelta = current.meetingsToday - previous.meetingsToday
  const outreachDelta = current.readyForReview - previous.readyForReview

  if (researchedDelta > 0) {
    lines.push(
      `I researched ${researchedDelta} additional ${pluralize(researchedDelta, "company", "companies")}.`,
    )
  }
  if (qualifiedDelta > 0) {
    lines.push(`I qualified ${qualifiedDelta} more ${pluralize(qualifiedDelta, "company", "companies")}.`)
  }
  if (readyDelta > 0) {
    lines.push(`I found ${readyDelta} more strong ${pluralize(readyDelta, "opportunity", "opportunities")}.`)
  }
  if (repliesDelta > 0) {
    lines.push(`I received ${repliesDelta} ${pluralize(repliesDelta, "reply", "replies")}.`)
  }
  if (meetingsDelta > 0) {
    lines.push(`I booked ${meetingsDelta} ${pluralize(meetingsDelta, "meeting", "meetings")}.`)
  }
  if (outreachDelta > 0 && readyDelta === 0) {
    lines.push(`I prepared ${outreachDelta} outreach ${pluralize(outreachDelta, "draft", "drafts")}.`)
  }

  return lines.slice(0, 5)
}

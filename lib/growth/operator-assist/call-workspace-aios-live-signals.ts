/** Derive live transcript signals for AI OS reasoning (client-safe). */

import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { RelationshipAssessmentContextSignals } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"

export function resolveLatestProspectSequenceNumber(input: {
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  voiceTranscript: VoiceCallTranscriptSnapshot | null
}): number | null {
  const fromTranscript = input.voiceTranscript?.segments
    ?.filter((segment) => segment.speakerType === "customer" || segment.speakerType === "prospect")
    .map((segment) => segment.sequenceNumber)
    .at(-1)
  if (fromTranscript != null) return fromTranscript

  return input.liveSnapshot?.buyingSignals.at(-1)?.sequenceNumber ?? null
}

export function buildLiveTranscriptText(input: {
  voiceTranscript: VoiceCallTranscriptSnapshot | null
}): string {
  return (
    input.voiceTranscript?.segments
      ?.map((segment) => `${segment.speakerType}: ${segment.text}`)
      .join("\n")
      .trim() ?? ""
  )
}

export function mergeLiveSnapshotIntoRelationshipContext(input: {
  base: RelationshipAssessmentContextSignals
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  transcriptText: string
}): RelationshipAssessmentContextSignals {
  const liveObjections =
    input.liveSnapshot?.objections.map((row) => row.label ?? row.key).filter(Boolean) ?? []
  const liveBuyingSignals =
    input.liveSnapshot?.buyingSignals.map((row) => row.label ?? row.key).filter(Boolean) ?? []
  const liveRisks = input.liveSnapshot?.riskFlags ?? []

  const buyingIntent =
    liveBuyingSignals.length > 0
      ? liveBuyingSignals.slice(0, 2).join("; ")
      : input.base.buyingIntent

  const competitorPressure =
    (input.liveSnapshot?.competitorGuidance?.length ?? 0) > 0
      ? `Competitor mentioned during live call: ${input.liveSnapshot!.competitorGuidance[0]!.competitor}`
      : input.base.competitorPressure

  return {
    ...input.base,
    objectionSummaries: uniqueLines([...input.base.objectionSummaries, ...liveObjections], 8),
    buyingIntent,
    competitorPressure,
    priorReplySummaries: uniqueLines(
      [
        ...input.base.priorReplySummaries,
        input.transcriptText
          ? `Live call transcript (${input.transcriptText.split("\n").length} turns)`
          : null,
        liveRisks.length ? `Live risks: ${liveRisks.join(", ")}` : null,
      ],
      6,
    ),
  }
}

export function deriveLiveAdaptiveEventsFromSnapshot(
  liveSnapshot: GrowthRealtimeLiveSnapshot | null,
): AdaptiveProspectEvent[] {
  if (!liveSnapshot) return []

  const occurredAt = liveSnapshot.computedAt
  const events: AdaptiveProspectEvent[] = []

  for (const objection of liveSnapshot.objections) {
    events.push({
      type: "objection",
      category: "negative",
      occurredAt,
      summary: objection.label ?? objection.key,
      detail: objection.excerpt ?? null,
    })
  }

  for (const signal of liveSnapshot.buyingSignals) {
    if (signal.key === "decision_maker_confirmed" || signal.key === "champion_identified") {
      events.push({
        type: "champion_identified",
        category: "positive",
        occurredAt,
        summary: signal.label ?? signal.key,
      })
      continue
    }
    if (signal.key.includes("meeting") || signal.key.includes("book")) {
      events.push({
        type: "meeting_booked",
        category: "positive",
        occurredAt,
        summary: signal.label ?? signal.key,
      })
      continue
    }
    if (signal.key.includes("pricing")) {
      events.push({
        type: "pricing_discussion",
        category: "positive",
        occurredAt,
        summary: signal.label ?? signal.key,
      })
      continue
    }
    if (signal.key.includes("committee") || signal.key.includes("stakeholder")) {
      events.push({
        type: "buying_committee_expansion",
        category: "positive",
        occurredAt,
        summary: signal.label ?? signal.key,
      })
    }
  }

  return events
}

export function liveAnsweredDiscoveryThemes(liveSnapshot: GrowthRealtimeLiveSnapshot | null): string[] {
  return liveSnapshot?.discovery.covered.map((area) => area.replace(/_/g, " ")) ?? []
}

function uniqueLines(lines: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

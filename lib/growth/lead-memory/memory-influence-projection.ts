/** Client-safe projection of lead memory profile views into decision context (Sprint 3). */

import {
  sanitizeMemoryEvidenceSnippet,
  type GrowthLeadMemoryInfluenceContext,
  type GrowthLeadMemoryProfileView,
} from "@/lib/growth/lead-memory/memory-types"

const COMMITMENT_CATEGORIES = new Set([
  "meeting_signal",
  "timeline_signal",
  "budget_signal",
  "buying_signal",
])

const AVOID_REPEAT_CATEGORIES = new Set([
  "communication_preference",
  "timeline_signal",
  "budget_signal",
  "meeting_signal",
])

function snippet(value: string | null | undefined, max = 200): string {
  if (!value?.trim()) return ""
  return sanitizeMemoryEvidenceSnippet(value, max)
}

export function projectLeadMemoryInfluenceContext(
  view: GrowthLeadMemoryProfileView | null | undefined,
): GrowthLeadMemoryInfluenceContext {
  if (!view?.profile && !view?.relationshipContext && (view?.events.length ?? 0) === 0) {
    return {
      available: false,
      memoryCoverageScore: null,
      relationshipStage: null,
      relationshipSummary: null,
      engagementTrend: null,
      progressionScore: null,
      topObjections: [],
      topPreferences: [],
      priorInteractionSummaries: [],
      commitmentSummaries: [],
      riskFlags: [],
      avoidRepeating: [],
      committeeContext: [],
      unresolvedObjectionCount: 0,
      unresolvedHighSeverityObjectionCount: 0,
    }
  }

  const unresolvedObjections = (view?.objections ?? []).filter((entry) => !entry.resolved)
  const unresolvedHighSeverityObjectionCount = unresolvedObjections.filter(
    (entry) => entry.severity === "high" || entry.severity === "critical",
  ).length

  const topObjections = unresolvedObjections
    .slice(0, 5)
    .map((entry) => snippet(`${entry.objectionLabel}: ${entry.evidenceSnippet}`, 160))
    .filter(Boolean)

  const topPreferences = (view?.preferences ?? [])
    .slice(0, 5)
    .map((entry) => snippet(`${entry.preferenceType.replace(/_/g, " ")}: ${entry.preferenceValue}`, 160))
    .filter(Boolean)

  const priorInteractionSummaries = (view?.events ?? [])
    .slice(0, 8)
    .map((event) => snippet(`${event.title}: ${event.evidenceSnippet}`, 140))
    .filter(Boolean)

  const commitmentSummaries = (view?.events ?? [])
    .filter((event) => COMMITMENT_CATEGORIES.has(event.memoryCategory))
    .slice(0, 5)
    .map((event) => snippet(`${event.title}: ${event.evidenceSnippet}`, 140))
    .filter(Boolean)

  const avoidRepeating = [
    ...topPreferences,
    ...(view?.events ?? [])
      .filter((event) => AVOID_REPEAT_CATEGORIES.has(event.memoryCategory))
      .slice(0, 5)
      .map((event) => snippet(event.evidenceSnippet, 120)),
  ].filter(Boolean)

  const committeeContext = (view?.committeeMembers ?? [])
    .slice(0, 4)
    .map((entry) => snippet(`${entry.memberLabel} (${entry.roleHint}): ${entry.evidenceSnippet}`, 140))
    .filter(Boolean)

  const riskFlags = (view?.relationshipContext?.riskFlags ?? []).map((entry) => snippet(entry, 120)).filter(Boolean)

  return {
    available: true,
    memoryCoverageScore: view?.profile?.memoryCoverageScore ?? null,
    relationshipStage: view?.profile?.relationshipStage ?? view?.relationshipContext?.relationshipStage ?? null,
    relationshipSummary: snippet(view?.profile?.summary ?? view?.summarySnapshots[0]?.summary ?? null, 400) || null,
    engagementTrend: view?.relationshipContext?.engagementTrend ?? null,
    progressionScore: view?.relationshipContext?.progressionScore ?? null,
    topObjections,
    topPreferences,
    priorInteractionSummaries,
    commitmentSummaries,
    riskFlags,
    avoidRepeating: [...new Set(avoidRepeating)],
    committeeContext,
    unresolvedObjectionCount: unresolvedObjections.length,
    unresolvedHighSeverityObjectionCount,
  }
}

export function mergeMemoryObjectionSummaries(
  existing: string[],
  memory: GrowthLeadMemoryInfluenceContext,
): string[] {
  const merged = [...memory.topObjections, ...existing]
  const seen = new Set<string>()
  return merged.filter((entry) => {
    const key = entry.toLowerCase().slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function memoryInfluencePromptBlock(memory: GrowthLeadMemoryInfluenceContext): Record<string, unknown> {
  if (!memory.available) return { relationshipMemoryAvailable: false }
  return {
    relationshipMemoryAvailable: true,
    memoryCoverageScore: memory.memoryCoverageScore,
    relationshipStage: memory.relationshipStage,
    relationshipSummary: memory.relationshipSummary,
    engagementTrend: memory.engagementTrend,
    topObjections: memory.topObjections,
    topPreferences: memory.topPreferences,
    priorInteractions: memory.priorInteractionSummaries,
    commitments: memory.commitmentSummaries,
    riskFlags: memory.riskFlags,
    avoidRepeatingTopics: memory.avoidRepeating,
    committeeContext: memory.committeeContext,
  }
}

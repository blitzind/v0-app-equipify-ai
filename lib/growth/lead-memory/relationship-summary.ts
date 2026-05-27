import type {
  GrowthLeadMemoryProfile,
  GrowthLeadObjectionMemory,
  GrowthLeadPreferenceMemory,
  GrowthCommitteeRelationshipContext,
  GrowthRelationshipStage,
} from "@/lib/growth/lead-memory/memory-types"

export function buildRelationshipSummary(input: {
  leadLabel: string
  relationshipStage: GrowthRelationshipStage
  memoryCoverageScore: number
  topObjections: GrowthLeadObjectionMemory[]
  topPreferences: GrowthLeadPreferenceMemory[]
  committeeMembers: GrowthCommitteeRelationshipContext[]
  eventCount: number
}): string {
  const parts: string[] = []
  parts.push(`${input.leadLabel} is in the ${input.relationshipStage.replace(/_/g, " ")} stage.`)
  parts.push(`Memory coverage ${input.memoryCoverageScore}% across ${input.eventCount} evidence-backed events.`)
  if (input.topObjections.length > 0) {
    parts.push(`Top objection: ${input.topObjections[0]?.objectionLabel ?? "none"}.`)
  }
  if (input.topPreferences.length > 0) {
    parts.push(`Preference: ${input.topPreferences[0]?.preferenceValue.replace(/_/g, " ") ?? "none"}.`)
  }
  if (input.committeeMembers.length > 0) {
    parts.push(`${input.committeeMembers.length} committee context record(s) on file.`)
  }
  return parts.join(" ")
}

export function buildSummaryHighlights<T extends { evidenceSnippet: string }>(items: T[], limit = 3): string[] {
  return items.slice(0, limit).map((item) => item.evidenceSnippet.slice(0, 120))
}

export function profileToSnapshotInput(profile: GrowthLeadMemoryProfile): {
  relationshipStage: GrowthRelationshipStage
  summary: string
  memoryCoverageScore: number
} {
  return {
    relationshipStage: profile.relationshipStage,
    summary: profile.summary,
    memoryCoverageScore: profile.memoryCoverageScore,
  }
}

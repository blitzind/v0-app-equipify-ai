/** GE-AIOS-12A — Organizational operating preferences (deterministic). */

import type { AvaNarrativeContext } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type { AvaMemoryEvent, AvaOrganizationalPreference } from "@/lib/growth/memory/types"
import { inferIndustry } from "@/lib/growth/memory/events/record-memory-event"

export type BuildOrganizationPreferencesInput = {
  generatedAt: string
  workspaceSummary: Pick<GrowthHomeWorkspaceSummaryPayload, "avaConsole">
  narrativeContext: AvaNarrativeContext
  events: AvaMemoryEvent[]
  existingPreferences?: AvaOrganizationalPreference[]
}

function preferenceFromEvents(events: AvaMemoryEvent[], generatedAt: string): AvaOrganizationalPreference[] {
  const medicalCount = events.filter(
    (row) => inferIndustry(String(row.metadata.companyName ?? row.summary)) === "medical_equipment",
  ).length
  const hvacCount = events.filter(
    (row) => inferIndustry(String(row.metadata.companyName ?? row.summary)) === "hvac",
  ).length

  const derived: AvaOrganizationalPreference[] = []
  if (medicalCount >= 2 && medicalCount > hvacCount) {
    derived.push({
      id: "pref:medical-learned",
      key: "industry_focus",
      statement: "Medical equipment companies are our primary focus.",
      importance: 5,
      source: "learning",
      capturedAt: generatedAt,
    })
  }
  return derived
}

/** Persisted + event-derived preferences only — no demo defaults. */
export function buildOrganizationPreferences(input: BuildOrganizationPreferencesInput): AvaOrganizationalPreference[] {
  const existing = input.existingPreferences ?? []
  const existingIds = new Set(existing.map((row) => row.id))
  const merged = [...existing]

  for (const pref of preferenceFromEvents(input.events, input.generatedAt)) {
    if (existingIds.has(pref.id)) continue
    merged.push(pref)
    existingIds.add(pref.id)
  }

  return merged.sort((left, right) => right.importance - left.importance).slice(0, 12)
}

export function buildUnansweredQuestions(input: {
  narrativeContext: AvaNarrativeContext
  preferences: AvaOrganizationalPreference[]
}): string[] {
  const questions: string[] = []
  if (input.narrativeContext.businessUnderstanding.profileIncomplete) {
    questions.push("Which customer segments should we prioritize next quarter?")
  }
  if (input.narrativeContext.metrics.readyForReview > 0 && input.narrativeContext.metrics.approvalsWaiting > 0) {
    questions.push("Which outreach drafts should we prioritize for approval?")
  }
  return questions.slice(0, 3)
}

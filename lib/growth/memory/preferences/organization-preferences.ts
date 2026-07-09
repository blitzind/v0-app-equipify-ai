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

const DEFAULT_PREFERENCES: Array<Omit<AvaOrganizationalPreference, "capturedAt">> = [
  {
    id: "pref:hospitals-first",
    key: "target_segment",
    statement: "We target hospitals before private clinics.",
    importance: 4,
    source: "preference",
  },
  {
    id: "pref:shorter-outreach",
    key: "outreach_style",
    statement: "Mike prefers shorter outreach.",
    importance: 3,
    source: "preference",
  },
  {
    id: "pref:min-employees",
    key: "company_size",
    statement: "Don't recommend companies under 10 employees.",
    importance: 4,
    source: "preference",
  },
]

function preferenceFromSuggestedAction(suggested: string | null | undefined, generatedAt: string): AvaOrganizationalPreference | null {
  if (!suggested?.trim()) return null
  const lower = suggested.toLowerCase()
  if (/tennessee|tn first|research tennessee/i.test(lower)) {
    return {
      id: "pref:tennessee-first",
      key: "geo_focus",
      statement: "Research Tennessee first.",
      importance: 4,
      source: "business_intelligence",
      capturedAt: generatedAt,
    }
  }
  if (/medical|equipment|hospital/i.test(lower)) {
    return {
      id: "pref:medical-focus",
      key: "industry_focus",
      statement: "Prioritize medical equipment companies.",
      importance: 5,
      source: "business_intelligence",
      capturedAt: generatedAt,
    }
  }
  return null
}

function preferenceFromEvents(events: AvaMemoryEvent[], generatedAt: string): AvaOrganizationalPreference[] {
  const medicalCount = events.filter((row) => inferIndustry(String(row.metadata.companyName ?? row.summary)) === "medical_equipment").length
  const hvacCount = events.filter((row) => inferIndustry(String(row.metadata.companyName ?? row.summary)) === "hvac").length

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

export function buildOrganizationPreferences(input: BuildOrganizationPreferencesInput): AvaOrganizationalPreference[] {
  const existing = input.existingPreferences ?? []
  const existingIds = new Set(existing.map((row) => row.id))
  const merged = [...existing]

  for (const pref of DEFAULT_PREFERENCES) {
    if (existingIds.has(pref.id)) continue
    merged.push({ ...pref, capturedAt: input.generatedAt })
    existingIds.add(pref.id)
  }

  const suggestedPref = preferenceFromSuggestedAction(
    input.workspaceSummary.avaConsole.suggestedNextAction,
    input.generatedAt,
  )
  if (suggestedPref && !existingIds.has(suggestedPref.id)) {
    merged.push(suggestedPref)
    existingIds.add(suggestedPref.id)
  }

  for (const pref of preferenceFromEvents(input.events, input.generatedAt)) {
    if (existingIds.has(pref.id)) continue
    merged.push(pref)
    existingIds.add(pref.id)
  }

  if (!input.narrativeContext.businessUnderstanding.hasApprovedProfile) {
    const correction: AvaOrganizationalPreference = {
      id: "pref:pricing-unclear",
      key: "business_clarity",
      statement: "Pricing is still unclear.",
      importance: 4,
      source: "business_intelligence",
      capturedAt: input.generatedAt,
    }
    if (!existingIds.has(correction.id)) merged.push(correction)
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
  if (input.preferences.some((row) => row.statement.includes("Pricing is still unclear"))) {
    questions.push("What pricing model should outreach emphasize?")
  }
  if (input.narrativeContext.metrics.readyForReview > 0 && input.narrativeContext.metrics.approvalsWaiting > 0) {
    questions.push("Which outreach drafts should we prioritize for approval?")
  }
  return questions.slice(0, 3)
}

/** Weighted command palette ranking for Growth navigation (Prompt 35). */

import type { GrowthNavigationUsageSnapshot } from "@/lib/growth/navigation/growth-navigation-usage-memory"
import { growthNavigationUsageBoost } from "@/lib/growth/navigation/growth-navigation-usage-memory"

export const GROWTH_NAVIGATION_POLISH_QA_MARKER = "growth-navigation-polish-v1" as const

export type GrowthCommandPaletteEntry = {
  id: string
  label: string
  href: string
  keywords?: string[]
  aliases?: string[]
  coreWorkflow?: boolean
  group?: "command" | "quick" | "navigate" | "more"
}

/** Query-specific priority boosts when the operator types these terms. */
export const GROWTH_COMMAND_QUERY_BOOSTS: Record<string, Record<string, number>> = {
  lead: {
    inbox: 120,
    "lead-intelligence": 110,
    search: 95,
    "crm-leads": 70,
  },
  intent: {
    "intent-pixel": 120,
    inbox: 90,
    search: 60,
  },
  call: {
    "call-workspace": 120,
    "calls-live": 110,
    "call-queue": 105,
    calls: 90,
    "live-coaching": 70,
  },
  prospect: {
    search: 120,
    inbox: 95,
    "lead-intelligence": 75,
  },
  coach: {
    "live-coaching": 120,
    "call-providers": 100,
    "call-workspace": 70,
  },
  provider: {
    providers: 120,
    "call-providers": 110,
    "provider-settings": 80,
  },
  discover: {
    search: 140,
    "intent-pixel": 100,
    "discover-companies": 70,
  },
}

const CORE_WORKFLOW_IDS = new Set([
  "command",
  "inbox",
  "search",
  "intent-pixel",
  "call-workspace",
  "discover-companies",
  "open-inbox",
  "unified-inbox",
])

function searchableTerms(entry: GrowthCommandPaletteEntry): string[] {
  return [entry.label, ...(entry.aliases ?? []), ...(entry.keywords ?? [])]
}

function termMatchScore(term: string, query: string): number {
  const normalized = term.trim().toLowerCase()
  if (!normalized || !query) return 0
  if (normalized === query) return 120
  if (normalized.startsWith(query)) return 90
  if (query.length >= 3 && normalized.includes(query)) return 55
  if (normalized.split(/\s+/).some((word) => word.startsWith(query))) return 45
  return 0
}

function querySpecificBoost(query: string, entryId: string): number {
  let boost = 0
  for (const [key, boosts] of Object.entries(GROWTH_COMMAND_QUERY_BOOSTS)) {
    if (key === query || key.startsWith(query) || query.startsWith(key)) {
      boost = Math.max(boost, boosts[entryId] ?? 0)
    }
  }
  return boost
}

export function scoreGrowthCommandPaletteEntry(
  entry: GrowthCommandPaletteEntry,
  query: string,
  usage: GrowthNavigationUsageSnapshot,
): number {
  const normalizedQuery = query.trim().toLowerCase()
  const { recentBoost, frequencyBoost } = growthNavigationUsageBoost(entry, usage)
  const coreWorkflow = entry.coreWorkflow ?? CORE_WORKFLOW_IDS.has(entry.id)

  if (!normalizedQuery) {
    return (coreWorkflow ? 20 : 5) + recentBoost + frequencyBoost
  }

  let score = 0
  for (const term of searchableTerms(entry)) {
    score = Math.max(score, termMatchScore(term, normalizedQuery))
  }

  score += querySpecificBoost(normalizedQuery, entry.id)
  score += recentBoost
  score += frequencyBoost
  if (coreWorkflow) score += 12

  return score
}

export function rankGrowthCommandPaletteEntries(
  entries: GrowthCommandPaletteEntry[],
  query: string,
  usage: GrowthNavigationUsageSnapshot,
): GrowthCommandPaletteEntry[] {
  const normalizedQuery = query.trim().toLowerCase()

  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreGrowthCommandPaletteEntry(entry, normalizedQuery, usage),
    }))
    .filter(({ score }) => (normalizedQuery ? score > 0 : score >= 0))

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score

    const aRecentIndex = usage.recent.findIndex((row) => row.id === a.entry.id)
    const bRecentIndex = usage.recent.findIndex((row) => row.id === b.entry.id)
    if (aRecentIndex !== -1 || bRecentIndex !== -1) {
      if (aRecentIndex === -1) return 1
      if (bRecentIndex === -1) return -1
      if (aRecentIndex !== bRecentIndex) return aRecentIndex - bRecentIndex
    }

    return a.entry.label.localeCompare(b.entry.label)
  })

  return scored.map(({ entry }) => entry)
}

export function collectGrowthNavigationHrefs(entries: GrowthCommandPaletteEntry[]): string[] {
  return entries.map((entry) => entry.href.split("?")[0] ?? entry.href)
}

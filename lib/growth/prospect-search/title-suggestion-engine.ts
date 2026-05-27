import {
  allCatalogTitles,
  getIndustryTitleRecommendations,
  getTitlesForRoleGroup,
  TITLE_ROLE_CATALOG,
  type TitleRoleGroup,
} from "@/lib/growth/prospect-search/title-industry-mapping"

export type TitleSuggestion = {
  title: string
  score: number
  group?: string
  source: "catalog" | "industry" | "fuzzy"
}

const TITLE_CHIP_DELIMITER = "|"

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function scoreFuzzy(needle: string, hay: string, keywords: string[] = []): number {
  const n = norm(needle)
  const h = norm(hay)
  if (!n || !h) return 0
  if (h === n) return 1
  if (h.startsWith(n)) return 0.92
  if (h.includes(n)) return 0.82
  for (const kw of keywords) {
    const k = norm(kw)
    if (k.startsWith(n) || k.includes(n)) return 0.78
  }
  return 0
}

/** Parse persisted title filter into chip list (pipe-delimited). */
export function parseTitleChips(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(TITLE_CHIP_DELIMITER)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Serialize chips into existing filter fields (same shape as before). */
export function serializeTitleChips(chips: string[]): {
  title_contains: string | null
  decision_maker_role: string | null
} {
  const cleaned = chips.map((c) => c.trim()).filter(Boolean)
  if (!cleaned.length) {
    return { title_contains: null, decision_maker_role: null }
  }
  const joined = cleaned.join(TITLE_CHIP_DELIMITER)
  return { title_contains: joined, decision_maker_role: joined }
}

export function suggestTitles(input: {
  query: string
  industry?: string | null
  selected?: string[]
  limit?: number
}): TitleSuggestion[] {
  const needle = input.query.trim()
  const limit = input.limit ?? 8
  const selected = new Set((input.selected ?? []).map(norm))
  const pool: TitleSuggestion[] = []

  if (!needle) return []

  for (const row of TITLE_ROLE_CATALOG) {
    const score = scoreFuzzy(needle, row.title, row.keywords)
    if (score >= 0.5) {
      pool.push({
        title: row.title,
        score: score + 0.05,
        group: row.group,
        source: "catalog",
      })
    }
  }

  for (const title of getIndustryTitleRecommendations(input.industry, 12)) {
    const score = scoreFuzzy(needle, title)
    if (score >= 0.45) {
      pool.push({ title, score: score + 0.08, source: "industry" })
    }
  }

  for (const title of allCatalogTitles()) {
    const score = scoreFuzzy(needle, title)
    if (score >= 0.4 && !pool.some((p) => p.title === title)) {
      pool.push({ title, score, source: "fuzzy" })
    }
  }

  const seen = new Set<string>()
  return pool
    .filter((row) => {
      if (selected.has(norm(row.title))) return false
      if (seen.has(row.title)) return false
      seen.add(row.title)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function getSmartTitleRecommendations(input: {
  industry?: string | null
  selected?: string[]
  roleGroup?: TitleRoleGroup | null
  limit?: number
}): TitleSuggestion[] {
  const limit = input.limit ?? 8
  const selected = new Set((input.selected ?? []).map(norm))
  const pool: TitleSuggestion[] = []

  if (input.roleGroup) {
    for (const title of getTitlesForRoleGroup(input.roleGroup)) {
      if (!selected.has(norm(title))) {
        pool.push({ title, score: 0.85, group: input.roleGroup, source: "catalog" })
      }
    }
  }

  for (const title of getIndustryTitleRecommendations(input.industry, 12)) {
    if (!selected.has(norm(title))) {
      pool.push({ title, score: 0.9, source: "industry" })
    }
  }

  if (!pool.length) {
    for (const title of ["Owner", "CEO", "Operations Manager", "Service Director"]) {
      if (!selected.has(norm(title))) {
        pool.push({ title, score: 0.6, source: "catalog" })
      }
    }
  }

  const seen = new Set<string>()
  return pool
    .filter((row) => {
      if (seen.has(row.title)) return false
      seen.add(row.title)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Examples: "oper" → Operations titles; "bio" → Biomedical titles */
export function quickTitleExamples(): Record<string, string[]> {
  return {
    oper: suggestTitles({ query: "oper", limit: 5 }).map((r) => r.title),
    bio: suggestTitles({ query: "bio", limit: 5 }).map((r) => r.title),
  }
}

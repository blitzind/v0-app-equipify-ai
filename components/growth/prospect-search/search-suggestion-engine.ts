import {
  PROSPECT_SEARCH_DECISION_ROLES,
  PROSPECT_SEARCH_HERO_PLACEHOLDERS,
  PROSPECT_SEARCH_ICP_TEMPLATES,
  PROSPECT_SEARCH_INDUSTRIES,
  PROSPECT_SEARCH_LOCATIONS,
  PROSPECT_SEARCH_SUGGESTED_SEARCHES,
  PROSPECT_SEARCH_TECHNOLOGIES,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"

export type ProspectSearchSuggestion = {
  id: string
  label: string
  value: string
  kind: "query" | "industry" | "location" | "technology" | "role" | "template" | "saved"
  score: number
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function scoreMatch(needle: string, hay: string): number {
  const n = norm(needle)
  const h = norm(hay)
  if (!n || !h) return 0
  if (h === n) return 1
  if (h.startsWith(n)) return 0.92
  if (h.includes(n)) return 0.78
  const tokens = n.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const hits = tokens.filter((t) => h.includes(t)).length
  return hits / tokens.length
}

export function buildSearchSuggestions(input: {
  query: string
  savedSearchNames?: string[]
  limit?: number
}): ProspectSearchSuggestion[] {
  const needle = input.query.trim()
  const limit = input.limit ?? 12
  if (!needle) return []

  const pool: ProspectSearchSuggestion[] = []

  for (const q of PROSPECT_SEARCH_HERO_PLACEHOLDERS) {
    const s = scoreMatch(needle, q)
    if (s > 0.2)
      pool.push({ id: `q-${q}`, label: q, value: q, kind: "query", score: s })
  }

  for (const s of PROSPECT_SEARCH_SUGGESTED_SEARCHES) {
    const sc = scoreMatch(needle, s.query)
    if (sc > 0.2)
      pool.push({ id: `sug-${s.query}`, label: s.label, value: s.query, kind: "query", score: sc })
  }

  for (const ind of PROSPECT_SEARCH_INDUSTRIES) {
    const sc = scoreMatch(needle, ind)
    if (sc > 0.35)
      pool.push({
        id: `ind-${ind}`,
        label: `${ind} companies`,
        value: `${ind.toLowerCase()} companies`,
        kind: "industry",
        score: sc,
      })
  }

  for (const loc of PROSPECT_SEARCH_LOCATIONS) {
    const sc = scoreMatch(needle, loc)
    if (sc > 0.4)
      pool.push({
        id: `loc-${loc}`,
        label: `Companies in ${loc}`,
        value: `${needle} ${loc}`.trim(),
        kind: "location",
        score: sc * 0.9,
      })
  }

  for (const tech of PROSPECT_SEARCH_TECHNOLOGIES) {
    const sc = scoreMatch(needle, tech)
    if (sc > 0.4)
      pool.push({
        id: `tech-${tech}`,
        label: `Using ${tech}`,
        value: `companies using ${tech}`,
        kind: "technology",
        score: sc,
      })
  }

  for (const role of PROSPECT_SEARCH_DECISION_ROLES) {
    const sc = scoreMatch(needle, role)
    if (sc > 0.4)
      pool.push({
        id: `role-${role}`,
        label: `${role} titles`,
        value: `${role.toLowerCase()} field service`,
        kind: "role",
        score: sc,
      })
  }

  for (const tpl of PROSPECT_SEARCH_ICP_TEMPLATES) {
    const sc = Math.max(
      scoreMatch(needle, tpl.name),
      scoreMatch(needle, tpl.query),
      scoreMatch(needle, tpl.description),
    )
    if (sc > 0.3)
      pool.push({
        id: `tpl-${tpl.id}`,
        label: tpl.name,
        value: tpl.query,
        kind: "template",
        score: sc,
      })
  }

  for (const name of input.savedSearchNames ?? []) {
    const sc = scoreMatch(needle, name)
    if (sc > 0.35)
      pool.push({ id: `saved-${name}`, label: name, value: name, kind: "saved", score: sc })
  }

  const seen = new Set<string>()
  return pool
    .sort((a, b) => b.score - a.score)
    .filter((row) => {
      const key = `${row.kind}:${row.value}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

export function rotateHeroPlaceholder(index: number): string {
  return PROSPECT_SEARCH_HERO_PLACEHOLDERS[index % PROSPECT_SEARCH_HERO_PLACEHOLDERS.length]!
}

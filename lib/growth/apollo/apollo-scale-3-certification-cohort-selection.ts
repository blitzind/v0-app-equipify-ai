/** Apollo Scale-3 certification cohort selection — client-safe helpers. */

export const APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES = [
  "Stat Biomedical Technicians, Inc.",
  "Sterling Biomedical",
  "Vanguard Medical LLC",
  "Auxo Medical LLC",
  "Pulse Biomedical Service",
] as const

export function normalizeApolloScale3CompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function dedupeApolloScale3CompanyNames(names: string[]): {
  unique: string[]
  deduped_count: number
} {
  const seen = new Set<string>()
  const unique: string[] = []
  let deduped_count = 0
  for (const name of names) {
    const trimmed = typeof name === "string" ? name.trim() : ""
    if (!trimmed) continue
    const key = normalizeApolloScale3CompanyName(trimmed)
    if (seen.has(key)) {
      deduped_count += 1
      continue
    }
    seen.add(key)
    unique.push(trimmed)
  }
  return { unique, deduped_count }
}

export function dedupeApolloScale3CompanyCandidateIds(ids: string[]): {
  unique: string[]
  deduped_count: number
} {
  const seen = new Set<string>()
  const unique: string[] = []
  let deduped_count = 0
  for (const id of ids) {
    const trimmed = typeof id === "string" ? id.trim() : ""
    if (!trimmed) continue
    if (seen.has(trimmed)) {
      deduped_count += 1
      continue
    }
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return { unique, deduped_count }
}

/** Prospect Search — NAICS/SIC filter validation and approximate row matching (client-safe). */

import {
  GROWTH_INDUSTRY_TAXONOMY,
  type GrowthIndustryTaxonomyEntry,
} from "@/lib/growth/playbooks/industry-taxonomy"

export type IndustryCodeKind = "naics" | "sic"

export type IndustryCodeValidationResult =
  | { ok: true; code: string; kind: IndustryCodeKind; label: string; source: "taxonomy" | "format" }
  | { ok: false; code: string; kind: IndustryCodeKind; reason: "invalid_format" | "unsupported" }

const NAICS_PATTERN = /^\d{2,6}$/
const SIC_PATTERN = /^\d{3,4}$/

function normalizeCode(raw: string): string {
  return raw.trim().replace(/\D/g, "")
}

function taxonomyEntries(): GrowthIndustryTaxonomyEntry[] {
  return Object.values(GROWTH_INDUSTRY_TAXONOMY)
}

export function lookupIndustryCodeLabel(
  code: string,
  kind: IndustryCodeKind,
): string | null {
  const normalized = normalizeCode(code)
  if (!normalized) return null
  for (const entry of taxonomyEntries()) {
    const codes = kind === "naics" ? entry.naics : entry.sic
    if (codes.some((c) => normalizeCode(c) === normalized || normalized.startsWith(normalizeCode(c)))) {
      return entry.label
    }
    if (kind === "naics" && codes.some((c) => normalizeCode(c).startsWith(normalized))) {
      return entry.label
    }
  }
  return null
}

export function validateIndustryCode(
  raw: string,
  kind: IndustryCodeKind,
): IndustryCodeValidationResult {
  const code = normalizeCode(raw)
  if (!code) {
    return { ok: false, code: raw.trim(), kind, reason: "invalid_format" }
  }
  if (kind === "naics" && !NAICS_PATTERN.test(code)) {
    return { ok: false, code, kind, reason: "invalid_format" }
  }
  if (kind === "sic" && !SIC_PATTERN.test(code)) {
    return { ok: false, code, kind, reason: "invalid_format" }
  }
  const label = lookupIndustryCodeLabel(code, kind)
  if (label) {
    return { ok: true, code, kind, label, source: "taxonomy" }
  }
  return {
    ok: true,
    code,
    kind,
    label: `${kind.toUpperCase()} ${code}`,
    source: "format",
  }
}

export function resolveIndustryCodesFromQuery(query: string): Array<{
  code: string
  kind: IndustryCodeKind
  label: string
}> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: Array<{ code: string; kind: IndustryCodeKind; label: string }> = []
  for (const entry of taxonomyEntries()) {
    const haystack = [entry.label, entry.description, ...entry.aliases, ...entry.keywords]
      .join(" ")
      .toLowerCase()
    if (!haystack.includes(q) && !entry.keywords.some((kw) => q.includes(kw.toLowerCase()))) {
      continue
    }
    for (const code of entry.naics) {
      results.push({ code: normalizeCode(code), kind: "naics", label: entry.label })
    }
  }
  const seen = new Set<string>()
  return results.filter((row) => {
    const key = `${row.kind}:${row.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function codeMatchesList(code: string, filters: string[], kind: IndustryCodeKind): boolean {
  const normalized = normalizeCode(code)
  return filters.some((filterCode) => {
    const f = normalizeCode(filterCode)
    if (!f) return false
    if (normalized === f) return true
    if (kind === "naics" && (normalized.startsWith(f) || f.startsWith(normalized))) return true
    return false
  })
}

/** Approximate match when index rows lack native NAICS/SIC — uses taxonomy keywords + industry text. */
export function rowMatchesProspectSearchIndustryCodeFilters(input: {
  industry: string | null | undefined
  subindustry?: string | null
  keywords?: string[]
  notes?: string | null
  company_name?: string | null
  naics_codes?: string[]
  sic_codes?: string[]
  preferredNaics?: string[]
  excludedNaics?: string[]
  preferredSic?: string[]
  excludedSic?: string[]
}): boolean {
  const rowNaics = (input.naics_codes ?? []).map(normalizeCode).filter(Boolean)
  const rowSic = (input.sic_codes ?? []).map(normalizeCode).filter(Boolean)

  if (input.excludedNaics?.length) {
    if (rowNaics.some((c) => codeMatchesList(c, input.excludedNaics!, "naics"))) return false
  }
  if (input.excludedSic?.length) {
    if (rowSic.some((c) => codeMatchesList(c, input.excludedSic!, "sic"))) return false
  }

  const blob = [
    input.industry,
    input.subindustry,
    input.company_name,
    input.notes,
    ...(input.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (input.preferredNaics?.length) {
    if (rowNaics.some((c) => codeMatchesList(c, input.preferredNaics!, "naics"))) return true
    for (const code of input.preferredNaics) {
      const label = lookupIndustryCodeLabel(code, "naics")
      if (label && blob.includes(label.toLowerCase())) return true
      for (const entry of taxonomyEntries()) {
        if (entry.naics.some((c) => codeMatchesList(c, [code], "naics"))) {
          if (entry.keywords.some((kw) => blob.includes(kw.toLowerCase()))) return true
          if (entry.aliases.some((a) => blob.includes(a.toLowerCase()))) return true
        }
      }
    }
    return false
  }

  if (input.preferredSic?.length) {
    if (rowSic.some((c) => codeMatchesList(c, input.preferredSic!, "sic"))) return true
    for (const code of input.preferredSic) {
      const label = lookupIndustryCodeLabel(code, "sic")
      if (label && blob.includes(label.toLowerCase())) return true
    }
    return false
  }

  return true
}

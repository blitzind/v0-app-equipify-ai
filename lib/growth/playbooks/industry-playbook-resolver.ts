/** GS-AI-PLAYBOOK-1A — Deterministic industry resolver (client-safe, no AI). */

import {
  GROWTH_INDUSTRY_IDS,
  GROWTH_INDUSTRY_RESOLVER_CONFIDENCE,
  GROWTH_INDUSTRY_TAXONOMY,
  type GrowthIndustryId,
  type GrowthIndustryResolverSignalType,
} from "@/lib/growth/playbooks/industry-taxonomy"

export type GrowthIndustryResolverInput = {
  companyName?: string | null
  industry?: string | null
  description?: string | null
  websiteText?: string | null
  naics?: string | string[] | null
  sic?: string | string[] | null
  researchSummary?: string | null
}

export type GrowthIndustryMatchSignal = {
  industryId: GrowthIndustryId
  signalType: GrowthIndustryResolverSignalType
  matchedValue: string
  confidence: number
}

export type GrowthIndustryResolution = {
  industryId: GrowthIndustryId | null
  confidence: number
  matchedSignals: GrowthIndustryMatchSignal[]
  allMatches: GrowthIndustryMatchSignal[]
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function normalizeCode(value: string): string {
  return value.replace(/\D/g, "")
}

function toCodeList(value: string | string[] | null | undefined): string[] {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  return list.map((entry) => normalizeCode(entry)).filter(Boolean)
}

function haystack(input: GrowthIndustryResolverInput): string {
  return [input.industry, input.description, input.websiteText, input.researchSummary]
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function companyHaystack(input: GrowthIndustryResolverInput): string {
  return normalizeText(input.companyName).toLowerCase()
}

function pushSignal(
  bucket: GrowthIndustryMatchSignal[],
  signal: GrowthIndustryMatchSignal,
): void {
  bucket.push(signal)
}

function matchesWholeKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\b`, "i").test(text)
}

function matchesAliasOrKeyword(text: string, term: string): boolean {
  const normalized = term.toLowerCase()
  if (normalized.includes(" ")) return text.includes(normalized)
  return matchesWholeKeyword(text, normalized)
}

function resolveNaicsMatches(codes: string[]): GrowthIndustryMatchSignal[] {
  const matches: GrowthIndustryMatchSignal[] = []
  for (const code of codes) {
    for (const industryId of GROWTH_INDUSTRY_IDS) {
      const entry = GROWTH_INDUSTRY_TAXONOMY[industryId]
      for (const naics of entry.naics) {
        const normalized = normalizeCode(naics)
        if (code === normalized || code.startsWith(normalized) || normalized.startsWith(code)) {
          pushSignal(matches, {
            industryId,
            signalType: code === normalized ? "exact_naics" : "exact_naics",
            matchedValue: naics,
            confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.exact_naics,
          })
        }
      }
    }
  }
  return matches
}

function resolveSicMatches(codes: string[]): GrowthIndustryMatchSignal[] {
  const matches: GrowthIndustryMatchSignal[] = []
  for (const code of codes) {
    for (const industryId of GROWTH_INDUSTRY_IDS) {
      const entry = GROWTH_INDUSTRY_TAXONOMY[industryId]
      for (const sic of entry.sic) {
        const normalized = normalizeCode(sic)
        if (code === normalized) {
          pushSignal(matches, {
            industryId,
            signalType: "exact_sic",
            matchedValue: sic,
            confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.exact_sic,
          })
        }
      }
    }
  }
  return matches
}

function resolveTextMatches(input: GrowthIndustryResolverInput): GrowthIndustryMatchSignal[] {
  const text = haystack(input)
  const company = companyHaystack(input)
  const matches: GrowthIndustryMatchSignal[] = []

  for (const industryId of GROWTH_INDUSTRY_IDS) {
    const entry = GROWTH_INDUSTRY_TAXONOMY[industryId]

    for (const keyword of entry.keywords) {
      if (matchesWholeKeyword(text, keyword)) {
        pushSignal(matches, {
          industryId,
          signalType: "exact_keyword",
          matchedValue: keyword,
          confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.exact_keyword,
        })
      }
    }

    for (const alias of entry.aliases) {
      if (matchesAliasOrKeyword(text, alias)) {
        pushSignal(matches, {
          industryId,
          signalType: "alias_match",
          matchedValue: alias,
          confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.alias_match,
        })
      }
    }

    for (const alias of entry.aliases) {
      if (company && matchesAliasOrKeyword(company, alias)) {
        pushSignal(matches, {
          industryId,
          signalType: "company_name_hint",
          matchedValue: alias,
          confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.company_name_hint,
        })
      }
    }

    for (const keyword of entry.keywords) {
      if (company && matchesWholeKeyword(company, keyword)) {
        pushSignal(matches, {
          industryId,
          signalType: "company_name_hint",
          matchedValue: keyword,
          confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.company_name_hint,
        })
      }
    }

    const research = normalizeText(input.researchSummary).toLowerCase()
    if (research) {
      for (const keyword of entry.keywords) {
        if (matchesWholeKeyword(research, keyword)) {
          pushSignal(matches, {
            industryId,
            signalType: "research_text_hint",
            matchedValue: keyword,
            confidence: GROWTH_INDUSTRY_RESOLVER_CONFIDENCE.research_text_hint,
          })
        }
      }
    }
  }

  return matches
}

function dedupeBestSignals(signals: GrowthIndustryMatchSignal[]): GrowthIndustryMatchSignal[] {
  const bestByKey = new Map<string, GrowthIndustryMatchSignal>()
  for (const signal of signals) {
    const key = `${signal.industryId}:${signal.signalType}:${signal.matchedValue.toLowerCase()}`
    const existing = bestByKey.get(key)
    if (!existing || signal.confidence > existing.confidence) {
      bestByKey.set(key, signal)
    }
  }
  return [...bestByKey.values()]
}

function pickBestIndustry(signals: GrowthIndustryMatchSignal[]): GrowthIndustryMatchSignal[] {
  if (signals.length === 0) return []
  const byIndustry = new Map<GrowthIndustryId, GrowthIndustryMatchSignal[]>()
  for (const signal of signals) {
    const list = byIndustry.get(signal.industryId) ?? []
    list.push(signal)
    byIndustry.set(signal.industryId, list)
  }

  const ranked = [...byIndustry.entries()]
    .map(([industryId, industrySignals]) => {
      const top = industrySignals.reduce((best, current) =>
        current.confidence > best.confidence ? current : best,
      )
      const support = industrySignals.length
      return { industryId, top, support, total: industrySignals.reduce((sum, s) => sum + s.confidence, 0) }
    })
    .sort(
      (a, b) =>
        b.top.confidence - a.top.confidence ||
        b.top.matchedValue.length - a.top.matchedValue.length ||
        b.support - a.support ||
        b.total - a.total,
    )

  const winner = ranked[0]
  if (!winner) return []
  return industrySignalsForIndustry(signals, winner.industryId)
}

function industrySignalsForIndustry(
  signals: GrowthIndustryMatchSignal[],
  industryId: GrowthIndustryId,
): GrowthIndustryMatchSignal[] {
  return signals
    .filter((signal) => signal.industryId === industryId)
    .sort((a, b) => b.confidence - a.confidence)
}

export function resolveGrowthIndustry(input: GrowthIndustryResolverInput): GrowthIndustryResolution {
  const naicsCodes = toCodeList(input.naics)
  const sicCodes = toCodeList(input.sic)

  const allMatches = dedupeBestSignals([
    ...resolveNaicsMatches(naicsCodes),
    ...resolveSicMatches(sicCodes),
    ...resolveTextMatches(input),
  ])

  if (allMatches.length === 0) {
    return { industryId: null, confidence: 0, matchedSignals: [], allMatches: [] }
  }

  const winnerSignals = pickBestIndustry(allMatches)
  const top = winnerSignals[0]
  return {
    industryId: top?.industryId ?? null,
    confidence: top?.confidence ?? 0,
    matchedSignals: winnerSignals,
    allMatches,
  }
}

export function resolveGrowthIndustryPlaybookId(input: GrowthIndustryResolverInput): GrowthIndustryId | null {
  return resolveGrowthIndustry(input).industryId
}

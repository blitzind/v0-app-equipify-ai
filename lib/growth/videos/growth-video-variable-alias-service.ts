/** Growth Engine B1 — Legacy alias → canonical variable key mapping (client-safe). */

/** Maps flat legacy tokens to canonical registry-backed keys. */
export const GROWTH_VIDEO_VARIABLE_ALIAS_TO_CANONICAL: Readonly<Record<string, string>> = {
  first_name: "lead.first_name",
  last_name: "lead.last_name",
  full_name: "lead.contact_name",
  email: "lead.email",
  company: "lead.company_name",
  industry: "lead.industry",
  title: "lead.title",
  city: "lead.city",
  state: "lead.state",
  country: "lead.country",
  pain_point: "lead.pain_point",
  cta_url: "lead.cta_url",
  calendar_url: "booking.link",
  // Share-page namespace aliases (architecture consolidation audit).
  "prospect.name": "lead.contact_name",
  "company.name": "lead.company_name",
  "prospect.company": "lead.company_name",
  "sender.company": "sender.name",
}

export const GROWTH_VIDEO_LEGACY_ALIAS_KEYS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "company",
  "industry",
  "title",
  "city",
  "state",
  "country",
  "pain_point",
  "cta_url",
  "calendar_url",
] as const

export type GrowthVideoLegacyAliasKey = (typeof GROWTH_VIDEO_LEGACY_ALIAS_KEYS)[number]

export function resolveGrowthVideoVariableAlias(key: string): string {
  const normalized = key.trim().toLowerCase()
  return GROWTH_VIDEO_VARIABLE_ALIAS_TO_CANONICAL[normalized] ?? normalized
}

export function isGrowthVideoLegacyAlias(key: string): boolean {
  return GROWTH_VIDEO_LEGACY_ALIAS_KEYS.includes(key.trim().toLowerCase() as GrowthVideoLegacyAliasKey)
}

/** Expand canonical variables into alias keys for merge rendering. */
export function buildGrowthVideoAliasMergeMap(
  canonicalVariables: Record<string, string>,
): Record<string, string> {
  const aliasMap: Record<string, string> = {}
  for (const [alias, canonicalKey] of Object.entries(GROWTH_VIDEO_VARIABLE_ALIAS_TO_CANONICAL)) {
    const value = canonicalVariables[canonicalKey.toLowerCase()]
    if (value !== undefined) {
      aliasMap[alias.toLowerCase()] = value
    }
  }
  return aliasMap
}

/** Returns alias → resolved value for reporting. */
export function buildGrowthVideoAliasResolutionReport(
  canonicalVariables: Record<string, string>,
): Record<string, string> {
  const report: Record<string, string> = {}
  for (const alias of GROWTH_VIDEO_LEGACY_ALIAS_KEYS) {
    const canonicalKey = GROWTH_VIDEO_VARIABLE_ALIAS_TO_CANONICAL[alias]!.toLowerCase()
    const value = canonicalVariables[canonicalKey]
    if (value !== undefined && value !== "") {
      report[alias] = value
    }
  }
  return report
}

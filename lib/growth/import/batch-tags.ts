/** Auto-tag rules inferred from batch naming / campaign text. */

export const GROWTH_IMPORT_AUTO_TAG_RULES = [
  { pattern: /medical\s*equipment/i, tag: "medical_equipment" },
  { pattern: /\bstorm\b/i, tag: "storm_restoration" },
  { pattern: /\bhvac\b/i, tag: "hvac" },
] as const

export type GrowthImportAutoTag = (typeof GROWTH_IMPORT_AUTO_TAG_RULES)[number]["tag"]

export function inferBatchAutoTags(input: {
  batchName?: string | null
  sourceCampaign?: string | null
  sourceChannel?: string | null
}): GrowthImportAutoTag[] {
  const haystack = [input.batchName, input.sourceCampaign, input.sourceChannel].filter(Boolean).join(" ")
  if (!haystack.trim()) return []

  const tags = new Set<GrowthImportAutoTag>()
  for (const rule of GROWTH_IMPORT_AUTO_TAG_RULES) {
    if (rule.pattern.test(haystack)) tags.add(rule.tag)
  }
  return [...tags]
}

export function mergeLeadMetadataTags(existing: unknown, incoming: string[]): string[] {
  const current = Array.isArray(existing) ? existing.filter((tag): tag is string => typeof tag === "string") : []
  return [...new Set([...current, ...incoming])]
}

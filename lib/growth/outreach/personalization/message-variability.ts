/** Deterministic variation selection for outreach personalization (slice 6.15B). */

export function hashVariationSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pickVariantIndex(seed: string, variantCount: number): number {
  if (variantCount <= 1) return 0
  return hashVariationSeed(seed) % variantCount
}

export function buildPersonalizationVariationKey(input: {
  leadId: string
  generationType: string
  strategyVersion: string
  angle: string
}): string {
  return `${input.strategyVersion}:${input.generationType}:${input.angle}:${input.leadId}`
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

import { createHash } from "node:crypto"

/** Normalize provider query text for stable cache keys. */
export function normalizeProviderQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildProviderQueryHash(providerName: string, normalizedQuery: string): string {
  const key = `${providerName.trim().toLowerCase()}|${normalizedQuery}`
  return createHash("sha256").update(key).digest("hex").slice(0, 40)
}

export function stableQueryInputJson(input: Record<string, unknown>): Record<string, unknown> {
  const sorted = Object.keys(input)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = input[key]
      return acc
    }, {})
  return sorted
}

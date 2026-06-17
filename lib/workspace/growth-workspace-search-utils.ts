/** Client helpers for Growth workspace global search providers. */

export const GROWTH_WORKSPACE_SEARCH_MAX_PER_SECTION = 5 as const

export function growthSearchMatchesQuery(query: string, ...parts: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return false
  return parts.some((part) => part?.trim().toLowerCase().includes(needle))
}

export async function growthSearchFetchJson<T>(
  url: string,
  signal: AbortSignal,
): Promise<T | null> {
  try {
    const res = await fetch(url, { signal, cache: "no-store" })
    const body = (await res.json().catch(() => ({}))) as T
    if (!res.ok) return null
    return body
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error
    return null
  }
}

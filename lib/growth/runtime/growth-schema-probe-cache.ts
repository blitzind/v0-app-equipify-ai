/**
 * Phase 8M — memoize successful schema readiness probes (process lifetime).
 */

type CachedBooleanProbe = {
  value: boolean
  checkedAt: number
}

const successfulProbes = new Map<string, CachedBooleanProbe>()

/** Returns cached true; re-probes on false or first call. */
export async function memoizeGrowthSchemaProbe(
  key: string,
  probe: () => Promise<boolean>,
): Promise<boolean> {
  const cached = successfulProbes.get(key)
  if (cached?.value === true) return true

  const value = await probe()
  if (value) {
    successfulProbes.set(key, { value: true, checkedAt: Date.now() })
  } else {
    successfulProbes.delete(key)
  }
  return value
}

export function resetGrowthSchemaProbeCacheForTests(): void {
  successfulProbes.clear()
}

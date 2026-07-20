/** GE-AIOS-NEXT-1C — Strategic override preference memory (client-safe, bounded signal only). */

export const GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_STORAGE_KEY =
  "equipify:growth-home-ava-strategic-overrides/v1" as const

export const GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER =
  "ge-aios-next-1c-ava-strategic-override-v1" as const

export type GrowthHomeAvaStrategicOverrideRecord = {
  marketKey: string
  instruction: string
  overrideCount: number
  lastOverrideAt: string
}

type OverrideStore = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER
  organizationId: string | null
  records: GrowthHomeAvaStrategicOverrideRecord[]
}

function readStore(): OverrideStore {
  if (typeof window === "undefined") {
    return {
      qaMarker: GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER,
      organizationId: null,
      records: [],
    }
  }
  try {
    const raw = window.localStorage.getItem(GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as OverrideStore) : null
    if (!parsed || parsed.qaMarker !== GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER) {
      return {
        qaMarker: GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER,
        organizationId: null,
        records: [],
      }
    }
    return parsed
  } catch {
    return {
      qaMarker: GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER,
      organizationId: null,
      records: [],
    }
  }
}

function writeStore(store: OverrideStore): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
}

export function buildStrategicMarketKey(input: {
  industryLabel?: string | null
  geographyLabel?: string | null
}): string {
  return [input.industryLabel?.trim().toLowerCase(), input.geographyLabel?.trim().toLowerCase()]
    .filter(Boolean)
    .join("|")
}

export function readGrowthHomeAvaStrategicOverrideRecords(
  organizationId?: string | null,
): GrowthHomeAvaStrategicOverrideRecord[] {
  const store = readStore()
  if (organizationId && store.organizationId && store.organizationId !== organizationId) {
    return []
  }
  return store.records
}

export function recordGrowthHomeAvaStrategicOverride(input: {
  marketKey: string
  instruction: string
  organizationId?: string | null
}): GrowthHomeAvaStrategicOverrideRecord {
  const store = readStore()
  const now = new Date().toISOString()
  const existing = store.records.find((row) => row.marketKey === input.marketKey)
  const next: GrowthHomeAvaStrategicOverrideRecord = {
    marketKey: input.marketKey,
    instruction: input.instruction.trim(),
    overrideCount: (existing?.overrideCount ?? 0) + 1,
    lastOverrideAt: now,
  }
  writeStore({
    qaMarker: GROWTH_AIOS_NEXT_1C_STRATEGIC_OVERRIDE_QA_MARKER,
    organizationId: input.organizationId ?? store.organizationId,
    records: [next, ...store.records.filter((row) => row.marketKey !== input.marketKey)],
  })
  return next
}

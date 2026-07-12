/**
 * GE-AIOS-HOTFIX-25A-2A — Safe Raw Intelligence domain resolution.
 * Presentation-only. Fail-closed for missing maps / missing rawDomains / unknown focus.
 */

import {
  GROWTH_AVA_FOCUS_TO_RAW_DOMAIN,
  GROWTH_AVA_RAW_DOMAIN_IDS,
  GROWTH_AVA_RAW_DOMAIN_ORDER,
  GROWTH_AVA_RAW_DOMAIN_PERSIST_KEYS,
  GROWTH_AVA_RAW_DOMAIN_TITLES,
  type GrowthAvaRawDomainId,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

export type GrowthAvaRawDomainSlot = {
  domainId: GrowthAvaRawDomainId
  elementId: string
  title: string
  persistKey: string
}

/**
 * Resolve drawerFocus → domain. Unknown / empty / null never throws.
 */
export function resolveCognitiveDomainFromFocus(
  focus: string | null | undefined,
): GrowthAvaRawDomainId | null {
  if (focus == null) return null
  const trimmed = String(focus).trim()
  if (!trimmed) return null
  const mapped = GROWTH_AVA_FOCUS_TO_RAW_DOMAIN[trimmed]
  if (mapped && GROWTH_AVA_RAW_DOMAIN_ORDER.includes(mapped)) return mapped
  return null
}

/**
 * Build render slots for Raw Intelligence domains.
 * Never throws when rawDomains / maps are missing.
 */
export function listAvaRawDomainSlots(): GrowthAvaRawDomainSlot[] {
  const order = GROWTH_AVA_RAW_DOMAIN_ORDER ?? []
  const ids = GROWTH_AVA_RAW_DOMAIN_IDS ?? ({} as Record<GrowthAvaRawDomainId, string>)
  const titles = GROWTH_AVA_RAW_DOMAIN_TITLES ?? ({} as Record<GrowthAvaRawDomainId, string>)
  const persist = GROWTH_AVA_RAW_DOMAIN_PERSIST_KEYS ?? ({} as Record<GrowthAvaRawDomainId, string>)

  const slots: GrowthAvaRawDomainSlot[] = []
  for (const domainId of order) {
    if (!domainId) continue
    const elementId = ids[domainId]
    const title = titles[domainId]
    const persistKey = persist[domainId]
    if (!elementId || !title || !persistKey) continue
    slots.push({ domainId, elementId, title, persistKey })
  }
  return slots
}

/**
 * Safe child lookup — the production crash path was:
 *   undefined['research']  →  TypeError reading 'research'
 */
export function resolveAvaRawDomainChildren<T>(
  rawDomains: Partial<Record<GrowthAvaRawDomainId, T>> | null | undefined,
  domainId: GrowthAvaRawDomainId,
): T | null {
  if (rawDomains == null || typeof rawDomains !== "object") return null
  const value = rawDomains[domainId]
  return value ?? null
}

export function resolveAvaRawDomainPersistKey(domainId: GrowthAvaRawDomainId | null | undefined): string | null {
  if (!domainId) return null
  return GROWTH_AVA_RAW_DOMAIN_PERSIST_KEYS?.[domainId] ?? null
}

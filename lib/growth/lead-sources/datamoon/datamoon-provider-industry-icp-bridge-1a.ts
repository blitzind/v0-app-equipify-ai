/** GE-AIOS-PROSPECT-SEARCH-PROVIDER-INDUSTRY-BRIDGE-1A — Provider taxonomy → SSV ICP alias bridge (adapter-only). */

import {
  DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES,
  type DatamoonProvenPrimaryIndustryTaxonomyValue,
} from "@/lib/growth/lead-sources/datamoon/datamoon-primary-industry-taxonomy-1a"
import type { DatamoonProviderIndustryIcpBridgeMetadata } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_1A_QA_MARKER =
  "ge-aios-prospect-search-provider-industry-bridge-1a-v1" as const

export const DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION =
  "datamoon-provider-industry-icp-bridge-2026-07-16" as const

export const DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_NO_MAPPING_REASON =
  "no_proven_provider_industry_icp_bridge_mapping" as const

/**
 * Exact Supported Service Vertical industry alias strings (canonical registry).
 * industrial_equipment + material_handling — not modified here; referenced for bridge targets only.
 */
export const DATAMOON_PROVEN_PROVIDER_TO_SSV_ICP_ALIASES = {
  "Machinery Manufacturing": [
    "Industrial equipment service",
    "Industrial maintenance",
    "Material handling service",
  ],
  "Industrial Machinery Manufacturing": [
    "Industrial equipment service",
    "Industrial maintenance",
    "Material handling service",
  ],
} as const satisfies Record<
  DatamoonProvenPrimaryIndustryTaxonomyValue,
  readonly string[]
>

export type DatamoonProviderIndustryIcpBridgeMappingEvidence = {
  providerTaxonomy: DatamoonProvenPrimaryIndustryTaxonomyValue
  equivalentSSVAliases: readonly string[]
  reason: string
  version: typeof DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION
  evidenceSource: string
}

export const DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_MAPPING_EVIDENCE: readonly DatamoonProviderIndustryIcpBridgeMappingEvidence[] =
  [
    {
      providerTaxonomy: "Machinery Manufacturing",
      equivalentSSVAliases: DATAMOON_PROVEN_PROVIDER_TO_SSV_ICP_ALIASES["Machinery Manufacturing"],
      reason:
        "Production ICP replay rejected provider taxonomy at SSV industry_aliases gate; normalize to operational service vocabulary.",
      version: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
      evidenceSource:
        "Production replay audiences 5962/5987 — Valmont Industries, Osterwalder Ag (Machinery Manufacturing)",
    },
    {
      providerTaxonomy: "Industrial Machinery Manufacturing",
      equivalentSSVAliases:
        DATAMOON_PROVEN_PROVIDER_TO_SSV_ICP_ALIASES["Industrial Machinery Manufacturing"],
      reason:
        "Production ICP replay rejected provider taxonomy at SSV industry_aliases gate; normalize to operational service vocabulary.",
      version: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
      evidenceSource:
        "Production replay audiences 5962/5987 — Valmont Industries (Industrial Machinery Manufacturing)",
    },
  ] as const

function normalizeProviderIndustryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

const PROVEN_PROVIDER_INDUSTRY_BRIDGE_LOOKUP = new Map<string, readonly string[]>(
  DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES.map((taxonomy) => [
    normalizeProviderIndustryKey(taxonomy),
    DATAMOON_PROVEN_PROVIDER_TO_SSV_ICP_ALIASES[taxonomy],
  ]),
)

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export function resolveDatamoonProviderIndustryIcpBridge(
  providerIndustry: string | null | undefined,
): DatamoonProviderIndustryIcpBridgeMetadata {
  const trimmed = providerIndustry?.trim() ?? null
  if (!trimmed) {
    return {
      providerIndustry: null,
      mappedSSVAliases: [],
      bridgeApplied: false,
      bridgeVersion: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
      bridgeReason: null,
    }
  }

  const mapped = PROVEN_PROVIDER_INDUSTRY_BRIDGE_LOOKUP.get(normalizeProviderIndustryKey(trimmed))
  if (!mapped?.length) {
    return {
      providerIndustry: trimmed,
      mappedSSVAliases: [],
      bridgeApplied: false,
      bridgeVersion: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
      bridgeReason: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_NO_MAPPING_REASON,
    }
  }

  const evidence = DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_MAPPING_EVIDENCE.find(
    (entry) => normalizeProviderIndustryKey(entry.providerTaxonomy) === normalizeProviderIndustryKey(trimmed),
  )

  return {
    providerIndustry: trimmed,
    mappedSSVAliases: [...mapped],
    bridgeApplied: true,
    bridgeVersion: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
    bridgeReason: evidence?.reason ?? null,
  }
}

export function applyDatamoonProviderIndustryIcpBridge(input: {
  providerIndustry: string | null | undefined
  keywords: string[]
  signals?: string[]
}): {
  keywords: string[]
  signals: string[]
  metadata: DatamoonProviderIndustryIcpBridgeMetadata
} {
  const metadata = resolveDatamoonProviderIndustryIcpBridge(input.providerIndustry)
  const signals = [...(input.signals ?? [])]

  if (!metadata.bridgeApplied) {
    return {
      keywords: input.keywords,
      signals,
      metadata,
    }
  }

  const keywords = uniqueStrings([...input.keywords, ...metadata.mappedSSVAliases])
  signals.push(
    `Provider industry bridge (${metadata.bridgeVersion}): ${metadata.providerIndustry} → ${metadata.mappedSSVAliases.join(", ")}`,
  )

  return {
    keywords,
    signals,
    metadata,
  }
}

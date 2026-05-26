import type {
  GrowthRealWorldDiscoveryAttribution,
  GrowthRealWorldDiscoveryEvidence,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"

export function buildDefaultRealWorldEvidence(input: {
  company_name: string
  provider_name: string
  provider_type: string
  query: string
  source_url?: string | null
}): GrowthRealWorldDiscoveryEvidence[] {
  const urlNote = input.source_url ? ` Source: ${input.source_url}.` : ""
  return [
    {
      claim: "Public business listing",
      evidence: `Company "${input.company_name}" returned by ${input.provider_name} for query "${input.query}".${urlNote}`,
      source: `growth.real_world_discovery.${input.provider_type}`,
    },
  ]
}

export function buildDefaultRealWorldAttribution(input: {
  provider_name: string
  provider_type: string
  evidence: string
  confidence: number
  signal?: string
}): GrowthRealWorldDiscoveryAttribution[] {
  return [
    {
      source: `growth.real_world_discovery.${input.provider_type}`,
      provider_type: input.provider_type,
      provider_name: input.provider_name,
      signal: input.signal ?? "discover",
      evidence: input.evidence,
      confidence: input.confidence,
    },
  ]
}

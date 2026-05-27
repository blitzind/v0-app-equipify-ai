import type {
  GrowthCompanySignalAttribution,
  GrowthCompanySignalEvidence,
  GrowthCompanySignalEvidenceTier,
} from "@/lib/growth/company-signals/company-signal-types"

export function buildCompanySignalEvidence(input: {
  claim: string
  evidence: string
  source: string
  tier: GrowthCompanySignalEvidenceTier
}): GrowthCompanySignalEvidence[] {
  return [
    {
      claim: input.claim,
      evidence: input.evidence,
      source: input.source,
      tier: input.tier,
    },
  ]
}

export function buildCompanySignalAttribution(input: {
  detector: string
  signal: string
  evidence: string
  tier: GrowthCompanySignalEvidenceTier
  confidence: number
}): GrowthCompanySignalAttribution[] {
  return [
    {
      source: `growth.company_signals.${input.detector}`,
      detector: input.detector,
      tier: input.tier,
      signal: input.signal,
      evidence: input.evidence,
      confidence: input.confidence,
    },
  ]
}

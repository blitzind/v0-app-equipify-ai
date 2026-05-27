import { buildCompanySignalDedupeHash } from "@/lib/growth/company-signals/company-signal-dedupe"
import type { NormalizedCompanySignal } from "@/lib/growth/company-signals/company-signal-dedupe"
import {
  buildCompanySignalAttribution,
  buildCompanySignalEvidence,
} from "@/lib/growth/company-signals/company-signal-evidence"
import { scoreCompanySignalConfidence } from "@/lib/growth/company-signals/company-signal-confidence"
import type {
  GrowthCompanySignalCategory,
  GrowthCompanySignalEvidenceTier,
} from "@/lib/growth/company-signals/company-signal-types"

export type RawCompanySignalCandidate = {
  signal_category: GrowthCompanySignalCategory
  signal_type: string
  signal_value: string
  tier: GrowthCompanySignalEvidenceTier
  claim: string
  evidence: string
  source_field: string
  pattern_strength?: "strong" | "moderate" | "weak"
  metadata?: Record<string, unknown>
}

export function normalizeCompanySignal(
  raw: RawCompanySignalCandidate,
  company_candidate_id: string,
  detector: string,
): NormalizedCompanySignal | null {
  const signal_type = raw.signal_type.trim()
  const signal_value = raw.signal_value.trim()
  if (!signal_type || !signal_value) return null

  const evidence = buildCompanySignalEvidence({
    claim: raw.claim,
    evidence: raw.evidence,
    source: raw.source_field,
    tier: raw.tier,
  })

  const confidence = scoreCompanySignalConfidence({
    tier: raw.tier,
    evidence_count: evidence.length,
    pattern_strength: raw.pattern_strength,
  })

  const source_attribution = buildCompanySignalAttribution({
    detector,
    signal: signal_type,
    evidence: raw.evidence,
    tier: raw.tier,
    confidence,
  })

  return {
    signal_category: raw.signal_category,
    signal_type,
    signal_value,
    confidence,
    evidence,
    source_attribution,
    observed_at: new Date().toISOString(),
    dedupe_hash: buildCompanySignalDedupeHash({
      company_candidate_id,
      signal_category: raw.signal_category,
      signal_type,
    }),
    metadata: {
      detector,
      source_field: raw.source_field,
      ...(raw.metadata ?? {}),
    },
  }
}

import {
  companySignalContextBlob,
  matchPhrase,
  type GrowthCompanySignalContext,
} from "@/lib/growth/company-signals/company-signal-context"
import type { RawCompanySignalCandidate } from "@/lib/growth/company-signals/company-signal-normalizer"
import type { GrowthCompanySignalCategory } from "@/lib/growth/company-signals/company-signal-types"

type TechRule = {
  signal_type: string
  signal_value: string
  phrases: Array<{ phrase: string; strength?: "strong" | "moderate" | "weak" }>
  category: GrowthCompanySignalCategory
}

const TECH_RULES: TechRule[] = [
  {
    signal_type: "quickbooks_detected",
    signal_value: "QuickBooks detected",
    phrases: [{ phrase: "quickbooks", strength: "strong" }],
    category: "technology",
  },
  {
    signal_type: "field_service_software_detected",
    signal_value: "Field service software detected",
    phrases: [
      { phrase: "service titan", strength: "strong" },
      { phrase: "fieldpulse", strength: "strong" },
      { phrase: "housecall pro", strength: "strong" },
      { phrase: "jobber", strength: "moderate" },
      { phrase: "field service software", strength: "strong" },
      { phrase: "fsm", strength: "weak" },
    ],
    category: "field_service",
  },
  {
    signal_type: "crm_indicators",
    signal_value: "CRM indicators",
    phrases: [
      { phrase: "salesforce", strength: "strong" },
      { phrase: "hubspot", strength: "strong" },
      { phrase: "crm", strength: "moderate" },
    ],
    category: "technology",
  },
]

function observedFromEnrichment(
  ctx: GrowthCompanySignalContext,
  needle: string,
): string | null {
  const n = needle.toLowerCase()
  const hit = [
    ...ctx.observed_technology_signals,
    ...ctx.observed_crm_signals,
    ...ctx.observed_service_signals,
  ].find((s) => s.toLowerCase().includes(n))
  return hit ?? null
}

/** Evidence-only technology / operations patterns from observed text. */
export function detectTechnologySignals(ctx: GrowthCompanySignalContext): RawCompanySignalCandidate[] {
  const blob = companySignalContextBlob(ctx)
  const out: RawCompanySignalCandidate[] = []

  for (const rule of TECH_RULES) {
    const enrichmentHit = observedFromEnrichment(ctx, rule.phrases[0]!.phrase)
    const match = enrichmentHit ? { phrase: enrichmentHit, strength: "strong" as const } : matchPhrase(blob, rule.phrases)

    if (!match) continue

    const source_field = enrichmentHit
      ? "enrichment.observed_signals"
      : rule.phrases.some((p) => blob.includes(p.phrase.toLowerCase()))
        ? "company_record.text"
        : "company_record.text"

    out.push({
      signal_category: rule.category,
      signal_type: rule.signal_type,
      signal_value: rule.signal_value,
      tier: "observed",
      claim: rule.signal_value,
      evidence: enrichmentHit
        ? `Observed enrichment signal: "${enrichmentHit}".`
        : `Matched phrase "${match.phrase}" in company industry/category/description fields.`,
      source_field,
      pattern_strength: match.strength,
    })
  }

  return out
}

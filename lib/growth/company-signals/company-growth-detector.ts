import type { RawCompanySignalCandidate } from "@/lib/growth/company-signals/company-signal-normalizer"
import {
  companySignalContextBlob,
  matchPhrase,
  type GrowthCompanySignalContext,
} from "@/lib/growth/company-signals/company-signal-context"

const GROWTH_RULES: Array<{
  signal_type: string
  signal_value: string
  phrases: Array<{ phrase: string; strength?: "strong" | "moderate" | "weak" }>
}> = [
  {
    signal_type: "hiring_activity",
    signal_value: "Hiring activity",
    phrases: [
      { phrase: "hiring", strength: "strong" },
      { phrase: "careers", strength: "moderate" },
      { phrase: "join our team", strength: "moderate" },
    ],
  },
  {
    signal_type: "growth_indicators",
    signal_value: "Growth indicators",
    phrases: [
      { phrase: "expanding", strength: "moderate" },
      { phrase: "growth", strength: "weak" },
      { phrase: "scaling", strength: "moderate" },
    ],
  },
  {
    signal_type: "digital_maturity_indicators",
    signal_value: "Digital maturity indicators",
    phrases: [
      { phrase: "online booking", strength: "strong" },
      { phrase: "customer portal", strength: "strong" },
      { phrase: "digital", strength: "weak" },
    ],
  },
]

/** Evidence-only growth / staffing / digital presence signals. */
export function detectGrowthSignals(ctx: GrowthCompanySignalContext): RawCompanySignalCandidate[] {
  const blob = companySignalContextBlob(ctx)
  const out: RawCompanySignalCandidate[] = []

  for (const rule of GROWTH_RULES) {
    const match = matchPhrase(blob, rule.phrases)
    if (!match) continue
    const category =
      rule.signal_type === "hiring_activity"
        ? "staffing"
        : rule.signal_type === "digital_maturity_indicators"
          ? "digital_presence"
          : "growth"

    out.push({
      signal_category: category,
      signal_type: rule.signal_type,
      signal_value: rule.signal_value,
      tier: "observed",
      claim: rule.signal_value,
      evidence: `Matched phrase "${match.phrase}" in observed company text.`,
      source_field: "company_record.text",
      pattern_strength: match.strength,
    })
  }

  if (ctx.website && ctx.domain) {
    out.push({
      signal_category: "digital_presence",
      signal_type: "website_observed",
      signal_value: "Website observed",
      tier: "observed",
      claim: "Company website on record",
      evidence: `Website ${ctx.website} present on discovery record.`,
      source_field: "company_record.website",
      pattern_strength: "strong",
    })
  }

  return out
}

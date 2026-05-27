import type { RawCompanySignalCandidate } from "@/lib/growth/company-signals/company-signal-normalizer"
import {
  companySignalContextBlob,
  matchPhrase,
  type GrowthCompanySignalContext,
} from "@/lib/growth/company-signals/company-signal-context"

const OPERATIONAL_RULES: Array<{
  signal_type: string
  signal_value: string
  signal_category: RawCompanySignalCandidate["signal_category"]
  phrases: Array<{ phrase: string; strength?: "strong" | "moderate" | "weak" }>
}> = [
  {
    signal_type: "dispatch_workflow_indicators",
    signal_value: "Dispatch workflow indicators",
    signal_category: "operations",
    phrases: [
      { phrase: "dispatch", strength: "moderate" },
      { phrase: "dispatcher", strength: "moderate" },
    ],
  },
  {
    signal_type: "service_scheduling_indicators",
    signal_value: "Service scheduling indicators",
    signal_category: "operations",
    phrases: [
      { phrase: "scheduling", strength: "moderate" },
      { phrase: "appointment", strength: "weak" },
      { phrase: "route", strength: "weak" },
    ],
  },
  {
    signal_type: "equipment_management_indicators",
    signal_value: "Equipment management indicators",
    signal_category: "operations",
    phrases: [
      { phrase: "equipment", strength: "moderate" },
      { phrase: "asset tracking", strength: "strong" },
      { phrase: "preventive maintenance", strength: "moderate" },
    ],
  },
  {
    signal_type: "mobile_workforce_indicators",
    signal_value: "Mobile workforce indicators",
    signal_category: "operations",
    phrases: [
      { phrase: "mobile", strength: "weak" },
      { phrase: "technician app", strength: "strong" },
      { phrase: "field technician", strength: "moderate" },
    ],
  },
]

const SERVICE_MODEL_RULES: Array<{
  signal_type: string
  signal_value: string
  signal_category: RawCompanySignalCandidate["signal_category"]
  phrases: Array<{ phrase: string; strength?: "strong" | "moderate" | "weak" }>
}> = [
  {
    signal_type: "commercial_service_indicators",
    signal_value: "Commercial service indicators",
    signal_category: "service_model",
    phrases: [
      { phrase: "commercial", strength: "moderate" },
      { phrase: "b2b", strength: "moderate" },
      { phrase: "enterprise", strength: "weak" },
    ],
  },
  {
    signal_type: "medical_equipment_indicators",
    signal_value: "Medical equipment indicators",
    signal_category: "service_model",
    phrases: [
      { phrase: "medical equipment", strength: "strong" },
      { phrase: "biomedical", strength: "strong" },
      { phrase: "imaging", strength: "moderate" },
      { phrase: "hospital", strength: "weak" },
    ],
  },
  {
    signal_type: "contractor_indicators",
    signal_value: "Contractor indicators",
    signal_category: "service_model",
    phrases: [
      { phrase: "contractor", strength: "moderate" },
      { phrase: "hvac", strength: "moderate" },
      { phrase: "plumbing", strength: "moderate" },
      { phrase: "electrical service", strength: "moderate" },
    ],
  },
  {
    signal_type: "emergency_service_indicators",
    signal_value: "Emergency service indicators",
    signal_category: "operations",
    phrases: [
      { phrase: "24/7", strength: "strong" },
      { phrase: "emergency", strength: "moderate" },
      { phrase: "on-call", strength: "moderate" },
    ],
  },
  {
    signal_type: "multi_location_indicators",
    signal_value: "Multi-location indicators",
    signal_category: "operations",
    phrases: [
      { phrase: "multi-location", strength: "strong" },
      { phrase: "multiple locations", strength: "strong" },
      { phrase: "branches", strength: "weak" },
    ],
  },
]

/** Evidence-only operational / service model signals. */
export function detectOperationalSignals(ctx: GrowthCompanySignalContext): RawCompanySignalCandidate[] {
  const blob = companySignalContextBlob(ctx)
  const out: RawCompanySignalCandidate[] = []

  for (const rule of [...OPERATIONAL_RULES, ...SERVICE_MODEL_RULES]) {
    const match = matchPhrase(blob, rule.phrases)
    if (!match) continue
    out.push({
      signal_category: rule.signal_category,
      signal_type: rule.signal_type,
      signal_value: rule.signal_value,
      tier: "observed",
      claim: rule.signal_value,
      evidence: `Matched phrase "${match.phrase}" in observed company text (no assumption beyond source fields).`,
      source_field: "company_record.text",
      pattern_strength: match.strength,
    })
  }

  if (ctx.review_count != null && ctx.review_count >= 50) {
    out.push({
      signal_category: "digital_presence",
      signal_type: "review_volume_observed",
      signal_value: `Review volume observed (${ctx.review_count})`,
      tier: "observed",
      claim: "Established digital presence",
      evidence: `Public listing shows ${ctx.review_count} reviews (observed count only).`,
      source_field: "company_record.review_count",
      pattern_strength: "moderate",
    })
  }

  return out
}

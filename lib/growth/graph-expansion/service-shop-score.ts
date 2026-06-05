/** Phase 7.PS-IG — Service-shop fit scoring for batch cohort selection. Client-safe. */

export const GROWTH_SERVICE_SHOP_SCORE_QA_MARKER = "growth-service-shop-score-7-ps-ig-v1" as const

export type ServiceShopScoreSignal = {
  label: string
  weight: number
}

export type ServiceShopScoreResult = {
  score: number
  tier: "high" | "medium" | "low"
  up_signals: ServiceShopScoreSignal[]
  down_signals: ServiceShopScoreSignal[]
  down_ranked: boolean
  down_rank_reason: string | null
}

const UP_RULES: Array<{ label: string; weight: number; re: RegExp }> = [
  { label: "biomedical_repair", weight: 20, re: /\bbiomed(ical)?[\s-]*repair\b/i },
  { label: "biomedical_service", weight: 20, re: /\bbiomed(ical)?[\s-]*service/i },
  { label: "biomedical_core", weight: 18, re: /\bbiomed(ical)?\b/i },
  { label: "equipment_repair", weight: 16, re: /\b(repair|service).{0,24}\bequipment\b|\bequipment.{0,24}\b(repair|service)\b/i },
  { label: "medical_equipment_service", weight: 16, re: /\bmedical equipment\b/i },
  { label: "htm_service", weight: 15, re: /\b(htm|healthcare technology management)\b/i },
  { label: "calibration", weight: 12, re: /\bcalibrat(ion|e|ing)\b/i },
  { label: "field_service", weight: 12, re: /\bfield\s+service\b/i },
  { label: "technician", weight: 12, re: /\b(biomed|clinical|service).{0,20}technician/i },
  { label: "repair_service", weight: 12, re: /\brepair\b/i },
  { label: "independent_local", weight: 10, re: /\b(local|independent|family owned|owner)\b/i },
  { label: "owner_operated_language", weight: 14, re: /\b(&\s*sons|family|owner.?operat)/i },
]

const DOWN_RULES: Array<{ label: string; weight: number; re: RegExp; down_rank?: boolean }> = [
  { label: "national_dme_chain", weight: 30, re: /\b(lincare|apria|adapthealth|rotech|numotion|viemed)\b/i, down_rank: true },
  { label: "national_dme_chain", weight: 25, re: /\b(national biomedical|norco.?inc|cardinal health)\b/i, down_rank: true },
  { label: "home_medical_supply_only", weight: 22, re: /\bhome medical (equipment|supply)\b/i, down_rank: true },
  { label: "medical_supply_only", weight: 18, re: /\b(medical supply|medical equipment supplier)\b/i, down_rank: true },
  { label: "food_equipment", weight: 24, re: /\bfood equipment\b/i, down_rank: true },
  { label: "distributor_only", weight: 20, re: /\b(distributor|distribution only|wholesale only)\b/i, down_rank: true },
  { label: "large_corporate_chain", weight: 15, re: /\b(holdings|international|worldwide|enterprise)\b/i },
  { label: "equipment_sales_only", weight: 16, re: /\b(equipment sales|sales only)\b/i, down_rank: true },
]

const SERVICE_REPAIR_GUARD = /\b(repair|service|maintenance|calibrat|technician|field)\b/i

function normalizeHaystack(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function scoreServiceShopFit(input: {
  company_name: string
  industry?: string | null
  source_tags?: string[]
  website?: string | null
  domain?: string | null
  anchor_bonus?: boolean
}): ServiceShopScoreResult {
  const haystack = normalizeHaystack([
    input.company_name,
    input.industry,
    ...(input.source_tags ?? []),
    input.website,
    input.domain,
  ])

  const up_signals: ServiceShopScoreSignal[] = []
  const down_signals: ServiceShopScoreSignal[] = []
  let score = input.anchor_bonus ? 55 : 0

  for (const rule of UP_RULES) {
    if (rule.re.test(haystack)) {
      score += rule.weight
      up_signals.push({ label: rule.label, weight: rule.weight })
    }
  }

  let down_ranked = false
  let down_rank_reason: string | null = null

  for (const rule of DOWN_RULES) {
    if (!rule.re.test(haystack)) continue
    if (rule.label === "equipment_sales_only" && SERVICE_REPAIR_GUARD.test(haystack)) continue
    if (rule.label === "medical_supply_only" && SERVICE_REPAIR_GUARD.test(haystack)) continue
    if (
      rule.label === "home_medical_supply_only" &&
      SERVICE_REPAIR_GUARD.test(haystack) &&
      !/\bhome medical (equipment|supply)\b/i.test(input.company_name)
    ) {
      continue
    }

    score -= rule.weight
    down_signals.push({ label: rule.label, weight: -rule.weight })
    if (rule.down_rank) {
      down_ranked = true
      down_rank_reason = rule.label
    }
  }

  score = Math.max(0, Math.min(100, score))

  const tier: ServiceShopScoreResult["tier"] =
    score >= 50 ? "high" : score >= 25 ? "medium" : "low"

  return {
    score,
    tier,
    up_signals,
    down_signals,
    down_ranked,
    down_rank_reason,
  }
}

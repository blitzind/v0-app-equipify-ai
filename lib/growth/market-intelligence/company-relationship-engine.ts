/** Deterministic company relationship detection. Client-safe. */

import type {
  GrowthCompanyRelationship,
  GrowthCompanyRelationshipType,
} from "@/lib/growth/market-intelligence/market-intelligence-types"

export type RelationshipCompanyInput = {
  company_id: string
  company_name: string
  industry?: string | null
  state?: string | null
  city?: string | null
  lead_engine_score?: number | null
  growth_signal_score?: number | null
  crm_detected?: string | null
  field_service_software?: string | null
  employees?: string | null
  signal_types?: string[]
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function employeeBand(value: string | null | undefined): string | null {
  const n = Number((value ?? "").replace(/[^\d]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  if (n <= 25) return "1-25"
  if (n <= 100) return "26-100"
  if (n <= 250) return "101-250"
  return "250+"
}

function addRelationship(
  map: Map<string, GrowthCompanyRelationship>,
  input: {
    company_id: string
    related: RelationshipCompanyInput
    relationship_type: GrowthCompanyRelationshipType
    strength: number
    evidence_excerpt: string
  },
) {
  if (input.company_id === input.related.company_id) return
  const key = `${input.related.company_id}:${input.relationship_type}`
  const existing = map.get(key)
  if (existing && existing.relationship_strength >= input.strength) return
  map.set(key, {
    id: key,
    company_id: input.company_id,
    related_company_id: input.related.company_id,
    related_company_name: input.related.company_name,
    relationship_type: input.relationship_type,
    relationship_strength: Math.max(0, Math.min(100, input.strength)),
    evidence_excerpt: input.evidence_excerpt,
  })
}

export function buildCompanyRelationships(
  anchor: RelationshipCompanyInput,
  pool: RelationshipCompanyInput[],
  limit = 5,
): GrowthCompanyRelationship[] {
  const map = new Map<string, GrowthCompanyRelationship>()
  const anchorIndustry = normalize(anchor.industry)
  const anchorState = normalize(anchor.state)
  const anchorCity = normalize(anchor.city)
  const anchorBand = employeeBand(anchor.employees)
  const anchorTech = normalize(anchor.field_service_software ?? anchor.crm_detected)
  const anchorScore = anchor.lead_engine_score ?? 0
  const anchorSignals = new Set(anchor.signal_types ?? [])

  for (const related of pool) {
    if (related.company_id === anchor.company_id) continue

    if (anchorIndustry && normalize(related.industry) === anchorIndustry) {
      addRelationship(map, {
        company_id: anchor.company_id,
        related,
        relationship_type: "same_industry",
        strength: 72,
        evidence_excerpt: `Same industry: ${anchor.industry}`,
      })
    }

    if (anchorState && normalize(related.state) === anchorState) {
      const sameCity = anchorCity && normalize(related.city) === anchorCity
      addRelationship(map, {
        company_id: anchor.company_id,
        related,
        relationship_type: sameCity ? "same_geo" : "same_market",
        strength: sameCity ? 84 : 68,
        evidence_excerpt: sameCity
          ? `Same city and state: ${related.city}, ${related.state}`
          : `Same state market: ${related.state?.toUpperCase()}`,
      })
    }

    const relatedTech = normalize(related.field_service_software ?? related.crm_detected)
    if (anchorTech && relatedTech && anchorTech === relatedTech) {
      addRelationship(map, {
        company_id: anchor.company_id,
        related,
        relationship_type: "shared_technology",
        strength: 80,
        evidence_excerpt: `Shared technology indicator: ${anchor.field_service_software ?? anchor.crm_detected}`,
      })
      if (["servicetitan", "housecall pro", "jobber", "fieldpulse"].some((name) => anchorTech.includes(name.replace(/\s+/g, "")))) {
        addRelationship(map, {
          company_id: anchor.company_id,
          related,
          relationship_type: "competitive_overlap",
          strength: 76,
          evidence_excerpt: `Competitive stack overlap: ${anchor.field_service_software ?? anchor.crm_detected}`,
        })
      }
    }

    const relatedScore = related.lead_engine_score ?? 0
    if (Math.abs(anchorScore - relatedScore) <= 12 && anchorScore >= 55) {
      addRelationship(map, {
        company_id: anchor.company_id,
        related,
        relationship_type: "similar_icp",
        strength: 70,
        evidence_excerpt: `Similar ICP fit scores (${anchorScore} vs ${relatedScore})`,
      })
    }

    const relatedBand = employeeBand(related.employees)
    if (anchorBand && relatedBand && anchorBand === relatedBand) {
      addRelationship(map, {
        company_id: anchor.company_id,
        related,
        relationship_type: "similar_size",
        strength: 62,
        evidence_excerpt: `Similar employee band: ${anchorBand}`,
      })
    }

    const sharedSignals = (related.signal_types ?? []).filter((signal) => anchorSignals.has(signal))
    if (sharedSignals.length > 0) {
      addRelationship(map, {
        company_id: anchor.company_id,
        related,
        relationship_type: "shared_signal_patterns",
        strength: 66 + Math.min(20, sharedSignals.length * 5),
        evidence_excerpt: `Shared growth signals: ${sharedSignals.slice(0, 3).join(", ")}`,
      })
    }
  }

  return [...map.values()]
    .sort((a, b) => b.relationship_strength - a.relationship_strength)
    .slice(0, limit)
}

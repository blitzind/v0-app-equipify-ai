/** Phase 7.PS-IF — ICP fit evaluation for batch graph expansion. Client-safe. */

import { GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS } from "@/lib/growth/graph-expansion/canonical-graph-materialization-types"
import type { BatchIcpFitDecision } from "@/lib/growth/graph-expansion/batch-icp-filter-types"

export const BATCH_ICP_INCLUDE_LABELS = [
  "biomedical",
  "medical_equipment_repair",
  "htm",
  "clinical_engineering",
  "biomedical_equipment_service",
  "dme_service_repair",
  "biomed_service",
] as const

export const BATCH_ICP_EXCLUDE_LABELS = [
  "construction",
  "remodeling",
  "food_equipment",
  "general_contracting",
  "specialty_contractor",
  "off_icp_contracting",
] as const

const INCLUDE_PATTERNS: Array<{ label: (typeof BATCH_ICP_INCLUDE_LABELS)[number]; re: RegExp }> = [
  { label: "biomedical", re: /\bbiomed(ical)?\b/i },
  { label: "medical_equipment_repair", re: /\bmedical equipment repair\b/i },
  { label: "htm", re: /\b(htm|healthcare technology management)\b/i },
  { label: "clinical_engineering", re: /\bclinical engineering\b/i },
  { label: "biomedical_equipment_service", re: /\bbiomedical equipment service\b/i },
  { label: "biomed_service", re: /\bbiomed(ical)?\s+(repair|service|maintenance|field)\b/i },
  {
    label: "medical_equipment_repair",
    re: /\bmedical equipment\s+(repair|service|maintenance|field)\b/i,
  },
  ...GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS.map((pattern) => ({
    label: "biomedical" as const,
    re: new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  })),
]

const EXCLUDE_PATTERNS: Array<{ label: (typeof BATCH_ICP_EXCLUDE_LABELS)[number]; re: RegExp }> = [
  { label: "construction", re: /\bconstruction\b/i },
  { label: "remodeling", re: /\bremodel(ing|ers?)\b/i },
  { label: "food_equipment", re: /\bfood equipment\b/i },
  { label: "general_contracting", re: /\bgeneral contract(ing|ors?)\b/i },
  { label: "specialty_contractor", re: /\bspecialty contract(ing|ors?)\b/i },
  { label: "off_icp_contracting", re: /\bcontracting\b/i },
]

const DME_PATTERN = /\b(durable medical equipment|dme)\b/i
const DME_SERVICE_PATTERN = /\b(repair|service|maintenance|field service)\b/i

function normalizeText(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function evaluateBatchIcpFit(input: {
  company_name: string
  industry?: string | null
  source_tags?: string[]
  website?: string | null
  domain?: string | null
}): {
  decision: BatchIcpFitDecision
  icp_match_reason: string | null
  exclusion_reason: string | null
} {
  const haystack = normalizeText([
    input.company_name,
    input.industry,
    ...(input.source_tags ?? []),
    input.website,
    input.domain,
  ])

  if (!haystack) {
    return {
      decision: "excluded",
      icp_match_reason: null,
      exclusion_reason: "missing_company_signals",
    }
  }

  for (const rule of EXCLUDE_PATTERNS) {
    if (!rule.re.test(haystack)) continue
    const hasBiomedOverride = INCLUDE_PATTERNS.some((include) => include.re.test(haystack))
    if (hasBiomedOverride && rule.label !== "specialty_contractor") continue
    if (rule.label === "off_icp_contracting" && hasBiomedOverride) continue
    return {
      decision: "excluded",
      icp_match_reason: null,
      exclusion_reason: rule.label,
    }
  }

  for (const rule of INCLUDE_PATTERNS) {
    if (rule.re.test(haystack)) {
      return {
        decision: "qualified",
        icp_match_reason: rule.label,
        exclusion_reason: null,
      }
    }
  }

  if (DME_PATTERN.test(haystack) && DME_SERVICE_PATTERN.test(haystack)) {
    return {
      decision: "qualified",
      icp_match_reason: "dme_service_repair",
      exclusion_reason: null,
    }
  }

  return {
    decision: "excluded",
    icp_match_reason: null,
    exclusion_reason: "no_icp_industry_match",
  }
}

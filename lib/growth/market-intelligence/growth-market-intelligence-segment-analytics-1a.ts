/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Segment outcome analytics (client-safe). */

import { inferIndustry } from "@/lib/growth/memory/events/record-memory-event"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  MarketIntelligenceSegmentDimension,
  MarketIntelligenceSegmentMetrics,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

type SegmentBucket = {
  researched: number
  admitted: number
  qualified: number
  meetings: number
  approvals: number
  opportunities: number
  won: number
  lost: number
  retained: number
  expansion: number
  churn: number
  lifetimeValue: number | null
}

function emptyBucket(): SegmentBucket {
  return {
    researched: 0,
    admitted: 0,
    qualified: 0,
    meetings: 0,
    approvals: 0,
    opportunities: 0,
    won: 0,
    lost: 0,
    retained: 0,
    expansion: 0,
    churn: 0,
    lifetimeValue: null,
  }
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function resolveLeadIndustry(lead: GrowthLead): string {
  const fromMetadata = readMetadataString(lead.metadata, "industry")
  if (fromMetadata) return fromMetadata
  return inferIndustry(lead.companyName)
}

function segmentKeyForLead(
  lead: GrowthLead,
  dimension: MarketIntelligenceSegmentDimension,
): { key: string; label: string } | null {
  switch (dimension) {
    case "industry":
      return { key: resolveLeadIndustry(lead), label: resolveLeadIndustry(lead).replace(/_/g, " ") }
    case "naics": {
      const naics =
        readMetadataString(lead.metadata, "naics_code") ??
        readMetadataString(lead.metadata, "naicsCode")
      return naics ? { key: naics, label: `NAICS ${naics}` } : null
    }
    case "sic": {
      const sic = readMetadataString(lead.metadata, "sic_code")
      return sic ? { key: sic, label: `SIC ${sic}` } : null
    }
    case "company_size": {
      const size = lead.estimatedEmployeeCount ?? readMetadataString(lead.metadata, "employee_count")
      return size ? { key: size, label: size } : null
    }
    case "persona": {
      const persona =
        readMetadataString(lead.metadata, "buyer_persona") ??
        readMetadataString(lead.metadata, "decision_maker_role")
      return persona ? { key: persona.toLowerCase(), label: persona } : null
    }
    case "technology": {
      const tech = lead.fieldServiceStackDetected ?? lead.crmDetected
      return tech ? { key: tech.toLowerCase(), label: tech } : null
    }
    case "service_type": {
      const service = readMetadataString(lead.metadata, "service_type")
      return service ? { key: service.toLowerCase(), label: service } : null
    }
    case "region": {
      const region = lead.state ?? lead.country
      return region ? { key: region.toUpperCase(), label: region } : null
    }
    default:
      return null
  }
}

function applyLeadToBucket(bucket: SegmentBucket, lead: GrowthLead): void {
  const status = lead.status?.trim().toLowerCase() ?? ""
  const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)

  if (lead.lastResearchedAt || lead.lastProspectResearchedAt || status === "researching" || status === "enriched") {
    bucket.researched += 1
  }
  if (admission === "accepted") bucket.admitted += 1
  if (status === "qualified") bucket.qualified += 1
  if ((lead.engagementTopSignals ?? []).some((signal) => /meeting|booked|calendar/i.test(signal.label))) {
    bucket.meetings += 1
  }
  if (readMetadataString(lead.metadata, "approval_pending") === "true") bucket.approvals += 1
  if (lead.opportunityReadinessTier || (lead.opportunityTopSignals ?? []).length > 0) bucket.opportunities += 1
  if (readMetadataString(lead.metadata, "opportunity_stage") === "closed_won") bucket.won += 1
  if (readMetadataString(lead.metadata, "opportunity_stage") === "closed_lost") bucket.lost += 1
  if (readMetadataString(lead.metadata, "customer_health") === "expansion_candidate") bucket.expansion += 1
  if (readMetadataString(lead.metadata, "customer_health") === "churn_risk") bucket.churn += 1
  if (readMetadataString(lead.metadata, "customer_status") === "active") bucket.retained += 1
}

function bucketToMetrics(
  dimension: MarketIntelligenceSegmentDimension,
  key: string,
  label: string,
  bucket: SegmentBucket,
): MarketIntelligenceSegmentMetrics {
  return {
    dimension,
    segmentKey: key,
    segmentLabel: label,
    researched: bucket.researched,
    admitted: bucket.admitted,
    qualified: bucket.qualified,
    meetings: bucket.meetings,
    approvals: bucket.approvals,
    opportunities: bucket.opportunities,
    won: bucket.won,
    lost: bucket.lost,
    retained: bucket.retained,
    expansion: bucket.expansion,
    churn: bucket.churn,
    lifetimeValue: bucket.lifetimeValue,
    researchRate: rate(bucket.researched, bucket.researched),
    admissionRate: rate(bucket.admitted, bucket.researched),
    qualificationRate: rate(bucket.qualified, bucket.researched),
    meetingRate: rate(bucket.meetings, bucket.qualified),
    approvalRate: rate(bucket.approvals, bucket.researched),
    opportunityRate: rate(bucket.opportunities, bucket.qualified),
    winRate: rate(bucket.won, bucket.opportunities),
    retentionRate: rate(bucket.retained, bucket.won + bucket.retained),
    expansionRate: rate(bucket.expansion, bucket.retained),
  }
}

export function buildMarketIntelligenceSegmentMetrics(input: {
  leads: GrowthLead[]
  salesOutcomes?: SalesOutcome[]
  dimensions?: MarketIntelligenceSegmentDimension[]
}): MarketIntelligenceSegmentMetrics[] {
  const dimensions = input.dimensions ?? ["industry", "region", "company_size", "persona"]
  const results: MarketIntelligenceSegmentMetrics[] = []

  for (const dimension of dimensions) {
    const buckets = new Map<string, { label: string; bucket: SegmentBucket }>()

    for (const lead of input.leads) {
      const segment = segmentKeyForLead(lead, dimension)
      if (!segment) continue
      const entry = buckets.get(segment.key) ?? { label: segment.label, bucket: emptyBucket() }
      applyLeadToBucket(entry.bucket, lead)
      buckets.set(segment.key, entry)
    }

    for (const outcome of input.salesOutcomes ?? []) {
      if (dimension !== "industry") continue
      const key = inferIndustry(outcome.summary)
      const entry = buckets.get(key) ?? { label: key.replace(/_/g, " "), bucket: emptyBucket() }
      if (outcome.outcome_type === "research_completed") entry.bucket.researched += 1
      if (outcome.outcome_type === "qualification_completed") entry.bucket.qualified += 1
      if (outcome.outcome_type === "meeting_prepared") entry.bucket.meetings += 1
      if (outcome.outcome_type === "approval_pending" || outcome.approval_required) {
        entry.bucket.approvals += 1
      }
      buckets.set(key, entry)
    }

    for (const [key, entry] of buckets.entries()) {
      if (entry.bucket.researched === 0 && entry.bucket.qualified === 0 && entry.bucket.meetings === 0) {
        continue
      }
      results.push(bucketToMetrics(dimension, key, entry.label, entry.bucket))
    }
  }

  return results.sort((left, right) => right.qualified - left.qualified || right.researched - left.researched)
}

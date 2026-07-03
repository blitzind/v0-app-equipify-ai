/** GE-OPPORTUNITY-INTELLIGENCE-1A — Wrapped field helpers for partial intelligence rendering. Client-safe. */

import type { OpportunityIntelligenceSource } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-sources"

export type OpportunityIntelligenceField<T> = {
  available: boolean
  source: OpportunityIntelligenceSource | null
  computedAt: string | null
  value: T | null
}

export function unavailableOpportunityIntelligenceField<T>(): OpportunityIntelligenceField<T> {
  return {
    available: false,
    source: null,
    computedAt: null,
    value: null,
  }
}

export function availableOpportunityIntelligenceField<T>(input: {
  source: OpportunityIntelligenceSource
  computedAt: string | null
  value: T
}): OpportunityIntelligenceField<T> {
  return {
    available: true,
    source: input.source,
    computedAt: input.computedAt,
    value: input.value,
  }
}

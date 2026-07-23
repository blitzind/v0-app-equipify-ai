/**
 * AVA-GROWTH-OPERATOR-1B — Gate recommendation surfaces through canonical authority.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  buildCanonicalOpportunityAuthorityFromResolution,
  type GrowthCanonicalOpportunityAuthority,
} from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import { parseLeadIdFromHref } from "@/lib/growth/relationship/parse-relationship-graph-refs"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"
import type { GrowthHomeDailyWorkQueueItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export const GROWTH_RECOMMENDATION_AUTHORITY_GATE_1B_QA_MARKER =
  "ava-growth-operator-1b-recommendation-authority-gate-v1" as const

export function buildCanonicalRecommendationAuthorityContext(input: {
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
  canonicalAuthorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null
}): {
  authority: GrowthCanonicalOpportunityAuthority | null
  authoritativeLeadIds: Set<string>
  authoritativeFingerprints: Set<string>
} {
  const fromMap = buildCanonicalRecommendationAuthorityContextFromMap({
    canonicalAuthorityByLeadId: input.canonicalAuthorityByLeadId,
    canonicalHeroDecision: input.canonicalHeroDecision,
  })
  if (fromMap.authoritativeLeadIds.size > 0) return fromMap

  const resolution = input.canonicalHeroDecision
  if (!resolution) {
    return {
      authority: null,
      authoritativeLeadIds: new Set(),
      authoritativeFingerprints: new Set(),
    }
  }

  const authority = buildCanonicalOpportunityAuthorityFromResolution(resolution)
  return {
    authority,
    authoritativeLeadIds: new Set([resolution.leadId]),
    authoritativeFingerprints: new Set([resolution.decision.decisionFingerprint]),
  }
}

export function buildCanonicalRecommendationAuthorityContextFromMap(input: {
  canonicalAuthorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null
  canonicalHeroDecision?: GrowthCanonicalDecisionResolution | null
}): {
  authority: GrowthCanonicalOpportunityAuthority | null
  authoritativeLeadIds: Set<string>
  authoritativeFingerprints: Set<string>
} {
  const map = input.canonicalAuthorityByLeadId ?? {}
  const leadIds = Object.keys(map)
  const fingerprints = new Set<string>()

  for (const leadId of leadIds) {
    const row = map[leadId]
    if (row?.decisionFingerprint) fingerprints.add(row.decisionFingerprint)
  }

  const heroAuthority = input.canonicalHeroDecision
    ? buildCanonicalOpportunityAuthorityFromResolution(input.canonicalHeroDecision)
    : null

  return {
    authority: heroAuthority ?? (leadIds[0] ? map[leadIds[0]] ?? null : null),
    authoritativeLeadIds: new Set(leadIds),
    authoritativeFingerprints: fingerprints,
  }
}

export function shouldSuppressCompetingRecommendation(input: {
  leadId?: string | null
  href?: string | null
  sourceLabel?: string | null
  authoritativeLeadIds: Set<string>
}): boolean {
  const leadId = input.leadId ?? parseLeadIdFromHref(input.href)
  if (!leadId || !input.authoritativeLeadIds.has(leadId)) return false

  const source = input.sourceLabel ?? ""
  return (
    source.startsWith("work_manager") ||
    source.startsWith("daily_revenue_work_queue") ||
    source.startsWith("decision_engine_10b")
  )
}

export function shouldSuppressWorkManagerQueueItem(
  row: AvaWorkItem,
  authoritativeLeadIds: Set<string>,
): boolean {
  const leadId = parseLeadIdFromHref(row.href)
  if (!leadId || !authoritativeLeadIds.has(leadId)) return false
  return row.authority_bound === true || row.type === "outreach" || row.type === "research"
}

export function shouldSuppressDailyQueueItem(
  row: GrowthHomeDailyWorkQueueItem,
  authoritativeLeadIds: Set<string>,
): boolean {
  const leadId = parseLeadIdFromHref(row.href)
  if (!leadId || !authoritativeLeadIds.has(leadId)) return false
  return /research|outreach|prepare|qualif/i.test(row.actionLabel)
}

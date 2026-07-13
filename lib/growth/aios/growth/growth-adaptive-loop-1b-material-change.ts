/**
 * GE-AIOS-ADAPTIVE-LOOP-1B — Canonical relationship material-change decision (client-safe).
 */

import type { AdaptiveProspectEventType } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import {
  ADAPTIVE_LOOP_1B_ALWAYS_MATERIAL_EVENT_TYPES,
  ADAPTIVE_LOOP_1B_CONDITIONAL_EVENT_TYPES,
  ADAPTIVE_LOOP_1B_NEVER_REBUILD_ALONE_SOURCES,
  type AdaptiveLoopNeverRebuildAloneSource,
  type RelationshipMaterialChangeContext,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-types"

export function isNeverRebuildAloneSource(
  source: string,
): source is AdaptiveLoopNeverRebuildAloneSource {
  return (ADAPTIVE_LOOP_1B_NEVER_REBUILD_ALONE_SOURCES as readonly string[]).includes(source)
}

export function isAlwaysMaterialRelationshipEvent(
  eventType: AdaptiveProspectEventType,
): boolean {
  return (ADAPTIVE_LOOP_1B_ALWAYS_MATERIAL_EVENT_TYPES as readonly string[]).includes(eventType)
}

export function isConditionalRelationshipEvent(
  eventType: AdaptiveProspectEventType,
): boolean {
  return (ADAPTIVE_LOOP_1B_CONDITIONAL_EVENT_TYPES as readonly string[]).includes(eventType)
}

export function evaluateConditionalRelationshipMateriality(
  eventType: AdaptiveProspectEventType,
  context: RelationshipMaterialChangeContext = {},
): boolean {
  switch (eventType) {
    case "ghosting":
      return true
    case "website_changes":
      return (context.strategyRelevantSignal ?? false) || (context.researchDeltaScore ?? 0) >= 0.35
    case "funding":
    case "acquisition":
      return (context.strategyRelevantSignal ?? false) || (context.researchDeltaScore ?? 0) >= 0.4
    case "organizational_changes":
    case "company_research_updated":
      return (
        (context.organizationalImpactScore ?? 0) >= 0.45 ||
        (context.researchDeltaScore ?? 0) >= 0.5 ||
        Boolean(context.strategyRelevantSignal)
      )
    case "contact_changed":
      return (context.organizationalImpactScore ?? 0) >= 0.35
    default:
      return false
  }
}

export function evaluateOutboundEngagementMateriality(
  eventType: "email_opened" | "link_clicked",
  context: RelationshipMaterialChangeContext = {},
): boolean {
  if (eventType === "email_opened") {
    return (context.priorEngagementOpens ?? 0) === 0 && Boolean(context.strategyRelevantSignal)
  }
  return (context.priorLinkClicks ?? 0) === 0 || Boolean(context.strategyRelevantSignal)
}

export function isRelationshipMaterialChange(input: {
  eventType: AdaptiveProspectEventType
  neverRebuildAloneSource?: string | null
  context?: RelationshipMaterialChangeContext
}): boolean {
  if (input.neverRebuildAloneSource && isNeverRebuildAloneSource(input.neverRebuildAloneSource)) {
    return false
  }
  if (isAlwaysMaterialRelationshipEvent(input.eventType)) {
    return true
  }
  if (isConditionalRelationshipEvent(input.eventType)) {
    return evaluateConditionalRelationshipMateriality(input.eventType, input.context)
  }
  return false
}

/** Phase GS-1B/GS-1C — Signal intelligence public exports. */

export {
  LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
  SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
  LEAD_SIGNAL_SOURCE_DOMAINS,
  LEAD_SIGNAL_TYPES,
  LEAD_SIGNAL_RECOMPUTE_SCOPES,
  LEAD_SIGNAL_ROUTE_ACTIONS,
  LEAD_SIGNAL_TYPE_SOURCE_DOMAIN,
  assertLeadSignalEventShape,
  type LeadSignalEvent,
  type LeadSignalEvidenceRef,
  type LeadSignalRecomputeScope,
  type LeadSignalRouteAction,
  type LeadSignalSourceDomain,
  type LeadSignalType,
  type LeadSignalUrgency,
  type RouteExternalSignalBatchResult,
  type RouteLeadSignalEventResult,
  type SignalQueueHint,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export {
  scoreLeadSignalEvent,
  applyLeadSignalScoringDefaults,
} from "@/lib/growth/signal-intelligence/signal-event-scoring"

export {
  externalSignalWeightPoints,
  externalSignalConfidenceFromWeight,
  externalSignalRoutingPriority,
  externalSignalCommandCenterBoost,
  externalSignalAttentionTier,
  EXTERNAL_SIGNAL_WEIGHT_POINTS,
} from "@/lib/growth/signal-intelligence/external-signal-scoring"

export {
  resolveSignalQueueHint,
  commandCenterLabelForSignalType,
  mergeSignalQueueHints,
} from "@/lib/growth/signal-intelligence/signal-queue-hints"

export {
  SIGNAL_INTELLIGENCE_EXECUTE_CONFIRM,
  SIGNAL_INTELLIGENCE_ROUTE_QA_MARKER,
  buildSignalIntelligenceReadinessPayload,
  assertSignalIntelligenceExecuteAllowed,
  isSignalIntelligenceEnabled,
  isSignalIntelligenceAcknowledged,
} from "@/lib/growth/signal-intelligence/signal-intelligence-route-gates"

export { buildLeadSignalDedupeHash } from "@/lib/growth/signal-intelligence/signal-event-dedupe"

export {
  buildReplyLeadSignalEvents,
  buildMeetingBookedLeadSignalEvent,
  buildMeetingCompletedLeadSignalEvent,
  buildMeetingNoShowLeadSignalEvent,
  buildOpportunityCreatedLeadSignalEvent,
  buildOpportunityStageAdvancedLeadSignalEvent,
  buildDealWonLeadSignalEvent,
  buildDealLostLeadSignalEvent,
} from "@/lib/growth/signal-intelligence/lead-signal-producers"

export {
  normalizeLeadSignalEvent,
  mapCompanyGrowthSignalType,
  mapSearchIntentCategory,
  mapPagePathToWebsiteIntentSignal,
  routeNormalizedExternalSignal,
  routeNormalizedExternalSignals,
  bridgeSearchIntentSignalRow,
  bridgeCompanyGrowthSignalRow,
  bridgeIntentPageviewEvent,
  isExternalSignalBridgeEnabled,
} from "@/lib/growth/signal-intelligence/external-signal-producers"

export { matchSignalToLead, type SignalLeadMatch, type SignalLeadMatchInput } from "@/lib/growth/signal-intelligence/signal-lead-matcher"

export { routeLeadSignalEvent, routeLeadSignalEvents } from "@/lib/growth/signal-intelligence/route-lead-signal-event"

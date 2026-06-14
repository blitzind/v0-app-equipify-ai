/** Phase GS-1B — Signal intelligence public exports (client-safe types + server router). */

export {
  LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
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
  type RouteLeadSignalEventResult,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export { scoreLeadSignalEvent, applyLeadSignalScoringDefaults } from "@/lib/growth/signal-intelligence/signal-event-scoring"

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

export { routeLeadSignalEvent, routeLeadSignalEvents } from "@/lib/growth/signal-intelligence/route-lead-signal-event"

/** Phase GE-HARDEN-2 — Synthetic dataset generators for performance simulation (client-safe). */

import { HUMAN_INTERVENTION_QA_MARKER } from "@/lib/growth/human-interventions/human-intervention-types"
import { OPERATOR_INBOX_QA_MARKER } from "@/lib/growth/operator-inbox/operator-inbox-types"
import { REALTIME_EVENTS_QA_MARKER } from "@/lib/growth/realtime-events/realtime-events-types"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"
import type { HumanIntervention, HumanInterventionType } from "@/lib/growth/human-interventions/human-intervention-types"
import type { OperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-types"
import type { GrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-types"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import type { CommandCenterAggregationContext } from "@/lib/growth/command-center-unification/command-center-unification-engine"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"

function mod(i: number, n: number): number {
  return i % n
}

export function simulateSignalFeedItems(count: number): GrowthSignalFeedItem[] {
  return Array.from({ length: count }, (_, i) => ({
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: `sim-signal-${i}`,
    audit_event_id: `sim-audit-${i}`,
    lead_id: `sim-lead-${mod(i, Math.min(count, 1000))}`,
    company_name: `Sim Co ${mod(i, 100)}`,
    signal_type: i % 3 === 0 ? "company_hiring" : "pricing_page_visit",
    signal_label: `Signal ${i}`,
    source_domain: "company",
    confidence: 0.5 + (i % 50) / 100,
    urgency: i % 5 === 0 ? "hot" : "medium",
    signal_score: 50 + mod(i, 50),
    occurred_at: new Date(Date.now() - i * 60_000).toISOString(),
    recommended_action: "Review signal",
    expected_impact: "Planning only",
    reasoning: "Simulated",
    priority: i % 7 === 0 ? "urgent" : "medium",
    status: "new",
    dedupe_hash: `hash-${mod(i, 200)}`,
    collapsed_count: 1,
    queue_hint: null,
    cta: { view_lead: null, review_company: null, open_timeline: null, review_sequence: null },
    requires_human_approval: true,
  }))
}

export function simulateInboxItems(count: number): OperatorInboxItem[] {
  const sources = ["signal", "reply_workflow", "inbox_thread", "human_approval"] as const
  return Array.from({ length: count }, (_, i) => ({
    qa_marker: OPERATOR_INBOX_QA_MARKER,
    item_id: `sim-inbox-${i}`,
    source: sources[mod(i, sources.length)]!,
    source_ref: `ref-${i}`,
    title: `Inbox item ${i}`,
    description: "Simulated inbox item",
    reasoning: ["Operator review required"],
    priority: i % 6 === 0 ? "urgent" : "medium",
    confidence: 60,
    lead_id: `sim-lead-${mod(i, Math.min(count, 1000))}`,
    company_name: `Sim Co ${mod(i, 100)}`,
    occurred_at: new Date(Date.now() - i * 30_000).toISOString(),
    cta_href: null,
    status: "new",
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }))
}

export function simulateInterventions(count: number): HumanIntervention[] {
  const types = ["reply_required", "high_intent", "campaign_blocked", "manual_review"] as const
  return Array.from({ length: count }, (_, i) => ({
    qa_marker: HUMAN_INTERVENTION_QA_MARKER,
    intervention_id: `sim-int-${i}`,
    intervention_type: types[mod(i, types.length)]!,
    priority: i % 5 === 0 ? "urgent" : "medium",
    title: `Intervention ${i}`,
    description: "Simulated intervention",
    trigger: {
      trigger_id: `trg-${i}`,
      trigger_type: "signal",
      reason: "Simulated",
      evidence: [],
      source_system: "signal_feed",
      source_ref: `ref-${i}`,
    },
    recommendations: [],
    supporting_context: [],
    related_entities: [],
    available_actions: [],
    resolution: { resolution_status: "pending", resolved_at: null, resolved_by: null },
    lead_id: `sim-lead-${mod(i, Math.min(count, 1000))}`,
    company_name: `Sim Co ${mod(i, 100)}`,
    occurred_at: new Date(Date.now() - i * 45_000).toISOString(),
    related_href: null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }))
}

export function simulateRealtimeEvents(count: number): GrowthRealtimeEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    event_id: `sim-event-${i}`,
    event_type: "signal_routed",
    source: "signal_feed",
    organization_id: "sim-org",
    lead_id: `sim-lead-${mod(i, Math.min(count, 1000))}`,
    title: `Event ${i}`,
    description: "Simulated realtime event",
    occurred_at: new Date(Date.now() - i * 20_000).toISOString(),
    delivery_status: i % 4 === 0 ? "pending" : "routed",
    review_status: "pending",
    routes: [],
    subscription_mode: "polling",
    related_href: null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }))
}

export function simulateAggregationContext(input: {
  signal_count: number
  inbox_count: number
  intervention_count: number
  event_count: number
  lead_id?: string
}): CommandCenterAggregationContext {
  const signals = simulateSignalFeedItems(input.signal_count)
  const inbox = simulateInboxItems(input.inbox_count)
  const interventions = simulateInterventions(input.intervention_count)
  const events = simulateRealtimeEvents(input.event_count)

  return {
    lead_id: input.lead_id ?? "sim-lead-0",
    company_name: "Simulated Scale Co",
    signal_feed: {
      qa_marker: SIGNAL_FEED_QA_MARKER,
      generated_at: new Date().toISOString(),
      total: signals.length,
      collapsed_from: signals.length,
      items: signals,
      hot_signals: signals.filter((s) => s.urgency === "hot").slice(0, 20),
    },
    operator_inbox: {
      qa_marker: OPERATOR_INBOX_QA_MARKER,
      generated_at: new Date().toISOString(),
      total: inbox.length,
      urgent_count: inbox.filter((i) => i.priority === "urgent").length,
      items: inbox,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    },
    interventions: {
      qa_marker: HUMAN_INTERVENTION_QA_MARKER,
      generated_at: new Date().toISOString(),
      total: interventions.length,
      urgent_count: interventions.filter((i) => i.priority === "urgent").length,
      type_counts: {
        reply_required: 0,
        campaign_blocked: 0,
        approval_required: 0,
        channel_issue: 0,
        high_intent: 0,
        risk_detected: 0,
        opportunity: 0,
        manual_review: 0,
      } satisfies Record<HumanInterventionType, number>,
      interventions,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    },
    realtime_events: {
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      generated_at: new Date().toISOString(),
      total: events.length,
      routed_count: events.filter((e) => e.delivery_status === "routed").length,
      pending_count: events.filter((e) => e.delivery_status === "pending").length,
      subscription_mode: "polling",
      events,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    },
    campaign_readiness: {
      qa_marker: CAMPAIGN_READINESS_QA_MARKER,
      assessment_id: "sim-readiness",
      subject_type: "prospect",
      subject_ref: input.lead_id ?? "sim-lead-0",
      lead_id: input.lead_id ?? "sim-lead-0",
      company_name: "Simulated Scale Co",
      execution_run_id: null,
      generated_at: new Date().toISOString(),
      readiness_score: 65,
      readiness_status: "partially_ready",
      dimensions: [],
      blockers: [],
      recommendations: [],
      missing_assets: [],
      missing_channels: [],
      required_approvals: ["Human review"],
      required_human_actions: [],
      review_status: "pending",
      requires_human_review: true,
      autonomous_execution_enabled: false,
    },
    sequence_pattern_count: 25,
  }
}

/** Map aggregation context to agent orchestration plan input. */
export function agentPlanInputFromAggregationContext(ctx: CommandCenterAggregationContext) {
  return {
    lead_id: ctx.lead_id ?? null,
    company_name: ctx.company_name ?? null,
    campaign_readiness: ctx.campaign_readiness ?? null,
    interventions: ctx.interventions?.interventions ?? [],
    inbox_items: ctx.operator_inbox?.items ?? [],
    realtime_events: ctx.realtime_events?.events ?? [],
    sequence_pattern_count: ctx.sequence_pattern_count ?? 0,
  }
}

/** Scale item counts per Apollo tier — deterministic ratios. */
export function apolloTierCounts(tier: number): {
  signals: number
  inbox: number
  interventions: number
  events: number
} {
  const ratio = tier / 1000
  return {
    signals: Math.min(Math.round(200 * ratio), 2000),
    inbox: Math.min(Math.round(50 * ratio), 500),
    interventions: Math.min(Math.round(30 * ratio), 300),
    events: Math.min(Math.round(100 * ratio), 1000),
  }
}

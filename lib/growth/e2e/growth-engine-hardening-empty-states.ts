/** Phase GE-HARDEN-3 — Standardized honest empty states (client-safe). */

import {
  GROWTH_ENGINE_HARDENING_QA_MARKER,
  type GrowthEngineEmptyStateKind,
} from "@/lib/growth/e2e/growth-engine-hardening-types"

export type GrowthEngineHonestEmptyStateConfig = {
  kind: GrowthEngineEmptyStateKind
  title: string
  message: string
  guidance: string[]
  read_only: true
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export const GROWTH_ENGINE_HONEST_EMPTY_STATE_QA_MARKER = GROWTH_ENGINE_HARDENING_QA_MARKER

const EMPTY_STATES: Record<GrowthEngineEmptyStateKind, GrowthEngineHonestEmptyStateConfig> = {
  no_leads: {
    kind: "no_leads",
    title: "No leads in scope",
    message: "Prospect discovery has not surfaced leads for this view yet.",
    guidance: [
      "Run a discovery search when ready — human review required before outreach.",
      "Check filters and ICP scope if you expected matches.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_signals: {
    kind: "no_signals",
    title: "No routed signals",
    message: "The signal feed has no routed events in the current window.",
    guidance: [
      "Signals appear after discovery, engagement, or scoring routes events.",
      "Review is planning-only — no autonomous outreach or enrollment.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_interventions: {
    kind: "no_interventions",
    title: "No human interventions",
    message: "No interventions require operator review for this filter.",
    guidance: ["Interventions surface when risk, intent, or blockers need human judgment."],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_recommendations: {
    kind: "no_recommendations",
    title: "No recommendations",
    message: "No actionable recommendations are available for this scope.",
    guidance: ["Recommendations are advisory only — operator approval required before execution."],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_events: {
    kind: "no_events",
    title: "No realtime events",
    message: "The event bus has no routed events for this filter.",
    guidance: [
      "Events route from signal feed, inbox, and subsystem audits.",
      "Polling fallback refreshes every 45s when subscriptions are unavailable.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_inbox_items: {
    kind: "no_inbox_items",
    title: "Operator inbox clear",
    message: "No inbox items matched this filter.",
    guidance: [
      "Items aggregate signals, replies, approvals, attention, and threads.",
      "Review and dismiss actions are human-gated — no autonomous execution.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_sequence_previews: {
    kind: "no_sequence_previews",
    title: "No sequence previews",
    message: "No sequence preview sessions matched this filter.",
    guidance: [
      "Previews are planning-only — enrollment and send remain disabled.",
      "Select a lead with campaign readiness to generate previews.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_campaign_builders: {
    kind: "no_campaign_builders",
    title: "No campaign builder sessions",
    message: "No campaign wizard sessions matched this filter.",
    guidance: ["Wizard output is advisory — human approval required before any launch."],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_agent_plans: {
    kind: "no_agent_plans",
    title: "No agent orchestration plans",
    message: "No orchestration plans matched this filter.",
    guidance: [
      "Plans coordinate subsystems only — no autonomous outreach or enrollment.",
      "Select a lead to generate a human-review orchestration plan.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_campaign_readiness: {
    kind: "no_campaign_readiness",
    title: "No campaign readiness assessment",
    message: "No readiness assessment is available for this lead.",
    guidance: ["Generate an assessment to review gaps before any outreach planning."],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_follow_up_policies: {
    kind: "no_follow_up_policies",
    title: "No follow-up policies",
    message: "No follow-up policies matched this filter.",
    guidance: ["Policies are advisory — no autonomous send, enroll, or scheduling."],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_playbooks: {
    kind: "no_playbooks",
    title: "No conversational playbooks",
    message: "No citation-backed playbook is available for this scope.",
    guidance: ["Ingest knowledge documents — playbooks are review-only, no auto-reply."],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
  no_command_center_items: {
    kind: "no_command_center_items",
    title: "No items in this view",
    message: "The unified workspace has no items for the selected filter.",
    guidance: [
      "Try another view or refresh — partial subsystem data may still load.",
      "Command Center aggregates all subsystems without blocking on failures.",
    ],
    read_only: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  },
}

export function buildGrowthEngineHonestEmptyState(
  kind: GrowthEngineEmptyStateKind,
): GrowthEngineHonestEmptyStateConfig {
  return EMPTY_STATES[kind]
}

export const GROWTH_ENGINE_EMPTY_STATE_KINDS = Object.keys(EMPTY_STATES) as GrowthEngineEmptyStateKind[]

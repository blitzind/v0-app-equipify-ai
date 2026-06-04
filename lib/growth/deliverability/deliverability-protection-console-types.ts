/** Client-safe types for the Deliverability Protection operational console (v2). */

import type { GrowthDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/reputation-protection-types"
import type { GrowthDeliverabilitySeverity } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export const GROWTH_DELIVERABILITY_OPS_V2_QA_MARKER = "growth-deliverability-ops-v2" as const
export const GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER =
  "growth-deliverability-widget-fallback-v1" as const
export const GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER =
  "growth-deliverability-degraded-mode-v1" as const
export const GROWTH_DELIVERABILITY_QUEUE_OPS_QA_MARKER = "growth-deliverability-queue-ops-v1" as const
export const GROWTH_DELIVERABILITY_SENDER_HEALTH_QA_MARKER =
  "growth-deliverability-sender-health-v1" as const

export const GROWTH_DELIVERABILITY_MAILBOX_HEALTH_INTEL_QA_MARKER =
  "growth-mailbox-health-intelligence-v1" as const
export const GROWTH_DELIVERABILITY_DNS_HEALTH_QA_MARKER = "growth-deliverability-dns-health-v1" as const

export const GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS = [
  "sender_health",
  "queue_ops",
  "reputation_protection",
  "dns_health",
  "sequence_safety",
] as const

export type GrowthDeliverabilityProtectionModuleId =
  (typeof GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS)[number]

export type GrowthDeliverabilityModuleStatus = "ok" | "empty" | "degraded" | "error"

export type GrowthDeliverabilityModuleError = {
  code: string
  message: string
  impact: string
  remediation: string
  retryable: boolean
}

export type GrowthDeliverabilityModuleResult<T> = {
  module_id: GrowthDeliverabilityProtectionModuleId
  status: GrowthDeliverabilityModuleStatus
  qa_marker: string
  data: T | null
  error: GrowthDeliverabilityModuleError | null
  last_success_at: string | null
  fetched_at: string
  still_available: string[]
}

export type GrowthDeliverabilityOpsAlert = {
  id: string
  severity: GrowthDeliverabilitySeverity
  title: string
  summary: string
  impact: string
  action_label: string
  action_href: string | null
  entity_labels: string[]
}

export type GrowthDeliverabilitySenderHealthModule = {
  summary: {
    total_mailboxes: number
    active_mailboxes: number
    paused_mailboxes: number
    warming_mailboxes: number
    unhealthy_domains: number
    average_risk_score: number
  }
  at_risk: Array<{
    email: string
    health_tier: string
    risk_score: number
    bounce_rate: number
    complaint_rate: number
    primary_reason: string | null
    recommended_action: string | null
  }>
  paused: Array<{
    email: string
    pause_reason: string | null
    paused_at: string | null
    recommended_action: string | null
  }>
  provider_warnings: string[]
  sending_limits: Array<{
    email: string
    daily_used: number
    daily_cap: number
    cap_utilization_pct: number
    throttled: boolean
  }>
  mailbox_health_intel_qa_marker: string
  mailbox_rows: Array<{
    email: string
    health_score: number
    health_state: string
    warmup_status: string | null
    daily_capacity: number
    sends_today: number
    bounce_rate: number
    reply_rate: number
    delivery_success_rate: number
    throttle_status: string
    trend_direction: string
  }>
}

export type GrowthDeliverabilityQueueOpsModule = {
  pending_outbound: number
  blocked_sends: number
  failed_sends: number
  dead_letter_queue: number
  retry_queue: number
  approval_bottlenecks: number
  overdue_scheduled: number
  stuck_processing: number
  recovery_items: Array<{
    id: string
    status: string
    label: string
    failure_reason: string | null
  }>
  configured: boolean
}

export type GrowthDeliverabilityReputationModule = {
  bounce_rate_pct: number | null
  complaint_rate_pct: number | null
  unsubscribe_spike_count: number
  spam_trap_risk_count: number
  domain_reputation_issues: Array<{ domain: string; score: number; tier: string }>
  provider_reputation_issues: string[]
  bounce_trends: Array<{ label: string; mailbox_count: number }>
  complaint_trends: Array<{ label: string; mailbox_count: number }>
  telemetry_connected: boolean
}

export type GrowthDeliverabilityDnsHealthModule = {
  domains_tracked: number
  spf_ok: number
  dkim_ok: number
  dmarc_ok: number
  mx_ok: number
  failing_domains: Array<{
    domain: string
    issues: string[]
    health_tier: string
  }>
  warmup_readiness_issues: string[]
  monitoring_configured: boolean
}

export type GrowthDeliverabilitySequenceSafetyModule = {
  risky_sequences: Array<{ label: string; sequence_count: number; risk_score: number }>
  high_complaint_senders: Array<{ email: string; complaint_rate: number }>
  throttled_campaigns: number
  auto_paused_outreach: number
  configured: boolean
}

export type GrowthDeliverabilityProtectionConsoleSnapshot = {
  qa_marker: typeof GROWTH_DELIVERABILITY_OPS_V2_QA_MARKER
  generated_at: string
  modules: Record<GrowthDeliverabilityProtectionModuleId, GrowthDeliverabilityModuleResult<unknown>>
  alerts: GrowthDeliverabilityOpsAlert[]
  degraded_mode: boolean
  privacy_note: string
}

export const GROWTH_DELIVERABILITY_MODULE_STILL_AVAILABLE: Record<
  GrowthDeliverabilityProtectionModuleId,
  string[]
> = {
  sender_health: ["Queue operations", "DNS authentication", "Reputation metrics", "Sequence safety"],
  queue_ops: ["Sender health", "DNS authentication", "Reputation metrics", "Sequence safety"],
  reputation_protection: ["Sender health", "Queue operations", "DNS authentication", "Sequence safety"],
  dns_health: ["Sender health", "Queue operations", "Reputation metrics", "Sequence safety"],
  sequence_safety: ["Sender health", "Queue operations", "DNS authentication", "Reputation metrics"],
}

export type GrowthDeliverabilityGovernanceTimelineModule = {
  events: GrowthDeliverabilityGovernanceEvent[]
}

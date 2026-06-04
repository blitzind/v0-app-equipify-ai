/** Growth Engine H3 — Operator UX simplification (client-safe). */

export const GROWTH_OPERATOR_UX_H3_QA_MARKER = "growth-operator-ux-h3-v1" as const

export const GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER =
  "growth-operator-diagnostics-disclosure-v1" as const

export type GrowthOperatorAttentionCategory =
  | "approval"
  | "recovery"
  | "deliverability"
  | "provider"
  | "queue"
  | "reply"

export type GrowthOperatorAttentionItem = {
  id: string
  category: GrowthOperatorAttentionCategory
  label: string
  summary: string
  count: number
  href: string
  severity: "critical" | "high" | "medium" | "low"
}

export type GrowthOperatorAttentionStrip = {
  qa_marker: typeof GROWTH_OPERATOR_UX_H3_QA_MARKER
  generated_at: string
  total_attention: number
  items: GrowthOperatorAttentionItem[]
}

export type GrowthOperatorDailyWorkflowStep = {
  id: string
  order: number
  label: string
  description: string
  href: string
  attention_id?: string
}

export const GROWTH_OPERATOR_DAILY_WORKFLOW: GrowthOperatorDailyWorkflowStep[] = [
  {
    id: "attention",
    order: 1,
    label: "Review operator attention",
    description: "Approvals, failures, and blocked sends in one strip.",
    href: "/admin/growth/command#operator-attention",
    attention_id: "attention_strip",
  },
  {
    id: "senders",
    order: 2,
    label: "Check blocked senders",
    description: "Paused mailboxes and reputation protection.",
    href: "/admin/growth/deliverability",
    attention_id: "deliverability_risk",
  },
  {
    id: "failed_outbound",
    order: 3,
    label: "Review failed outbound",
    description: "Replay or cancel dead-letter queue items.",
    href: "/admin/growth/operations/outbound",
    attention_id: "outbound_recovery",
  },
  {
    id: "approvals",
    order: 4,
    label: "Approve pending sends",
    description: "Outreach, sequences, AI personalization, and reply drafts.",
    href: "/admin/growth/sequences/execution",
    attention_id: "outreach_approval",
  },
  {
    id: "opportunities",
    order: 5,
    label: "Review active opportunities",
    description: "Pipeline momentum and revenue at risk.",
    href: "/admin/growth/opportunities/pipeline",
  },
  {
    id: "prospect_search",
    order: 6,
    label: "Run prospect search",
    description: "Discover and qualify new companies.",
    href: "/admin/growth/search?mode=discover",
  },
  {
    id: "campaigns",
    order: 7,
    label: "Launch or recover campaigns",
    description: "Sequences, outreach queue, and outbound console.",
    href: "/admin/growth/operations/outbound",
  },
]

/** Deliverability IA — operator-facing layer labels. */
export const GROWTH_DELIVERABILITY_IA = {
  protection: {
    label: "Protection",
    subtitle: "Enforcement, sender health, and reputation gates",
    href: "/admin/growth/deliverability",
  },
  infrastructure: {
    label: "DNS & Setup",
    subtitle: "Mailbox DNS, authentication, and warmup",
    href: "/admin/growth/infrastructure/deliverability",
  },
  operations: {
    label: "Deliverability Ops",
    subtitle: "Telemetry, remediation, and provider operations",
    href: "/admin/growth/providers/deliverability-ops",
  },
} as const

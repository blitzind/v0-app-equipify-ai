/**
 * GE-AIOS-RUNTIME-CONTEXT-1A — Request-scoped runtime context types (server-only contract).
 */

export const GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER =
  "ge-aios-runtime-context-1a-v1" as const

export const GROWTH_AIOS_RUNTIME_CONTEXT_1A_RUNTIME_RULE =
  "request-scoped object reuse only — not a cache, orchestrator, or AI engine" as const

export type GrowthAiOsRuntimeContextVerdict =
  | "READY_FOR_HOME_RUNTIME_OPTIMIZATION"
  | "READY_WITH_MINOR_DUPLICATES"
  | "BLOCKED_BY_CIRCULAR_DEPENDENCIES"
  | "BLOCKED_BY_CANONICAL_AUTHORITY_CONFLICT"

/** Resolution counters for performance validation (Phase 8). */
export type GrowthAiOsRuntimeResolutionCounts = {
  decision: number
  memory: number
  package: number
  committee: number
  institutional: number
  meeting: number
}

export type GrowthAiOsRuntimeSharedObjectId =
  | "canonical_decision"
  | "canonical_memory_bundle"
  | "growth_5f_package"
  | "sales_strategy_brief"
  | "buying_committee_rollup"
  | "relationship_assessment"
  | "revenue_strategy"
  | "conversation_intelligence"
  | "institutional_learning"
  | "meeting_brief"
  | "operator_narrative"
  | "mission_projection"
  | "approval_snapshot"

export type GrowthAiOsRuntimeSharedObjectEntry = {
  id: GrowthAiOsRuntimeSharedObjectId
  owner: string
  consumers: string[]
  duplicatePathsBefore: string[]
}

export type GrowthAiOsRuntimeRequestBoundary =
  | "home_load"
  | "lead_workspace_load"
  | "meeting_load"
  | "call_load"
  | "reply_webhook"
  | "scheduler_tick_per_account"
  | "draft_factory_advance"
  | "growth_5f_generation"
  | "transport_execution"
  | "approval_review"

/** Shared object inventory (Phase 1). */
export const GROWTH_AIOS_RUNTIME_SHARED_OBJECT_INVENTORY: GrowthAiOsRuntimeSharedObjectEntry[] = [
  {
    id: "canonical_decision",
    owner: "resolve-growth-canonical-decision-for-lead.ts",
    consumers: [
      "lead-operator-workspace",
      "call-copilot-briefing",
      "meeting-prep-context",
      "approvals-operator-review",
      "draft-factory-durable-live",
      "growth-5f-package-persistence",
      "home-workspace-summary",
      "reply-intelligence",
    ],
    duplicatePathsBefore: [
      "Lead WS: parallel decision+memory (decision reloads memory)",
      "G5F: decision gate ×3 (persist, assert, build)",
      "Meeting: memory then decision (both reload package/committee)",
    ],
  },
  {
    id: "canonical_memory_bundle",
    owner: "resolve-canonical-human-memory-for-lead.ts",
    consumers: [
      "lead-operator-workspace",
      "call-copilot-briefing",
      "meeting-prep-context",
      "approvals-operator-review",
      "growth-autonomous-outreach-preparation-draft-service",
      "reply-intelligence",
      "call-workspace-live-reasoning",
    ],
    duplicatePathsBefore: [
      "Lead WS: parallel with decision (duplicate package+committee)",
      "G5F build after decision gate (memory resolved again)",
      "Approvals: memory then decision with preload (still 2 full chains)",
    ],
  },
  {
    id: "growth_5f_package",
    owner: "growth-send-plane-1a-canonical-loader.ts",
    consumers: ["decision resolver", "memory resolver", "G5F build", "approvals"],
    duplicatePathsBefore: ["Decision and memory each load package independently"],
  },
  {
    id: "buying_committee_rollup",
    owner: "buying-committee-intelligence-lead-rollup.ts",
    consumers: ["memory resolver", "decision resolver"],
    duplicatePathsBefore: ["Loaded twice when decision+memory resolve in parallel"],
  },
  {
    id: "institutional_learning",
    owner: "growth-institutional-learning-1a-resolver.ts",
    consumers: ["memory resolver"],
    duplicatePathsBefore: ["Once per memory resolve — no cross-request dedup"],
  },
  {
    id: "meeting_brief",
    owner: "growth-canonical-meeting-brief-service.ts",
    consumers: ["meeting-prep-context"],
    duplicatePathsBefore: ["Separate from decision/memory chain"],
  },
  {
    id: "mission_projection",
    owner: "growth-canonical-mission-1a.ts",
    consumers: ["lead workspace", "meeting prep", "call briefing", "home"],
    duplicatePathsBefore: ["Pure projection — no duplicate resolver risk"],
  },
  {
    id: "approval_snapshot",
    owner: "growth-canonical-operator-workspace-1a-loader.ts",
    consumers: ["home", "HAC"],
    duplicatePathsBefore: ["Portfolio-scoped — not per-lead runtime context"],
  },
]

/** Request boundaries — one context per boundary per account (Phase 6). */
export const GROWTH_AIOS_RUNTIME_REQUEST_BOUNDARIES: Array<{
  boundary: GrowthAiOsRuntimeRequestBoundary
  contextScope: "per_account" | "per_portfolio" | "per_transport_job"
  mayShareAcrossAccounts: boolean
}> = [
  { boundary: "home_load", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "lead_workspace_load", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "meeting_load", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "call_load", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "reply_webhook", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "scheduler_tick_per_account", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "draft_factory_advance", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "growth_5f_generation", contextScope: "per_account", mayShareAcrossAccounts: false },
  { boundary: "transport_execution", contextScope: "per_transport_job", mayShareAcrossAccounts: false },
  { boundary: "approval_review", contextScope: "per_account", mayShareAcrossAccounts: false },
]

export const GROWTH_AIOS_RUNTIME_CONTEXT_VERDICT: GrowthAiOsRuntimeContextVerdict =
  "READY_FOR_HOME_RUNTIME_OPTIMIZATION"

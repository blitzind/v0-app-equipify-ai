/**
 * AI Operational Assistant Phase 1 — shared types.
 *
 * Phase 1 ships a deterministic rule engine that derives
 * recommendations from existing tables (prospects, work orders,
 * invoices, equipment, calibration records, inventory stock,
 * communication events, workflow runs). No new "recommendations"
 * table — only `ai_ops_dismissals` for snooze persistence.
 */

export type RecommendationCategory =
  | "prospect"
  | "financial"
  | "dispatch"
  | "equipment"
  | "certificate"
  | "inventory"
  | "communications"
  | "automation"
  | "maintenance"

export type RecommendationPriority = "high" | "medium" | "low"

/** Confidence is a soft display label only — Phase 1 is rule-based. */
export type RecommendationConfidence = "deterministic" | "high" | "medium" | "low"

export type RecommendedAction = {
  /**
   * Action identifier the UI knows how to render. Keep this small —
   * each action ID maps to a button / link variant.
   */
  type:
    | "view_prospect"
    | "view_customer"
    | "view_invoice"
    | "view_work_order"
    | "view_equipment"
    | "view_inventory"
    | "view_communications"
    | "view_automation"
    | "draft_followup"
    | "open_communications_filtered"
    | "create_automation_suggestion"
  label: string
  href?: string
}

export type Recommendation = {
  /**
   * Stable, deduplicating identifier. Format:
   * `<rule_id>:<entity_id>` so the dismissal table can match
   * across re-runs.
   */
  key: string
  category: RecommendationCategory
  priority: RecommendationPriority
  confidence: RecommendationConfidence
  title: string
  /** One-paragraph operational explanation, no PII beyond names. */
  explanation: string
  /** Lightweight entity reference for UI deep-links. */
  entity: {
    type:
      | "prospect"
      | "invoice"
      | "work_order"
      | "equipment"
      | "calibration_record"
      | "inventory_stock"
      | "communication_event"
      | "workflow_automation"
      | "customer"
    id: string
    label: string
    href: string
  } | null
  actions: RecommendedAction[]
  /** ISO timestamp anchoring the recommendation (e.g. due_date). */
  anchorIso: string | null
  /** Numeric metric driving the rule (e.g. days overdue, $ amount, count). */
  metric: { label: string; value: string } | null
  /** Surface only the rule that produced it; useful for filters/debug. */
  ruleId: string
  /**
   * Phase 5 — optional overlay fields joined in the API layer (not from
   * the deterministic engine).
   */
  lifecycleState?: RecommendationLifecycleState
  /** Deterministic explainable score (higher = more urgent in UI ordering). */
  commandScore?: number
  commandScoreBreakdown?: RecommendationScoreBreakdownEntry[]
}

/** AI Ops Phase 5 — operator workflow overlay (stored server-side). */
export type RecommendationLifecycleState =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "ignored"
  | "escalated"

export type RecommendationScoreBreakdownEntry = {
  label: string
  points: number
}

export type RecommendationFilter = {
  categories?: RecommendationCategory[]
  priorities?: RecommendationPriority[]
  /** When false, dismissed/snoozed items are still excluded (default false). */
  includeDismissed?: boolean
  search?: string
  limit?: number
  /**
   * When set, return at most the single matching recommendation (or none).
   * Used by server routes that re-derive a recommendation for an action
   * without trusting client input.
   */
  recommendationKey?: string
}

export type RecommendationSummary = {
  total: number
  high: number
  medium: number
  low: number
  byCategory: Partial<Record<RecommendationCategory, number>>
}

export type RecommendationsResponse = {
  items: Recommendation[]
  summary: RecommendationSummary
  generatedAtIso: string
  /** Categories the caller is permitted to see (post-permission filter). */
  visibleCategories: RecommendationCategory[]
  /**
   * AI Ops Phase 4 — outcome-aware ranking adjustments per category
   * (range -0.4..+0.4). Useful for transparency in admin tooling;
   * UI surfaces this only as a tooltip ("Boosted by past activity").
   * Empty when fewer than the minimum sample threshold of outcomes
   * has been recorded.
   */
  categoryAdjustments?: Partial<Record<RecommendationCategory, number>>
}

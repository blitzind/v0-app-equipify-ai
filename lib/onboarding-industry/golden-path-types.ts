/**
 * Typed completion rules for guided golden-path actions (evaluated server-side only).
 */
export type GoldenPathCompletionRule =
  | { kind: "customers_non_sample_gte"; n: number }
  | { kind: "equipment_non_sample_gte"; n: number }
  | { kind: "work_orders_non_sample_gte"; n: number }
  | { kind: "quotes_non_sample_gte"; n: number }
  | { kind: "invoices_sent_non_sample_gte"; n: number }
  | { kind: "maintenance_plans_non_sample_gte"; n: number }

/** Config row (lib-only; shipped to client without internal rule details if we strip — we send done + ruleKind for transparency). */
export type GoldenPathActionDefinition = {
  id: string
  label: string
  description: string
  href: string
  ctaLabel?: string
  completionRule: GoldenPathCompletionRule
  /** Short hint when sample workspace is present */
  sampleDataHint?: string
  priority: number
}

export type RecommendedModuleDefinition = {
  moduleKey: string
  label: string
  href: string
  /** Optional one-line for tooltips / AIden framing enrichment */
  blurb?: string
}

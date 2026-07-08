/** Revenue Intelligence UX helpers (Prompt 22). Client-safe display only — no scoring changes. */

import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export const GROWTH_REVENUE_INTELLIGENCE_UX_QA_MARKER = "growth-revenue-intelligence-ux-v1" as const

export type RevenueEvidenceStrength = "strong" | "moderate" | "weak" | "minimal"

export type RevenueLeadHealth = "healthy" | "attention" | "at_risk" | "stalled"

export function formatLabel(value: string): string {
  return value.replace(/_/g, " ")
}

export function formatStage(stage: string | null | undefined): string {
  if (!stage) return "Unknown"
  return formatLabel(stage)
}

export function normalizeConfidence(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return value <= 1 ? value : Math.min(1, value / 100)
}

export function deriveEvidenceStrength(params: {
  evidenceCount: number
  attributionCount?: number
  candidateConfidence: number
}): RevenueEvidenceStrength {
  const total = params.evidenceCount + (params.attributionCount ?? 0) * 0.5
  const conf = normalizeConfidence(params.candidateConfidence)
  if (total >= 5 || (total >= 3 && conf >= 0.7)) return "strong"
  if (total >= 3 || conf >= 0.55) return "moderate"
  if (total >= 1 || conf >= 0.35) return "weak"
  return "minimal"
}

export function deriveLeadHealth(card: Pick<
  RevenueQueueCardView,
  | "human_review_required"
  | "candidate_priority"
  | "verification_state"
  | "status"
  | "intent_score"
  | "candidate_confidence"
>): RevenueLeadHealth {
  if (card.status === "archived" || card.status === "duplicate") return "stalled"
  if (card.verification_state === "reject" || card.verification_state === "rejected") return "at_risk"
  if (card.human_review_required && card.candidate_priority !== "urgent") return "attention"
  if (card.intent_score >= 12 && card.candidate_confidence >= 0.6) return "healthy"
  if (card.intent_score >= 6) return "attention"
  return "stalled"
}

export function priorityTone(priority: string): {
  badge: "default" | "secondary" | "destructive" | "outline"
  className: string
} {
  if (priority === "urgent") {
    return { badge: "destructive", className: "bg-red-100 text-red-900 border-red-200" }
  }
  if (priority === "high") {
    return { badge: "default", className: "bg-amber-100 text-amber-950 border-amber-200" }
  }
  if (priority === "normal") {
    return { badge: "secondary", className: "bg-sky-50 text-sky-900 border-sky-200" }
  }
  return { badge: "outline", className: "bg-muted text-muted-foreground" }
}

export function buyingStageTone(stage: string | null | undefined): string {
  if (!stage) return "bg-muted text-muted-foreground"
  if (stage === "purchase_ready" || stage === "active_opportunity") {
    return "bg-emerald-100 text-emerald-900 border-emerald-200"
  }
  if (stage === "comparison" || stage === "vendor_evaluation") {
    return "bg-violet-100 text-violet-900 border-violet-200"
  }
  if (stage === "existing_customer_expansion") {
    return "bg-blue-100 text-blue-900 border-blue-200"
  }
  if (stage === "retention_risk") {
    return "bg-red-50 text-red-800 border-red-200"
  }
  return "bg-slate-100 text-slate-800 border-slate-200"
}

export function evidenceStrengthTone(strength: RevenueEvidenceStrength): string {
  if (strength === "strong") return "text-emerald-700"
  if (strength === "moderate") return "text-sky-700"
  if (strength === "weak") return "text-amber-700"
  return "text-muted-foreground"
}

export function computeDashboardKpis(cards: RevenueQueueCardView[]): {
  newLeads: number
  purchaseReady: number
  highIntentVisitors: number
  needsReview: number
  returningAccounts: number
  highPriorityQueue: number
} {
  let newLeads = 0
  let purchaseReady = 0
  let highIntentVisitors = 0
  let needsReview = 0
  let returningAccounts = 0
  let highPriorityQueue = 0

  for (const card of cards) {
    if (card.status === "new") newLeads += 1
    if (card.is_purchase_ready) purchaseReady += 1
    if (card.is_high_intent_visitor) highIntentVisitors += 1
    if (card.needs_review) needsReview += 1
    if (card.is_returning_account) returningAccounts += 1
    if (card.candidate_priority === "urgent" || card.candidate_priority === "high") {
      highPriorityQueue += 1
    }
  }

  return {
    newLeads,
    purchaseReady,
    highIntentVisitors,
    needsReview,
    returningAccounts,
    highPriorityQueue,
  }
}

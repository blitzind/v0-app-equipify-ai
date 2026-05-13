/**
 * Tier-aware BlitzPay Executive Overview widget registry (capability-driven layout).
 * Surfaces: enabled, hidden, preview (read-only / subset), upgrade_cta (marketing + billing CTA).
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { normalizeCommercialProductTier, tierRank } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzPayFccSectionId } from "@/lib/blitzpay/sections"

/** Server fetch profile — skips expensive queries on lower scopes. */
export type FccExecutiveOverviewDataScope = "solo_lite" | "core_standard" | "growth_standard" | "scale_full"

export function fccExecutiveOverviewDataScopeForTier(
  tier: CommercialProductTier | null | undefined,
): FccExecutiveOverviewDataScope {
  const t = (normalizeCommercialProductTier(tier ?? undefined) ?? "solo") as CommercialProductTier
  if (tierRank(t) >= tierRank("scale")) return "scale_full"
  if (tierRank(t) >= tierRank("growth")) return "growth_standard"
  if (tierRank(t) >= tierRank("core")) return "core_standard"
  return "solo_lite"
}

export function parseFccExecutiveOverviewDataScope(raw: string | null | undefined): FccExecutiveOverviewDataScope | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s === "solo_lite" || s === "core_standard" || s === "growth_standard" || s === "scale_full") return s
  return null
}

export type ExecutiveOverviewWidgetSurface = "enabled" | "hidden" | "preview" | "upgrade_cta"

export type ExecutiveOverviewWidgetId =
  | "executive_health_bar"
  | "attention_queue"
  | "receivables_pulse"
  | "near_term_inflows"
  | "collections_compact"
  | "autopay_strip"
  | "recurring_revenue"
  | "retention_confidence"
  | "cash_runway"
  | "payroll_vendor_pressure"
  | "operational_bottlenecks"
  | "ai_executive_briefing"
  | "enterprise_rollups"
  | "scale_intelligence_strip"
  | "financial_operations_timeline"

export type ExecutiveOverviewWidgetDef = {
  readonly id: ExecutiveOverviewWidgetId
  /** Minimum tier where the widget is fully enabled (data + navigation). */
  readonly minTier: CommercialProductTier
  /** When true, one step below `minTier` shows preview (subset / copy) instead of upgrade_cta. */
  readonly previewOneTierBelow?: boolean
  /** Primary FCC slug for link gating when enabled. */
  readonly primaryFccSlug?: BlitzPayFccSectionId
}

export const EXECUTIVE_OVERVIEW_WIDGET_DEFS: readonly ExecutiveOverviewWidgetDef[] = [
  { id: "executive_health_bar", minTier: "solo", primaryFccSlug: "executive-health" },
  { id: "attention_queue", minTier: "solo" },
  { id: "receivables_pulse", minTier: "solo", primaryFccSlug: "collections" },
  { id: "near_term_inflows", minTier: "solo", primaryFccSlug: "collections" },
  { id: "collections_compact", minTier: "solo", primaryFccSlug: "collections" },
  { id: "autopay_strip", minTier: "solo", primaryFccSlug: "billing-profiles" },
  { id: "recurring_revenue", minTier: "core", primaryFccSlug: "recurring-revenue" },
  { id: "retention_confidence", minTier: "core", primaryFccSlug: "revenue-optimization" },
  { id: "cash_runway", minTier: "growth", primaryFccSlug: "operating-cash" },
  { id: "payroll_vendor_pressure", minTier: "growth", primaryFccSlug: "payroll-commissions" },
  { id: "operational_bottlenecks", minTier: "growth", primaryFccSlug: "internal-books" },
  { id: "ai_executive_briefing", minTier: "growth", primaryFccSlug: "ai-financial-copilot" },
  { id: "enterprise_rollups", minTier: "scale", previewOneTierBelow: true, primaryFccSlug: "multi-entity-finance" },
  { id: "scale_intelligence_strip", minTier: "scale", previewOneTierBelow: true, primaryFccSlug: "supplier-network" },
  { id: "financial_operations_timeline", minTier: "scale", previewOneTierBelow: true, primaryFccSlug: "enterprise-observability" },
] as const

/** Canonical render order (subset shown per tier via surface resolution). */
export const EXECUTIVE_OVERVIEW_WIDGET_ORDER: readonly ExecutiveOverviewWidgetId[] = EXECUTIVE_OVERVIEW_WIDGET_DEFS.map(
  (d) => d.id,
)

const DEF_BY_ID = Object.fromEntries(EXECUTIVE_OVERVIEW_WIDGET_DEFS.map((d) => [d.id, d])) as Record<
  ExecutiveOverviewWidgetId,
  ExecutiveOverviewWidgetDef
>

function effectiveTier(tier: CommercialProductTier | null | undefined): CommercialProductTier {
  return (normalizeCommercialProductTier(tier ?? undefined) ?? "solo") as CommercialProductTier
}

export function resolveExecutiveOverviewWidgetSurface(
  tier: CommercialProductTier | null | undefined,
  widgetId: ExecutiveOverviewWidgetId,
): ExecutiveOverviewWidgetSurface {
  const t = effectiveTier(tier)
  const def = DEF_BY_ID[widgetId]
  const need = tierRank(def.minTier)
  const have = tierRank(t)
  if (have >= need) return "enabled"
  if (have === need - 1) {
    if (def.previewOneTierBelow) return "preview"
    return "upgrade_cta"
  }
  return "hidden"
}

export type ResolvedExecutiveOverviewWidget = {
  id: ExecutiveOverviewWidgetId
  surface: ExecutiveOverviewWidgetSurface
  def: ExecutiveOverviewWidgetDef
}

/**
 * Ordered widgets for the overview shell. Drops `hidden` rows to avoid clutter on lower tiers.
 * Downgrades to `preview` when tier includes the widget but FCC navigation is not available for the deep link.
 */
export function getExecutiveOverviewWidgetsForTier(
  tier: CommercialProductTier | null | undefined,
  fccHrefAllowed: (slug?: string) => boolean,
): ResolvedExecutiveOverviewWidget[] {
  const t = effectiveTier(tier)
  const out: ResolvedExecutiveOverviewWidget[] = []
  for (const id of EXECUTIVE_OVERVIEW_WIDGET_ORDER) {
    const def = DEF_BY_ID[id]
    let surface = resolveExecutiveOverviewWidgetSurface(t, id)
    if (surface === "hidden") continue
    if (
      (surface === "enabled" || surface === "upgrade_cta") &&
      def.primaryFccSlug &&
      !fccHrefAllowed(def.primaryFccSlug)
    ) {
      surface = "preview"
    }
    out.push({ id, surface, def })
  }
  return out
}

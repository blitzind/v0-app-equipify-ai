/**
 * Overview (FCC landing) widget capability registry — tier-gated for future Overview composition.
 */
import type { BlitzpayFeatureKey } from "@/lib/billing/blitzpay-feature-catalog"
import type { BlitzpayCommercialModuleKey } from "@/lib/billing/blitzpay-module-registry"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { normalizeCommercialProductTier, tierRank } from "@/lib/billing/blitzpay-commercial-tier"
import type { BlitzPaySurfaceMode } from "@/lib/blitzpay/blitzpay-capability-types"

export const BLITZPAY_OVERVIEW_WIDGET_IDS = [
  "cash_runway_summary",
  "ar_ap_treasury_tiles",
  "collections_recovery_queue",
  "memberships_renewal_risk",
  "ai_executive_narrative",
  "revenue_optimization_signals",
  "multi_entity_rollups",
  "enterprise_observability_strip",
] as const

export type BlitzPayOverviewWidgetId = (typeof BLITZPAY_OVERVIEW_WIDGET_IDS)[number]

export type BlitzPayOverviewWidgetCapabilityId = `blitzpay.fcc.overview.widget.${BlitzPayOverviewWidgetId}`

export type BlitzPayOverviewWidgetDefinition = {
  readonly id: BlitzPayOverviewWidgetId
  readonly capabilityId: BlitzPayOverviewWidgetCapabilityId
  readonly module: BlitzpayCommercialModuleKey
  readonly primaryFeatureKey: BlitzpayFeatureKey
  readonly label: string
}

function wid(id: BlitzPayOverviewWidgetId): BlitzPayOverviewWidgetCapabilityId {
  return `blitzpay.fcc.overview.widget.${id}`
}

export const BLITZPAY_OVERVIEW_WIDGET_BY_ID = {
  cash_runway_summary: {
    id: "cash_runway_summary",
    capabilityId: wid("cash_runway_summary"),
    module: "cash_planning",
    primaryFeatureKey: "blitzpay.cash.planning",
    label: "Cash & runway summary",
  },
  ar_ap_treasury_tiles: {
    id: "ar_ap_treasury_tiles",
    capabilityId: wid("ar_ap_treasury_tiles"),
    module: "financial_command_center",
    primaryFeatureKey: "blitzpay.fcc.summary",
    label: "AR / AP / treasury tiles",
  },
  collections_recovery_queue: {
    id: "collections_recovery_queue",
    capabilityId: wid("collections_recovery_queue"),
    module: "collections",
    primaryFeatureKey: "blitzpay.collections.visibility",
    label: "Collections recovery queue",
  },
  memberships_renewal_risk: {
    id: "memberships_renewal_risk",
    capabilityId: wid("memberships_renewal_risk"),
    module: "memberships_recurring",
    primaryFeatureKey: "blitzpay.memberships.native",
    label: "Memberships renewal risk",
  },
  ai_executive_narrative: {
    id: "ai_executive_narrative",
    capabilityId: wid("ai_executive_narrative"),
    module: "ai_copilot",
    primaryFeatureKey: "blitzpay.ai.copilot",
    label: "AI executive narrative",
  },
  revenue_optimization_signals: {
    id: "revenue_optimization_signals",
    capabilityId: wid("revenue_optimization_signals"),
    module: "revenue_optimization",
    primaryFeatureKey: "blitzpay.revenue.optimize",
    label: "Revenue optimization signals",
  },
  multi_entity_rollups: {
    id: "multi_entity_rollups",
    capabilityId: wid("multi_entity_rollups"),
    module: "multi_entity_franchise",
    primaryFeatureKey: "blitzpay.multi_entity",
    label: "Multi-entity rollups",
  },
  enterprise_observability_strip: {
    id: "enterprise_observability_strip",
    capabilityId: wid("enterprise_observability_strip"),
    module: "enterprise_observability",
    primaryFeatureKey: "blitzpay.observability.advanced",
    label: "Enterprise observability strip",
  },
} as const satisfies Record<BlitzPayOverviewWidgetId, BlitzPayOverviewWidgetDefinition>

/** Minimum SaaS tier for surfacing this widget in Overview (aligns with FCC tier matrix). */
const BLITZPAY_OVERVIEW_WIDGET_MIN_TIER: Record<BlitzPayOverviewWidgetId, CommercialProductTier> = {
  cash_runway_summary: "growth",
  ar_ap_treasury_tiles: "solo",
  collections_recovery_queue: "solo",
  memberships_renewal_risk: "core",
  ai_executive_narrative: "core",
  revenue_optimization_signals: "core",
  multi_entity_rollups: "scale",
  enterprise_observability_strip: "scale",
}

export type BlitzPayResolvedOverviewWidget = {
  id: BlitzPayOverviewWidgetId
  capabilityId: BlitzPayOverviewWidgetCapabilityId
  label: string
  surface: BlitzPaySurfaceMode
}

function effectiveTier(tier: CommercialProductTier | null | undefined): CommercialProductTier {
  return (normalizeCommercialProductTier(tier ?? undefined) ?? "solo") as CommercialProductTier
}

export function resolveBlitzPayOverviewWidgetSurface(
  tier: CommercialProductTier | null | undefined,
  widgetId: BlitzPayOverviewWidgetId,
  _options: { enforceTierGates: boolean },
): BlitzPaySurfaceMode {
  const t = effectiveTier(tier)
  const min = BLITZPAY_OVERVIEW_WIDGET_MIN_TIER[widgetId]
  return tierRank(t) >= tierRank(min) ? "enabled" : "hidden"
}

/**
 * Deterministic ordered list of overview widgets with resolved surface modes.
 */
export function getVisibleOverviewWidgets(
  tier: CommercialProductTier | null | undefined,
  options: { enforceTierGates: boolean },
): BlitzPayResolvedOverviewWidget[] {
  const out: BlitzPayResolvedOverviewWidget[] = []
  for (const id of BLITZPAY_OVERVIEW_WIDGET_IDS) {
    const def = BLITZPAY_OVERVIEW_WIDGET_BY_ID[id]
    const surface = resolveBlitzPayOverviewWidgetSurface(tier, id, options)
    if (surface === "hidden") continue
    out.push({ id, capabilityId: def.capabilityId, label: def.label, surface })
  }
  return out
}

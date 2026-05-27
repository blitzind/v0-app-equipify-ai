/** Delivery dashboard aggregation. Client-safe. */

import {
  GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER,
  type GrowthDeliveryDashboard,
  type GrowthDeliveryProvider,
} from "@/lib/growth/providers/provider-types"

export function buildProviderDeliveryDashboard(providers: GrowthDeliveryProvider[]): GrowthDeliveryDashboard {
  const connected_count = providers.filter((provider) => provider.status === "connected").length
  const warning_count = providers.filter((provider) => provider.status === "warning" || provider.status === "degraded").length
  const disabled_count = providers.filter((provider) => provider.status === "disabled").length

  const average_health_score =
    providers.length > 0
      ? Math.round(providers.reduce((sum, provider) => sum + provider.health_score, 0) / providers.length)
      : 0

  return {
    qa_marker: GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER,
    connected_count,
    warning_count,
    disabled_count,
    average_health_score,
  }
}

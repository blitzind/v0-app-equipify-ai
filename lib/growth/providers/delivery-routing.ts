/** Delivery routing helpers and simulation inputs. Client-safe. */

import { selectDeliveryRoute, type DeliveryRouteCandidate, type RouteSelectionResult } from "@/lib/growth/providers/provider-router"
import type { GrowthDeliveryProviderStatus } from "@/lib/growth/providers/provider-types"

export type RouteSimulationInput = {
  routes: DeliveryRouteCandidate[]
  requested_volume: number
  force_provider_status?: GrowthDeliveryProviderStatus
}

export function simulateDeliveryRoute(input: RouteSimulationInput): RouteSelectionResult {
  return selectDeliveryRoute({
    routes: input.routes,
    requested_volume: input.requested_volume,
    force_provider_status: input.force_provider_status,
  })
}

export function formatRouteSelection(selection: RouteSelectionResult): string {
  if (!selection.selected_provider_name) return selection.reason
  if (selection.fallback_provider_name) {
    return `${selection.selected_provider_name} → fallback ${selection.fallback_provider_name}. ${selection.reason}`
  }
  return `${selection.selected_provider_name}. ${selection.reason}`
}

export { type DeliveryRouteCandidate, type RouteSelectionResult }

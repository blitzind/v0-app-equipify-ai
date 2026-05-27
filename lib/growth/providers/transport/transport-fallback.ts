/** Transport fallback routing — wraps delivery route selection. Client-safe. */

import { selectDeliveryRoute, type DeliveryRouteCandidate } from "@/lib/growth/providers/provider-router"
import type { GrowthTransportSimulationResult } from "@/lib/growth/providers/adapters/provider-adapter-types"
import { checkTransportRateLimit } from "@/lib/growth/providers/transport/transport-rate-limit"
import type { GrowthProviderRateLimitRow } from "@/lib/growth/providers/adapters/provider-adapter-types"

export function resolveTransportFallbackRoute(input: {
  routes: DeliveryRouteCandidate[]
  requested_volume?: number
  exclude_route_id?: string | null
}): { route_id: string | null; provider_name: string | null; reason: string } {
  const filtered = input.exclude_route_id
    ? input.routes.filter((route) => route.route_id !== input.exclude_route_id)
    : input.routes

  const selection = selectDeliveryRoute({
    routes: filtered,
    requested_volume: input.requested_volume ?? 1,
  })

  return {
    route_id: selection.selected_route_id,
    provider_name: selection.selected_provider_name,
    reason: selection.reason,
  }
}

export function simulateTransportDelivery(input: {
  routes: DeliveryRouteCandidate[]
  rate_limit: GrowthProviderRateLimitRow | null
  requested_volume?: number
}): GrowthTransportSimulationResult {
  const volume = input.requested_volume ?? 1
  const selection = selectDeliveryRoute({ routes: input.routes, requested_volume: volume })

  const rateCheck = input.rate_limit
    ? checkTransportRateLimit(input.rate_limit, volume)
    : {
        allowed: true,
        reason: "No rate limit row configured.",
        minute_remaining: 0,
        hour_remaining: 0,
        day_remaining: 0,
      }

  const fallback = resolveTransportFallbackRoute({
    routes: input.routes,
    requested_volume: volume,
    exclude_route_id: selection.selected_route_id,
  })

  return {
    route: {
      selected_route_id: selection.selected_route_id,
      selected_provider_name: selection.selected_provider_name,
      fallback_route_id: selection.fallback_route_id ?? fallback.route_id,
      fallback_provider_name: selection.fallback_provider_name ?? fallback.provider_name,
      reason: selection.reason,
    },
    rate_limit: {
      allowed: rateCheck.allowed,
      reason: rateCheck.reason,
      minute_remaining: rateCheck.minute_remaining,
      hour_remaining: rateCheck.hour_remaining,
      day_remaining: rateCheck.day_remaining,
    },
    fallback_route: {
      route_id: fallback.route_id,
      provider_name: fallback.provider_name,
    },
  }
}

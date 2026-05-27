/** Delivery route selection — deterministic, no sending. Client-safe. */

import type { GrowthDeliveryProviderStatus } from "@/lib/growth/providers/provider-types"

export type DeliveryRouteCandidate = {
  route_id: string
  provider_id: string
  provider_name: string
  provider_family: string
  provider_status: GrowthDeliveryProviderStatus
  provider_health_score: number
  supports_send: boolean
  priority: number
  enabled: boolean
  daily_cap: number
  current_volume: number
  health_weight: number
  fallback_route_id: string | null
}

export type RouteSelectionInput = {
  routes: DeliveryRouteCandidate[]
  requested_volume?: number
  force_provider_status?: GrowthDeliveryProviderStatus
}

export type RouteSelectionResult = {
  selected_route_id: string | null
  selected_provider_name: string | null
  fallback_route_id: string | null
  fallback_provider_name: string | null
  reason: string
  used_fallback: boolean
}

function routeScore(route: DeliveryRouteCandidate, requestedVolume: number): number {
  const remainingCap = Math.max(0, route.daily_cap - route.current_volume)
  const capFit = route.daily_cap <= 0 ? 50 : Math.min(100, (remainingCap / Math.max(requestedVolume, 1)) * 100)
  return route.priority + route.provider_health_score * 0.4 + route.health_weight * 0.2 + capFit * 0.1
}

function isRouteEligible(route: DeliveryRouteCandidate, requestedVolume: number): boolean {
  if (!route.enabled) return false
  if (!route.supports_send) return false
  if (route.provider_status === "disabled" || route.provider_status === "draft") return false
  if (route.daily_cap > 0 && route.current_volume + requestedVolume > route.daily_cap) return false
  if (route.provider_health_score < 20) return false
  return true
}

export function selectDeliveryRoute(input: RouteSelectionInput): RouteSelectionResult {
  const requestedVolume = Math.max(1, input.requested_volume ?? 1)
  const routes = input.routes.map((route) =>
    input.force_provider_status
      ? { ...route, provider_status: input.force_provider_status }
      : route,
  )

  const eligible = routes
    .filter((route) => isRouteEligible(route, requestedVolume))
    .sort((a, b) => routeScore(b, requestedVolume) - routeScore(a, requestedVolume))

  if (eligible.length === 0) {
    return {
      selected_route_id: null,
      selected_provider_name: null,
      fallback_route_id: null,
      fallback_provider_name: null,
      reason: "No eligible delivery routes for requested volume and provider health.",
      used_fallback: false,
    }
  }

  const primary = eligible[0]
  const fallback = eligible.find((route) => route.route_id !== primary.route_id) ?? null

  if (primary.provider_status === "degraded" || primary.provider_status === "warning") {
    if (fallback) {
      return {
        selected_route_id: fallback.route_id,
        selected_provider_name: fallback.provider_name,
        fallback_route_id: primary.route_id,
        fallback_provider_name: primary.provider_name,
        reason: `Primary route ${primary.provider_name} is ${primary.provider_status}; selected healthier fallback ${fallback.provider_name}.`,
        used_fallback: true,
      }
    }
  }

  if (primary.fallback_route_id) {
    const configuredFallback = routes.find((route) => route.route_id === primary.fallback_route_id)
    if (configuredFallback && isRouteEligible(configuredFallback, requestedVolume)) {
      return {
        selected_route_id: primary.route_id,
        selected_provider_name: primary.provider_name,
        fallback_route_id: configuredFallback.route_id,
        fallback_provider_name: configuredFallback.provider_name,
        reason: `Selected ${primary.provider_name} with configured fallback ${configuredFallback.provider_name}.`,
        used_fallback: false,
      }
    }
  }

  return {
    selected_route_id: primary.route_id,
    selected_provider_name: primary.provider_name,
    fallback_route_id: fallback?.route_id ?? null,
    fallback_provider_name: fallback?.provider_name ?? null,
    reason: `Selected ${primary.provider_name} based on priority, health, and remaining daily capacity.`,
    used_fallback: false,
  }
}

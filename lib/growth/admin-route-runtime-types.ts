/** Growth admin route runtime stability — client-safe QA markers + error sanitization. */

export const GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER =
  "growth-admin-route-runtime-stable-v1" as const

export const GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER =
  "growth-prospect-search-runtime-stable-v2" as const

export const GROWTH_PROVIDER_DELIVERY_RUNTIME_STABLE_QA_MARKER =
  "growth-provider-delivery-runtime-stable-v1" as const

export function sanitizeGrowthAdminUiError(message: string | null | undefined): string {
  const trimmed = message?.trim()
  if (!trimmed) return "This Growth admin panel could not be loaded."
  if (/\bis not defined$/i.test(trimmed) || /^ReferenceError/i.test(trimmed)) {
    return "This Growth admin panel hit a configuration issue. Retry or contact platform support after deploy."
  }
  return trimmed
}

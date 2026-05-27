/** Growth Engine — SERP provider types (Real-World Discovery). */

export const GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER = "growth-serp-provider-audit-v1" as const

export type SerpApiGoogleMapsLocalResult = {
  position?: number
  title?: string
  place_id?: string
  rating?: number
  reviews?: number
  type?: string
  types?: string[]
  address?: string
  phone?: string
  website?: string
  link?: string
  description?: string
}

export type SerpApiGoogleMapsResponse = {
  local_results?: SerpApiGoogleMapsLocalResult[]
  place_results?: SerpApiGoogleMapsLocalResult
  error?: string
}

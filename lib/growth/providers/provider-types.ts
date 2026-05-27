/** Growth Engine — Provider Delivery types (Phase 2C). Client-safe. */

export const GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER = "growth-provider-delivery-foundation-v1" as const

export const GROWTH_DELIVERY_PROVIDER_FAMILIES = [
  "google",
  "microsoft",
  "smtp",
  "ses",
  "mailgun",
  "postmark",
  "resend",
  "custom",
] as const
export type GrowthDeliveryProviderFamily = (typeof GROWTH_DELIVERY_PROVIDER_FAMILIES)[number]

export const GROWTH_DELIVERY_PROVIDER_STATUSES = ["draft", "connected", "warning", "degraded", "disabled"] as const
export type GrowthDeliveryProviderStatus = (typeof GROWTH_DELIVERY_PROVIDER_STATUSES)[number]

export const GROWTH_DELIVERY_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthDeliveryEventSeverity = (typeof GROWTH_DELIVERY_EVENT_SEVERITIES)[number]

export const GROWTH_DELIVERY_VALIDATION_RESULTS = ["supported", "unsupported", "warning", "error"] as const
export type GrowthDeliveryValidationResult = (typeof GROWTH_DELIVERY_VALIDATION_RESULTS)[number]

export const GROWTH_DELIVERY_TIMELINE_EVENT_TYPES = [
  "provider_connected",
  "provider_validation_failed",
  "provider_disabled",
  "delivery_route_changed",
  "fallback_route_triggered",
] as const
export type GrowthDeliveryTimelineEventType = (typeof GROWTH_DELIVERY_TIMELINE_EVENT_TYPES)[number]

export type GrowthDeliveryProviderCapabilities = {
  send: boolean
  replySync: boolean
  tracking: boolean
  templates: boolean
  webhooks: boolean
  rateLimits: boolean
  validation: boolean
}

export type GrowthDeliveryProvider = {
  id: string
  provider_key: string
  provider_name: string
  provider_family: GrowthDeliveryProviderFamily
  status: GrowthDeliveryProviderStatus
  supports_send: boolean
  supports_reply_sync: boolean
  supports_tracking: boolean
  supports_templates: boolean
  supports_validation: boolean
  supports_webhooks: boolean
  supports_rate_limits: boolean
  max_daily_volume: number
  health_score: number
  last_validation_at: string | null
  configuration_status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
  capabilities_label?: string
}

export type GrowthDeliveryRoute = {
  id: string
  provider_id: string
  provider_name: string
  provider_family: GrowthDeliveryProviderFamily
  sender_account_id: string
  sender_label: string
  priority: number
  enabled: boolean
  daily_cap: number
  current_volume: number
  health_weight: number
  fallback_route_id: string | null
  fallback_provider_name: string | null
  created_at: string
  updated_at: string
}

export type GrowthDeliveryEvent = {
  id: string
  provider_id: string
  provider_name: string
  severity: GrowthDeliveryEventSeverity
  event_type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export type GrowthDeliveryDashboard = {
  qa_marker: typeof GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER
  connected_count: number
  warning_count: number
  disabled_count: number
  average_health_score: number
}

export type GrowthDeliveryRouteSelection = {
  selected_route_id: string | null
  selected_provider_name: string | null
  fallback_route_id: string | null
  fallback_provider_name: string | null
  reason: string
  used_fallback: boolean
}

export const GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE =
  "Provider delivery layer uses route simulation and stub validation only. No live sending, workers, or mailbox polling."

/** Deterministic delivery event drafts. Client-safe. */

import type {
  GrowthDeliveryEventSeverity,
  GrowthDeliveryTimelineEventType,
  GrowthDeliveryValidationResult,
} from "@/lib/growth/providers/provider-types"

export type DeliveryEventDraft = {
  event_type: string
  severity: GrowthDeliveryEventSeverity
  title: string
  description: string
  timeline_type?: GrowthDeliveryTimelineEventType
  metadata?: Record<string, unknown>
}

export function buildProviderConnectedEvent(providerName: string): DeliveryEventDraft {
  return {
    event_type: "provider_connected",
    severity: "low",
    title: "Provider connected",
    description: `${providerName} registered for delivery routing.`,
    timeline_type: "provider_connected",
  }
}

export function buildProviderValidationFailedEvent(providerName: string, summary: string): DeliveryEventDraft {
  return {
    event_type: "provider_validation_failed",
    severity: "high",
    title: "Provider validation failed",
    description: `${providerName}: ${summary}`,
    timeline_type: "provider_validation_failed",
    metadata: { summary },
  }
}

export function buildProviderDisabledEvent(providerName: string): DeliveryEventDraft {
  return {
    event_type: "provider_disabled",
    severity: "medium",
    title: "Provider disabled",
    description: `${providerName} disabled from delivery routing.`,
    timeline_type: "provider_disabled",
  }
}

export function buildDeliveryRouteChangedEvent(senderLabel: string, providerName: string): DeliveryEventDraft {
  return {
    event_type: "delivery_route_changed",
    severity: "low",
    title: "Delivery route changed",
    description: `Route for ${senderLabel} updated to ${providerName}.`,
    timeline_type: "delivery_route_changed",
    metadata: { sender_label: senderLabel, provider_name: providerName },
  }
}

export function buildFallbackRouteTriggeredEvent(
  primaryProvider: string,
  fallbackProvider: string,
): DeliveryEventDraft {
  return {
    event_type: "fallback_route_triggered",
    severity: "medium",
    title: "Fallback route triggered",
    description: `Routing shifted from ${primaryProvider} to fallback ${fallbackProvider}.`,
    timeline_type: "fallback_route_triggered",
    metadata: { primary_provider: primaryProvider, fallback_provider: fallbackProvider },
  }
}

export function buildValidationEventDraft(
  providerName: string,
  result: GrowthDeliveryValidationResult,
  summary: string,
): DeliveryEventDraft | null {
  if (result === "supported") {
    return {
      event_type: "provider_validated",
      severity: "low",
      title: "Provider validated",
      description: `${providerName}: ${summary}`,
      metadata: { result, summary },
    }
  }
  if (result === "warning") {
    return {
      event_type: "provider_validation_warning",
      severity: "medium",
      title: "Provider validation warning",
      description: `${providerName}: ${summary}`,
      metadata: { result, summary },
    }
  }
  return buildProviderValidationFailedEvent(providerName, summary)
}

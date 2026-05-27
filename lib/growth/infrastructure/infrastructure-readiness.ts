import "server-only"

import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { GROWTH_OUTBOUND_PROVIDER_CAPABILITIES } from "@/lib/growth/outbound/provider-capabilities"
import { listDeliveryProviderRegistry } from "@/lib/growth/providers/provider-registry"
import { supportsLiveTransport } from "@/lib/growth/providers/adapters/provider-transport-capability-registry"
import {
  isGrowthInboxSyncSimulationEnabled,
  isGrowthTransportSimulationEnabled,
} from "@/lib/growth/runtime/runtime-guards"
import type {
  GrowthInfrastructureReadinessCatalogEntry,
  GrowthInfrastructureReadinessDescriptor,
  GrowthInfrastructureSurfaceId,
} from "@/lib/growth/infrastructure/infrastructure-readiness-types"
import { growthInfrastructureReadinessLabel } from "@/lib/growth/infrastructure/infrastructure-readiness-types"

function descriptor(
  status: GrowthInfrastructureReadinessDescriptor["status"],
  detail?: string,
): GrowthInfrastructureReadinessDescriptor {
  return { status, label: growthInfrastructureReadinessLabel(status), detail }
}

export function resolveTransportSendReadiness(): GrowthInfrastructureReadinessDescriptor {
  if (isGrowthTransportSimulationEnabled()) {
    return descriptor(
      "simulated",
      "GROWTH_TRANSPORT_SIMULATE=true — sends return simulated provider IDs only.",
    )
  }
  return descriptor("live", "Transport orchestrator executes via configured provider adapters.")
}

export function resolveInboxSyncReadiness(): GrowthInfrastructureReadinessDescriptor {
  if (isGrowthInboxSyncSimulationEnabled()) {
    return descriptor("simulated", "GROWTH_INBOX_SYNC_SIMULATE=true — no live mailbox polling.")
  }
  return descriptor("live", "Inbox sync cron polls connected mailboxes when credentials are present.")
}

export function resolveMailboxProviderReadiness(
  providerFamily: "google" | "microsoft" | "smtp" | "custom",
): GrowthInfrastructureReadinessDescriptor {
  if (providerFamily === "google") {
    if (googleProviderOAuthConfigured()) {
      return descriptor("live", "Google OAuth + Gmail send path configured.")
    }
    return descriptor("stub", "Google OAuth env incomplete — validation uses stub checks only.")
  }
  if (providerFamily === "microsoft") {
    return descriptor("preview_only", "Microsoft 365 OAuth path not operationalized in this milestone.")
  }
  if (providerFamily === "smtp") {
    return descriptor("internal", "SMTP credentials supported for operator testing — not primary send plane.")
  }
  return descriptor("stub", "Custom mailbox provider remains stub-only.")
}

export function resolveDnsValidationReadiness(): GrowthInfrastructureReadinessDescriptor {
  return descriptor(
    "stub",
    "MANUAL VERIFICATION REQUIRED — no live DNS probe; operator must verify SPF/DKIM/DMARC/MX externally.",
  )
}

export function resolveWarmupReadiness(): GrowthInfrastructureReadinessDescriptor {
  return descriptor("disabled", "Warmup execution is not enabled — registry and planning UI only.")
}

export function resolveWebhookIngestionReadiness(): GrowthInfrastructureReadinessDescriptor {
  return descriptor("live", "Provider webhook endpoints ingest normalized delivery events when configured.")
}

export function resolveDeliverabilityReadiness(): GrowthInfrastructureReadinessDescriptor {
  return descriptor("internal", "Deliverability dashboards aggregate real bounces/complaints — no fake scores.")
}

export function resolveOutboundProviderReadiness(providerFamily: string): GrowthInfrastructureReadinessDescriptor {
  const entry = GROWTH_OUTBOUND_PROVIDER_CAPABILITIES.find((item) => item.providerFamily === providerFamily)
  if (!entry) return descriptor("stub", "Unknown outbound provider.")
  if (entry.fixtureOnly) return descriptor("stub", `${entry.displayName} remains fixture/stub-only.`)
  return descriptor("live", `${entry.displayName} is the live cold outbound execution provider.`)
}

export function buildGrowthInfrastructureReadinessCatalog(): GrowthInfrastructureReadinessCatalogEntry[] {
  const surfaces: Array<{ surfaceId: GrowthInfrastructureSurfaceId; title: string; readiness: GrowthInfrastructureReadinessDescriptor }> = [
    { surfaceId: "transport_send", title: "Transport send plane", readiness: resolveTransportSendReadiness() },
    { surfaceId: "mailbox_provider", title: "Google mailbox (primary)", readiness: resolveMailboxProviderReadiness("google") },
    { surfaceId: "mailbox_provider", title: "Microsoft mailbox", readiness: resolveMailboxProviderReadiness("microsoft") },
    { surfaceId: "inbox_sync", title: "Inbox sync worker", readiness: resolveInboxSyncReadiness() },
    { surfaceId: "dns_validation", title: "DNS validation", readiness: resolveDnsValidationReadiness() },
    { surfaceId: "warmup", title: "Mailbox warmup", readiness: resolveWarmupReadiness() },
    { surfaceId: "webhook_ingestion", title: "Webhook ingestion", readiness: resolveWebhookIngestionReadiness() },
    { surfaceId: "deliverability", title: "Deliverability intelligence", readiness: resolveDeliverabilityReadiness() },
    { surfaceId: "outbound_provider", title: "Lemlist cold outbound", readiness: resolveOutboundProviderReadiness("lemlist") },
  ]

  for (const provider of listDeliveryProviderRegistry()) {
    surfaces.push({
      surfaceId: "delivery_provider",
      title: `${provider.label} delivery`,
      readiness: supportsLiveTransport(provider.provider_family)
        ? descriptor("live", "Adapter registered for transport orchestrator.")
        : descriptor("stub", "Transport adapter stub or preview-only."),
    })
  }

  return surfaces
}

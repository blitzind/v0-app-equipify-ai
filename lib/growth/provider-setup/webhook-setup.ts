import "server-only"

import { randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createProviderWebhookEndpoint,
  findWebhookEndpointByFamily,
  listProviderWebhookEndpoints,
  updateProviderWebhookEndpoint,
} from "@/lib/growth/webhooks/webhook-repository"
import { hashWebhookSigningSecret } from "@/lib/growth/webhooks/webhook-sanitizer"
import { recordProviderSecretAuditEvent } from "@/lib/growth/provider-setup/provider-setup-events"
import type { GrowthProviderSetupFamily } from "@/lib/growth/provider-setup/provider-setup-types"
import { upsertProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"

export type ProviderWebhookSetupSummary = {
  provider_family: GrowthProviderSetupFamily
  endpoint_slug: string
  webhook_url: string
  status: string
  signing_secret_configured: boolean
}

export function buildProviderWebhookPublicUrl(origin: string, endpointSlug: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}/api/growth/webhooks/provider/${endpointSlug}`
}

export async function fetchProviderWebhookSetup(
  admin: SupabaseClient,
  origin: string,
): Promise<ProviderWebhookSetupSummary[]> {
  const endpoints = await listProviderWebhookEndpoints(admin)
  return endpoints.map((endpoint) => ({
    provider_family: endpoint.providerFamily as GrowthProviderSetupFamily,
    endpoint_slug: endpoint.endpointSlug,
    webhook_url: buildProviderWebhookPublicUrl(origin, endpoint.endpointSlug),
    status: endpoint.status,
    signing_secret_configured: true,
  }))
}

export async function configureProviderWebhookEndpoint(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupFamily
    origin: string
    signingSecret?: string | null
    actorUserId: string
  },
): Promise<ProviderWebhookSetupSummary> {
  const endpointSlug = input.providerFamily
  const signingSecret = input.signingSecret?.trim() || randomBytes(24).toString("hex")
  const signingSecretHash = hashWebhookSigningSecret(signingSecret)

  const existing = await findWebhookEndpointByFamily(admin, input.providerFamily)
  const endpoint = existing
    ? await updateProviderWebhookEndpoint(admin, existing.id, {
        status: "active",
        signingSecretHash,
        metadata: { configured_via: "provider_setup" },
      })
    : await createProviderWebhookEndpoint(admin, {
        providerFamily: input.providerFamily,
        endpointSlug,
        status: "active",
        signingSecretHash,
        metadata: { configured_via: "provider_setup" },
      })

  await upsertProviderConnectionSettings(admin, {
    provider_family: input.providerFamily,
    webhook_endpoint_id: endpoint.id,
    status: "connected",
    actorUserId: input.actorUserId,
  })

  await recordProviderSecretAuditEvent(admin, {
    providerFamily: input.providerFamily,
    action: "webhook_secret_updated",
    actorUserId: input.actorUserId,
    metadata: { endpoint_id: endpoint.id, endpoint_slug: endpointSlug },
  })

  return {
    provider_family: input.providerFamily,
    endpoint_slug: endpoint.endpointSlug,
    webhook_url: buildProviderWebhookPublicUrl(input.origin, endpoint.endpointSlug),
    status: endpoint.status,
    signing_secret_configured: true,
  }
}

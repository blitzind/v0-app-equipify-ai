import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getMailboxConnection } from "@/lib/growth/mailboxes/mailbox-repository"
import { upsertProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"
import {
  createDeliveryProvider,
  listDeliveryProviders,
  listDeliveryRoutes,
  updateDeliveryProvider,
  upsertDeliveryRoute,
} from "@/lib/growth/providers/provider-repository"
import { getDeliveryProviderRegistryEntry } from "@/lib/growth/providers/provider-registry"
import { getSenderAccount, updateSenderAccount } from "@/lib/growth/sender/sender-repository"
import { ensureOAuthReplyIngestionConnection } from "@/lib/growth/replies/oauth-reply-ingestion-connection"
import {
  evaluateGrowthOutboundTransportReadiness,
  type GrowthOutboundTransportReadiness,
} from "@/lib/growth/runtime/outbound-transport-readiness"
import {
  formatGrowthOutboundTransportReadinessLabel,
  GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER,
} from "@/lib/growth/runtime/outbound-transport-readiness-types"

async function ensureDeliveryProviderForOAuthFamily(
  admin: SupabaseClient,
  providerFamily: "google" | "microsoft",
  actor: { userId: string; email?: string | null },
) {
  const providers = await listDeliveryProviders(admin)
  let provider = providers.find(
    (row) => row.provider_family === providerFamily && row.status !== "disabled",
  )

  if (!provider) {
    const registry = getDeliveryProviderRegistryEntry(providerFamily)
    provider = await createDeliveryProvider(admin, {
      provider_key: `${providerFamily}-oauth-default`,
      provider_name: registry.label,
      provider_family: providerFamily,
      status: "connected",
      actorUserId: actor.userId,
      actorEmail: actor.email ?? null,
    })
    return provider
  }

  if (provider.status !== "connected") {
    provider = await updateDeliveryProvider(admin, provider.id, {
      status: "connected",
      configuration_status: "ready",
      actorUserId: actor.userId,
      actorEmail: actor.email ?? null,
    })
  }

  return provider
}

/** Promote linked sender + default delivery route after OAuth mailbox connect. */
export async function wireOAuthProviderTransportAfterConnection(
  admin: SupabaseClient,
  input: {
    providerFamily: "google" | "microsoft"
    senderAccountId: string
    mailboxConnectionId: string
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<GrowthOutboundTransportReadiness> {
  const mailbox = await getMailboxConnection(admin, input.mailboxConnectionId)
  if (!mailbox || mailbox.status === "disabled" || mailbox.status === "failed") {
    return evaluateGrowthOutboundTransportReadiness(admin, {
      providerFamily: input.providerFamily,
      providerConnectionStatus: "connected",
      senderAccountId: input.senderAccountId,
      mailboxConnectionId: null,
    })
  }

  const sender = await getSenderAccount(admin, input.senderAccountId)
  if (!sender || sender.status === "disabled" || sender.status === "error") {
    return evaluateGrowthOutboundTransportReadiness(admin, {
      providerFamily: input.providerFamily,
      providerConnectionStatus: "connected",
      senderAccountId: input.senderAccountId,
      mailboxConnectionId: input.mailboxConnectionId,
    })
  }

  if (sender.status !== "connected") {
    await updateSenderAccount(admin, input.senderAccountId, {
      status: "connected",
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
    })
  }

  const provider = await ensureDeliveryProviderForOAuthFamily(admin, input.providerFamily, {
    userId: input.actorUserId,
    email: input.actorEmail ?? null,
  })

  const routes = await listDeliveryRoutes(admin)
  const existingRoute = routes.find(
    (route) =>
      route.provider_id === provider.id && route.sender_account_id === input.senderAccountId,
  )

  let deliveryRouteId = existingRoute?.id ?? null
  if (!existingRoute?.enabled) {
    const route = await upsertDeliveryRoute(admin, {
      provider_id: provider.id,
      sender_account_id: input.senderAccountId,
      enabled: true,
      priority: 100,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
    })
    deliveryRouteId = route.id
  }

  await upsertProviderConnectionSettings(admin, {
    provider_family: input.providerFamily,
    delivery_provider_id: provider.id,
    sender_account_id: input.senderAccountId,
    mailbox_connection_id: input.mailboxConnectionId,
    status: "connected",
    actorUserId: input.actorUserId,
  })

  await ensureOAuthReplyIngestionConnection(admin, {
    providerFamily: input.providerFamily,
    senderAccountId: input.senderAccountId,
    mailboxEmail: mailbox.email_address,
    actorUserId: input.actorUserId,
  })

  return {
    qaMarker: GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER,
    ready: true,
    blockReason: null,
    label: formatGrowthOutboundTransportReadinessLabel({ ready: true, blockReason: null, oauthConnected: true }),
    message: "Outbound transport is routable for standalone sequence execution.",
    senderAccountId: input.senderAccountId,
    deliveryRouteId,
    providerFamily: input.providerFamily,
  }
}

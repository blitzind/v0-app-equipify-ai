import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthProviderSetupFamily } from "@/lib/growth/provider-setup/provider-setup-types"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { getSenderAccount, listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"
import {
  formatGrowthOutboundTransportBlockMessage,
  formatGrowthOutboundTransportReadinessLabel,
  GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER,
  type GrowthOutboundTransportBlockReason,
  type GrowthOutboundTransportReadiness,
} from "@/lib/growth/runtime/outbound-transport-readiness-types"

export type { GrowthOutboundTransportBlockReason, GrowthOutboundTransportReadiness } from "@/lib/growth/runtime/outbound-transport-readiness-types"
export {
  formatGrowthOutboundTransportBlockMessage,
  formatGrowthOutboundTransportReadinessLabel,
  GROWTH_OUTBOUND_TRANSPORT_BLOCK_REASONS,
  GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER,
} from "@/lib/growth/runtime/outbound-transport-readiness-types"

const OAUTH_PROVIDER_FAMILIES = new Set<GrowthProviderSetupFamily>(["google", "microsoft"])

function isSenderOperationallyConnected(sender: GrowthSenderAccount | null): boolean {
  if (!sender) return false
  return sender.status === "connected"
}

function isSenderPending(sender: GrowthSenderAccount | null): boolean {
  if (!sender) return true
  return sender.status === "pending" || sender.status === "connecting"
}

function isSenderDisabled(sender: GrowthSenderAccount | null): boolean {
  if (!sender) return false
  return sender.status === "disabled" || sender.status === "error"
}

function senderHasEnabledRoute(
  senderAccountId: string,
  routes: Awaited<ReturnType<typeof listDeliveryRoutes>>,
): { routable: boolean; routeId: string | null } {
  const enabledRoute = routes.find(
    (route) => route.enabled && route.sender_account_id === senderAccountId,
  )
  if (enabledRoute) {
    return { routable: true, routeId: enabledRoute.id }
  }
  return { routable: false, routeId: null }
}

function buildReadiness(input: {
  ready: boolean
  blockReason: GrowthOutboundTransportBlockReason | null
  senderAccountId?: string | null
  deliveryRouteId?: string | null
  providerFamily?: string | null
  oauthConnected?: boolean
}): GrowthOutboundTransportReadiness {
  const blockReason = input.ready ? null : input.blockReason
  const label = formatGrowthOutboundTransportReadinessLabel({
    ready: input.ready,
    blockReason,
    oauthConnected: input.oauthConnected,
  })
  const message = input.ready
    ? "Outbound transport is routable for standalone sequence execution."
    : blockReason
      ? formatGrowthOutboundTransportBlockMessage(blockReason)
      : "Outbound transport is not routable."

  return {
    qaMarker: GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER,
    ready: input.ready,
    blockReason,
    label,
    message,
    senderAccountId: input.senderAccountId ?? null,
    deliveryRouteId: input.deliveryRouteId ?? null,
    providerFamily: input.providerFamily ?? null,
  }
}

async function evaluateSenderRoutability(
  admin: SupabaseClient,
  senderAccountId: string,
  routes: Awaited<ReturnType<typeof listDeliveryRoutes>>,
): Promise<GrowthOutboundTransportReadiness> {
  const sender = await getSenderAccount(admin, senderAccountId)
  const { routable, routeId } = senderHasEnabledRoute(senderAccountId, routes)

  if (routable || isSenderOperationallyConnected(sender)) {
    return buildReadiness({
      ready: true,
      blockReason: null,
      senderAccountId,
      deliveryRouteId: routeId,
    })
  }

  if (isSenderDisabled(sender)) {
    return buildReadiness({
      ready: false,
      blockReason: "sender_disabled",
      senderAccountId,
    })
  }

  if (isSenderPending(sender)) {
    return buildReadiness({
      ready: false,
      blockReason: "sender_pending",
      senderAccountId,
    })
  }

  return buildReadiness({
    ready: false,
    blockReason: "no_enabled_delivery_route",
    senderAccountId,
  })
}

export async function evaluateGrowthOutboundTransportReadiness(
  admin: SupabaseClient,
  context?: {
    providerFamily?: GrowthProviderSetupFamily
    providerConnectionStatus?: string | null
    senderAccountId?: string | null
    mailboxConnectionId?: string | null
  },
): Promise<GrowthOutboundTransportReadiness> {
  const routes = await listDeliveryRoutes(admin)

  if (context?.providerFamily && OAUTH_PROVIDER_FAMILIES.has(context.providerFamily)) {
    if (context.providerConnectionStatus !== "connected") {
      return buildReadiness({
        ready: false,
        blockReason: "provider_disconnected",
        providerFamily: context.providerFamily,
        oauthConnected: false,
      })
    }

    if (!context.mailboxConnectionId) {
      return buildReadiness({
        ready: false,
        blockReason: "mailbox_not_linked",
        providerFamily: context.providerFamily,
        senderAccountId: context.senderAccountId ?? null,
        oauthConnected: true,
      })
    }

    if (!context.senderAccountId) {
      return buildReadiness({
        ready: false,
        blockReason: "sender_pending",
        providerFamily: context.providerFamily,
        oauthConnected: true,
      })
    }

    const familyReadiness = await evaluateSenderRoutability(admin, context.senderAccountId, routes)
    return {
      ...familyReadiness,
      providerFamily: context.providerFamily,
      label: formatGrowthOutboundTransportReadinessLabel({
        ready: familyReadiness.ready,
        blockReason: familyReadiness.blockReason,
        oauthConnected: true,
      }),
    }
  }

  const resolved = await resolveSequenceExecutionSender(admin).catch(() => null)
  if (resolved) {
    const routeMatch = routes.find(
      (route) => route.enabled && route.sender_account_id === resolved.senderAccountId,
    )
    return buildReadiness({
      ready: true,
      blockReason: null,
      senderAccountId: resolved.senderAccountId,
      deliveryRouteId: routeMatch?.id ?? null,
    })
  }

  const senders = await listSenderAccounts(admin)
  const enabledRoute = routes.find((route) => route.enabled)
  if (enabledRoute) {
    return buildReadiness({
      ready: true,
      blockReason: null,
      senderAccountId: enabledRoute.sender_account_id,
      deliveryRouteId: enabledRoute.id,
    })
  }

  const pendingSender = senders.find((sender) => isSenderPending(sender))
  if (pendingSender) {
    return buildReadiness({
      ready: false,
      blockReason: "sender_pending",
      senderAccountId: pendingSender.id,
    })
  }

  const disabledSender = senders.find((sender) => isSenderDisabled(sender))
  if (disabledSender) {
    return buildReadiness({
      ready: false,
      blockReason: "sender_disabled",
      senderAccountId: disabledSender.id,
    })
  }

  if (routes.length > 0) {
    return buildReadiness({
      ready: false,
      blockReason: "no_enabled_delivery_route",
      senderAccountId: routes[0]?.sender_account_id ?? null,
    })
  }

  return buildReadiness({
    ready: false,
    blockReason: "no_enabled_delivery_route",
  })
}

/** True when standalone transport can resolve an execution sender. */
export async function isGrowthOutboundTransportConfigured(
  admin: SupabaseClient,
): Promise<boolean> {
  const readiness = await evaluateGrowthOutboundTransportReadiness(admin)
  return readiness.ready
}

export function isGrowthOutboundTransportBlockReason(
  value: string | null | undefined,
): value is GrowthOutboundTransportBlockReason {
  return (
    value === "no_enabled_delivery_route" ||
    value === "sender_pending" ||
    value === "sender_disabled" ||
    value === "mailbox_not_linked" ||
    value === "provider_disconnected"
  )
}

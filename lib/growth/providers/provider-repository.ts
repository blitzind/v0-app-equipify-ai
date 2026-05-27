import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildProviderDeliveryDashboard } from "@/lib/growth/providers/provider-dashboard"
import {
  buildDeliveryRouteChangedEvent,
  buildFallbackRouteTriggeredEvent,
  buildProviderConnectedEvent,
  buildProviderDisabledEvent,
  buildValidationEventDraft,
} from "@/lib/growth/providers/provider-event-builder"
import { listDeliveryEvents, persistDeliveryEventDrafts, providerHasCriticalDeliveryEvent } from "@/lib/growth/providers/provider-events"
import { computeProviderHealthScore } from "@/lib/growth/providers/provider-health"
import {
  capabilitiesToLabel,
  getDeliveryProviderRegistryEntry,
  registryCapabilitiesToDbFlags,
} from "@/lib/growth/providers/provider-registry"
import type { DeliveryRouteCandidate } from "@/lib/growth/providers/provider-router"
import { selectDeliveryRoute } from "@/lib/growth/providers/provider-router"
import { validateProvider } from "@/lib/growth/providers/provider-validator"
import type {
  GrowthDeliveryEvent,
  GrowthDeliveryProvider,
  GrowthDeliveryProviderFamily,
  GrowthDeliveryProviderStatus,
  GrowthDeliveryRoute,
  GrowthDeliveryRouteSelection,
} from "@/lib/growth/providers/provider-types"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function providersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_providers")
}

function routesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_routes")
}

function activeProvidersQuery(admin: SupabaseClient) {
  return providersTable(admin).select("*").is("deleted_at", null)
}

function mapProvider(row: Row): GrowthDeliveryProvider {
  const family = asString(row.provider_family) as GrowthDeliveryProviderFamily
  const registry = getDeliveryProviderRegistryEntry(family)
  return {
    id: asString(row.id),
    provider_key: asString(row.provider_key),
    provider_name: asString(row.provider_name),
    provider_family: family,
    status: asString(row.status) as GrowthDeliveryProviderStatus,
    supports_send: Boolean(row.supports_send),
    supports_reply_sync: Boolean(row.supports_reply_sync),
    supports_tracking: Boolean(row.supports_tracking),
    supports_templates: Boolean(row.supports_templates),
    supports_validation: Boolean(row.supports_validation),
    supports_webhooks: Boolean(row.supports_webhooks),
    supports_rate_limits: Boolean(row.supports_rate_limits),
    max_daily_volume: asNumber(row.max_daily_volume, 0),
    health_score: asNumber(row.health_score, 100),
    last_validation_at: asString(row.last_validation_at) || null,
    configuration_status: asString(row.configuration_status) || "pending",
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    deleted_at: asString(row.deleted_at) || null,
    capabilities_label: capabilitiesToLabel(registry.capabilities),
  }
}

async function loadSenderLabel(admin: SupabaseClient, senderAccountId: string): Promise<string> {
  const senders = await listSenderAccounts(admin)
  const sender = senders.find((item) => item.id === senderAccountId)
  if (!sender) return "Sender"
  return sender.display_name || sender.email_address || "Sender"
}

async function loadProviderName(admin: SupabaseClient, providerId: string): Promise<string> {
  const { data } = await activeProvidersQuery(admin).select("provider_name").eq("id", providerId).maybeSingle()
  return asString((data as Row | null)?.provider_name) || "Provider"
}

async function mapRoute(admin: SupabaseClient, row: Row): Promise<GrowthDeliveryRoute> {
  const providerId = asString(row.provider_id)
  const fallbackRouteId = asString(row.fallback_route_id) || null
  const senderAccountId = asString(row.sender_account_id)

  const [{ data: provider }, senderLabel, fallbackProviderName] = await Promise.all([
    activeProvidersQuery(admin).select("provider_name, provider_family").eq("id", providerId).maybeSingle(),
    loadSenderLabel(admin, senderAccountId),
    fallbackRouteId
      ? routesTable(admin)
          .select("provider_id")
          .eq("id", fallbackRouteId)
          .maybeSingle()
          .then(async (fallbackRoute) => {
            const fallbackProviderId = asString((fallbackRoute.data as Row | null)?.provider_id)
            if (!fallbackProviderId) return null
            return loadProviderName(admin, fallbackProviderId)
          })
      : Promise.resolve(null),
  ])

  const providerRow = provider as Row | null
  return {
    id: asString(row.id),
    provider_id: providerId,
    provider_name: asString(providerRow?.provider_name) || "Provider",
    provider_family: asString(providerRow?.provider_family) as GrowthDeliveryProviderFamily,
    sender_account_id: senderAccountId,
    sender_label: senderLabel,
    priority: asNumber(row.priority, 100),
    enabled: Boolean(row.enabled),
    daily_cap: asNumber(row.daily_cap, 0),
    current_volume: asNumber(row.current_volume, 0),
    health_weight: asNumber(row.health_weight, 100),
    fallback_route_id: fallbackRouteId,
    fallback_provider_name: fallbackProviderName,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function recomputeProviderHealth(admin: SupabaseClient, providerId: string): Promise<GrowthDeliveryProvider> {
  const { data: existing, error: loadError } = await activeProvidersQuery(admin).select("*").eq("id", providerId).maybeSingle()
  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error("delivery_provider_not_found")

  const hasFailures = await providerHasCriticalDeliveryEvent(admin, providerId)
  const healthScore = computeProviderHealthScore({
    status: asString((existing as Row).status) as GrowthDeliveryProviderStatus,
    last_validation_at: asString((existing as Row).last_validation_at) || null,
    has_health_failures: hasFailures,
  })

  const { data, error } = await providersTable(admin)
    .update({ health_score: healthScore, updated_at: new Date().toISOString() })
    .is("deleted_at", null)
    .eq("id", providerId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapProvider(data as Row)
}

export async function listDeliveryProviders(admin: SupabaseClient): Promise<GrowthDeliveryProvider[]> {
  const { data, error } = await activeProvidersQuery(admin)
    .select("*")
    .order("provider_name", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapProvider(row as Row))
}

export async function getDeliveryProvider(admin: SupabaseClient, providerId: string): Promise<GrowthDeliveryProvider | null> {
  const { data, error } = await activeProvidersQuery(admin).select("*").eq("id", providerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProvider(data as Row)
}

export async function createDeliveryProvider(
  admin: SupabaseClient,
  input: {
    provider_key: string
    provider_name: string
    provider_family: GrowthDeliveryProviderFamily
    max_daily_volume?: number
    status?: GrowthDeliveryProviderStatus
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthDeliveryProvider> {
  const registry = getDeliveryProviderRegistryEntry(input.provider_family)
  const flags = registryCapabilitiesToDbFlags(registry.capabilities)
  const now = new Date().toISOString()

  const { data, error } = await providersTable(admin)
    .insert({
      provider_key: input.provider_key.trim(),
      provider_name: input.provider_name.trim(),
      provider_family: input.provider_family,
      status: input.status ?? "draft",
      max_daily_volume: input.max_daily_volume ?? 500,
      health_score: 100,
      configuration_status: "pending",
      ...flags,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const provider = mapProvider(data as Row)

  await persistDeliveryEventDrafts(admin, provider.id, [buildProviderConnectedEvent(provider.provider_name)], {
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  return provider
}

export async function updateDeliveryProvider(
  admin: SupabaseClient,
  providerId: string,
  input: {
    provider_name?: string
    status?: GrowthDeliveryProviderStatus
    max_daily_volume?: number
    configuration_status?: string
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthDeliveryProvider> {
  const existing = await getDeliveryProvider(admin, providerId)
  if (!existing) throw new Error("delivery_provider_not_found")

  const updates: Row = { updated_at: new Date().toISOString() }
  if (input.provider_name !== undefined) updates.provider_name = input.provider_name.trim()
  if (input.status !== undefined) updates.status = input.status
  if (input.max_daily_volume !== undefined) updates.max_daily_volume = input.max_daily_volume
  if (input.configuration_status !== undefined) updates.configuration_status = input.configuration_status

  const { data, error } = await providersTable(admin)
    .update(updates)
    .is("deleted_at", null)
    .eq("id", providerId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  if (input.status === "disabled" && existing.status !== "disabled") {
    await persistDeliveryEventDrafts(admin, providerId, [buildProviderDisabledEvent(existing.provider_name)], {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  return recomputeProviderHealth(admin, providerId)
}

export async function softDeleteDeliveryProvider(admin: SupabaseClient, providerId: string): Promise<void> {
  const existing = await getDeliveryProvider(admin, providerId)
  if (!existing) throw new Error("delivery_provider_not_found")

  const now = new Date().toISOString()
  const { error } = await providersTable(admin)
    .update({ deleted_at: now, status: "disabled", updated_at: now })
    .is("deleted_at", null)
    .eq("id", providerId)

  if (error) throw new Error(error.message)
}

export async function validateDeliveryProvider(
  admin: SupabaseClient,
  providerId: string,
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthDeliveryProvider> {
  const existing = await getDeliveryProvider(admin, providerId)
  if (!existing) throw new Error("delivery_provider_not_found")

  const outcome = validateProvider({
    provider_family: existing.provider_family,
    status: existing.status,
    supports_send: existing.supports_send,
  })

  const now = new Date().toISOString()
  const nextStatus: GrowthDeliveryProviderStatus =
    outcome.result === "error" || outcome.result === "unsupported"
      ? "degraded"
      : outcome.result === "warning"
        ? "warning"
        : "connected"

  const { error } = await providersTable(admin)
    .update({
      last_validation_at: now,
      configuration_status: outcome.configuration_status,
      status: existing.status === "disabled" ? "disabled" : nextStatus,
      updated_at: now,
    })
    .is("deleted_at", null)
    .eq("id", providerId)

  if (error) throw new Error(error.message)

  const draft = buildValidationEventDraft(existing.provider_name, outcome.result, outcome.summary)
  if (draft) {
    await persistDeliveryEventDrafts(admin, providerId, [draft], actor)
  }

  return recomputeProviderHealth(admin, providerId)
}

export async function listDeliveryRoutes(admin: SupabaseClient): Promise<GrowthDeliveryRoute[]> {
  const { data, error } = await routesTable(admin).select("*").order("priority", { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map((row) => mapRoute(admin, row as Row)))
}

export async function upsertDeliveryRoute(
  admin: SupabaseClient,
  input: {
    provider_id: string
    sender_account_id: string
    priority?: number
    enabled?: boolean
    daily_cap?: number
    health_weight?: number
    fallback_route_id?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthDeliveryRoute> {
  const provider = await getDeliveryProvider(admin, input.provider_id)
  if (!provider) throw new Error("delivery_provider_not_found")

  const senders = await listSenderAccounts(admin)
  if (!senders.some((sender) => sender.id === input.sender_account_id)) {
    throw new Error("sender_not_found")
  }

  const now = new Date().toISOString()
  const { data: existing } = await routesTable(admin)
    .select("id")
    .eq("provider_id", input.provider_id)
    .eq("sender_account_id", input.sender_account_id)
    .maybeSingle()

  let routeRow: Row
  if (existing) {
    const { data, error } = await routesTable(admin)
      .update({
        priority: input.priority ?? 100,
        enabled: input.enabled ?? true,
        daily_cap: input.daily_cap ?? 0,
        health_weight: input.health_weight ?? 100,
        fallback_route_id: input.fallback_route_id ?? null,
        updated_at: now,
      })
      .eq("id", asString((existing as Row).id))
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    routeRow = data as Row
  } else {
    const { data, error } = await routesTable(admin)
      .insert({
        provider_id: input.provider_id,
        sender_account_id: input.sender_account_id,
        priority: input.priority ?? 100,
        enabled: input.enabled ?? true,
        daily_cap: input.daily_cap ?? 0,
        current_volume: 0,
        health_weight: input.health_weight ?? 100,
        fallback_route_id: input.fallback_route_id ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    routeRow = data as Row
  }

  const route = await mapRoute(admin, routeRow)
  const senderLabel = route.sender_label
  await persistDeliveryEventDrafts(
    admin,
    input.provider_id,
    [buildDeliveryRouteChangedEvent(senderLabel, provider.provider_name)],
    { actorUserId: input.actorUserId, actorEmail: input.actorEmail },
  )

  return route
}

async function buildRouteCandidates(admin: SupabaseClient, senderAccountId?: string): Promise<DeliveryRouteCandidate[]> {
  const routes = await listDeliveryRoutes(admin)
  const filtered = senderAccountId ? routes.filter((route) => route.sender_account_id === senderAccountId) : routes
  const providers = await listDeliveryProviders(admin)
  const providerById = new Map(providers.map((provider) => [provider.id, provider]))

  return filtered.map((route) => {
    const provider = providerById.get(route.provider_id)
    return {
      route_id: route.id,
      provider_id: route.provider_id,
      provider_name: route.provider_name,
      provider_family: route.provider_family,
      provider_status: provider?.status ?? "draft",
      provider_health_score: provider?.health_score ?? 0,
      supports_send: provider?.supports_send ?? false,
      priority: route.priority,
      enabled: route.enabled,
      daily_cap: route.daily_cap,
      current_volume: route.current_volume,
      health_weight: route.health_weight,
      fallback_route_id: route.fallback_route_id,
    }
  })
}

export async function testDeliveryRoute(
  admin: SupabaseClient,
  input: {
    sender_account_id: string
    requested_volume?: number
    force_provider_status?: GrowthDeliveryProviderStatus
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthDeliveryRouteSelection> {
  const candidates = await buildRouteCandidates(admin, input.sender_account_id)
  const selection = selectDeliveryRoute({
    routes: candidates,
    requested_volume: input.requested_volume ?? 1,
    force_provider_status: input.force_provider_status,
  })

  if (selection.used_fallback && selection.selected_provider_name && selection.fallback_provider_name) {
    const providerId = candidates.find((route) => route.route_id === selection.selected_route_id)?.provider_id
    if (providerId) {
      await persistDeliveryEventDrafts(
        admin,
        providerId,
        [buildFallbackRouteTriggeredEvent(selection.fallback_provider_name, selection.selected_provider_name)],
        { actorUserId: input.actorUserId, actorEmail: input.actorEmail },
      )
    }
  }

  return {
    selected_route_id: selection.selected_route_id,
    selected_provider_name: selection.selected_provider_name,
    fallback_route_id: selection.fallback_route_id,
    fallback_provider_name: selection.fallback_provider_name,
    reason: selection.reason,
    used_fallback: selection.used_fallback,
  }
}

export async function fetchProviderDeliveryDashboard(admin: SupabaseClient): Promise<{
  dashboard: ReturnType<typeof buildProviderDeliveryDashboard>
  providers: GrowthDeliveryProvider[]
  routes: GrowthDeliveryRoute[]
  events: GrowthDeliveryEvent[]
  senders: Awaited<ReturnType<typeof listSenderAccounts>>
}> {
  const [providers, routes, events, senders] = await Promise.all([
    listDeliveryProviders(admin),
    listDeliveryRoutes(admin),
    listDeliveryEvents(admin, { limit: 30 }),
    listSenderAccounts(admin),
  ])

  return {
    dashboard: buildProviderDeliveryDashboard(providers),
    providers,
    routes,
    events,
    senders,
  }
}

export { listDeliveryEvents }

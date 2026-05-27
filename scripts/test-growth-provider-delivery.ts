/**
 * Regression checks for Provider Delivery Layer Foundation (Phase 2C).
 * Run: pnpm test:growth-provider-delivery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { simulateDeliveryRoute } from "../lib/growth/providers/delivery-routing"
import { buildProviderDeliveryDashboard } from "../lib/growth/providers/provider-dashboard"
import {
  buildDeliveryRouteChangedEvent,
  buildFallbackRouteTriggeredEvent,
  buildProviderConnectedEvent,
  buildValidationEventDraft,
} from "../lib/growth/providers/provider-event-builder"
import { computeProviderHealthScore, isValidationStale } from "../lib/growth/providers/provider-health"
import {
  GROWTH_DELIVERY_PROVIDER_REGISTRY,
  listDeliveryProviderRegistry,
} from "../lib/growth/providers/provider-registry"
import { selectDeliveryRoute, type DeliveryRouteCandidate } from "../lib/growth/providers/provider-router"
import { validateProvider } from "../lib/growth/providers/provider-validator"
import {
  GROWTH_DELIVERY_TIMELINE_EVENT_TYPES,
  GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER,
  GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE,
} from "../lib/growth/providers/provider-types"
import { GROWTH_PROVIDER_DELIVERY_SCHEMA_MIGRATION } from "../lib/growth/providers/provider-schema-health"

function sampleRoute(overrides: Partial<DeliveryRouteCandidate> = {}): DeliveryRouteCandidate {
  return {
    route_id: overrides.route_id ?? "r1",
    provider_id: overrides.provider_id ?? "p1",
    provider_name: overrides.provider_name ?? "Primary",
    provider_family: overrides.provider_family ?? "google",
    provider_status: overrides.provider_status ?? "connected",
    provider_health_score: overrides.provider_health_score ?? 90,
    supports_send: overrides.supports_send ?? true,
    priority: overrides.priority ?? 100,
    enabled: overrides.enabled ?? true,
    daily_cap: overrides.daily_cap ?? 500,
    current_volume: overrides.current_volume ?? 10,
    health_weight: overrides.health_weight ?? 100,
    fallback_route_id: overrides.fallback_route_id ?? null,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER, "growth-provider-delivery-foundation-v1")
  assert.match(GROWTH_PROVIDER_DELIVERY_PRIVACY_NOTE, /no live sending|stub/i)
  assert.equal(GROWTH_DELIVERY_TIMELINE_EVENT_TYPES.length, 5)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_PROVIDER_DELIVERY_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.delivery_providers/)
  assert.match(migration, /growth\.delivery_routes/)
  assert.match(migration, /growth\.delivery_events/)
  assert.match(migration, /delivery_route_changed/)
  assert.match(migration, /fallback_route_triggered/)
  assert.match(migration, /deleted_at/)
  assert.match(migration, /service role only/)

  const registry = listDeliveryProviderRegistry()
  assert.equal(registry.length, 8)
  assert.equal(GROWTH_DELIVERY_PROVIDER_REGISTRY.google.capabilities.send, true)
  assert.equal(GROWTH_DELIVERY_PROVIDER_REGISTRY.ses.capabilities.webhooks, true)
  assert.equal(GROWTH_DELIVERY_PROVIDER_REGISTRY.custom.capabilities.replySync, false)

  assert.equal(computeProviderHealthScore({ status: "connected" }), 85)
  assert.equal(computeProviderHealthScore({ status: "warning", last_validation_at: new Date().toISOString() }), 90)
  assert.equal(computeProviderHealthScore({ status: "degraded", has_health_failures: true, last_validation_at: new Date().toISOString() }), 55)
  assert.equal(isValidationStale(null), true)

  const supported = validateProvider({ provider_family: "google", supports_send: true })
  assert.equal(supported.result, "supported")
  const smtp = validateProvider({ provider_family: "smtp", supports_send: true })
  assert.equal(smtp.result, "warning")
  const custom = validateProvider({ provider_family: "custom", supports_send: false })
  assert.equal(custom.result, "warning")
  const disabled = validateProvider({ provider_family: "google", status: "disabled", supports_send: true })
  assert.equal(disabled.result, "error")

  const primary = sampleRoute({ route_id: "r1", provider_name: "Google Primary", priority: 120 })
  const fallback = sampleRoute({
    route_id: "r2",
    provider_id: "p2",
    provider_name: "SES Fallback",
    provider_family: "ses",
    priority: 80,
  })

  const selection = selectDeliveryRoute({ routes: [primary, fallback], requested_volume: 5 })
  assert.equal(selection.selected_provider_name, "Google Primary")
  assert.ok(selection.reason.includes("Google Primary"))

  const degraded = selectDeliveryRoute({
    routes: [
      sampleRoute({ route_id: "r1", provider_name: "Degraded", provider_status: "degraded", priority: 200 }),
      sampleRoute({ route_id: "r2", provider_name: "Healthy Backup", provider_status: "connected", priority: 100 }),
    ],
    requested_volume: 1,
  })
  assert.equal(degraded.used_fallback, true)
  assert.equal(degraded.selected_provider_name, "Healthy Backup")

  const capBlocked = selectDeliveryRoute({
    routes: [sampleRoute({ daily_cap: 10, current_volume: 10 })],
    requested_volume: 1,
  })
  assert.equal(capBlocked.selected_route_id, null)

  const simulated = simulateDeliveryRoute({
    routes: [primary, fallback],
    requested_volume: 3,
  })
  assert.equal(simulated.selected_provider_name, "Google Primary")

  assert.equal(buildProviderConnectedEvent("Acme Google").timeline_type, "provider_connected")
  assert.equal(buildDeliveryRouteChangedEvent("Acme Sender", "Google").timeline_type, "delivery_route_changed")
  assert.equal(
    buildFallbackRouteTriggeredEvent("Primary", "Fallback").timeline_type,
    "fallback_route_triggered",
  )
  assert.ok(buildValidationEventDraft("Acme", "error", "failed"))

  const dashboard = buildProviderDeliveryDashboard([
    {
      id: "p1",
      provider_key: "google-1",
      provider_name: "Google",
      provider_family: "google",
      status: "connected",
      supports_send: true,
      supports_reply_sync: true,
      supports_tracking: true,
      supports_templates: true,
      supports_validation: true,
      supports_webhooks: false,
      supports_rate_limits: true,
      max_daily_volume: 500,
      health_score: 90,
      last_validation_at: new Date().toISOString(),
      configuration_status: "stub_validated",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      id: "p2",
      provider_key: "ses-1",
      provider_name: "SES",
      provider_family: "ses",
      status: "warning",
      supports_send: true,
      supports_reply_sync: false,
      supports_tracking: true,
      supports_templates: true,
      supports_validation: true,
      supports_webhooks: true,
      supports_rate_limits: true,
      max_daily_volume: 1000,
      health_score: 70,
      last_validation_at: null,
      configuration_status: "pending",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      id: "p3",
      provider_key: "disabled-1",
      provider_name: "Disabled",
      provider_family: "custom",
      status: "disabled",
      supports_send: true,
      supports_reply_sync: false,
      supports_tracking: false,
      supports_templates: false,
      supports_validation: false,
      supports_webhooks: false,
      supports_rate_limits: false,
      max_daily_volume: 0,
      health_score: 45,
      last_validation_at: null,
      configuration_status: "disabled",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
  ])
  assert.equal(dashboard.qa_marker, GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER)
  assert.equal(dashboard.connected_count, 1)
  assert.equal(dashboard.warning_count, 1)
  assert.equal(dashboard.disabled_count, 1)

  const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/providers/provider-repository.ts"), "utf8")
  assert.match(repoSource, /createDeliveryProvider/)
  assert.match(repoSource, /testDeliveryRoute/)
  assert.match(repoSource, /validateDeliveryProvider/)
  assert.doesNotMatch(repoSource, /sendMail|executeSend|outbound_queue|pollMailbox/i)

  for (const route of [
    "app/api/platform/growth/providers/route.ts",
    "app/api/platform/growth/providers/dashboard/route.ts",
    "app/api/platform/growth/providers/validate/route.ts",
    "app/api/platform/growth/providers/route-test/route.ts",
    "app/api/platform/growth/providers/[id]/route.ts",
  ]) {
    const apiSource = fs.readFileSync(path.join(process.cwd(), route), "utf8")
    assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
    assert.doesNotMatch(apiSource, /sendMail|executeSend|pollMailbox/i)
  }

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-provider-delivery-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /Provider Health/)
  assert.match(uiSource, /Transport Health/)
  assert.match(uiSource, /Transport Simulator/)
  assert.match(uiSource, /GROWTH_PROVIDER_DELIVERY_FOUNDATION_QA_MARKER/)
  assert.doesNotMatch(uiSource, /encrypted_access_token|smtp_password|apiKey/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/providers\/delivery/)
  assert.match(navSource, /provider-delivery/)

  console.log("growth-provider-delivery: all checks passed")
}

void main()

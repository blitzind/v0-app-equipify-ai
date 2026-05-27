/**
 * Regression checks for Live Provider Transport Layer (Phase 2D).
 * Run: pnpm test:growth-provider-transport
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { googleProviderAdapter } from "../lib/growth/providers/adapters/google-provider"
import { microsoftProviderAdapter } from "../lib/growth/providers/adapters/microsoft-provider"
import { resendProviderAdapter } from "../lib/growth/providers/adapters/resend-provider"
import { sesProviderAdapter } from "../lib/growth/providers/adapters/ses-provider"
import { smtpProviderAdapter } from "../lib/growth/providers/adapters/smtp-provider"
import {
  getTransportAdapter,
} from "../lib/growth/providers/adapters/adapter-registry"
import {
  listTransportAdapterFamilies,
  supportsLiveTransport,
} from "../lib/growth/providers/adapters/provider-transport-capability-registry"
import {
  GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE,
  GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER,
  GROWTH_TRANSPORT_MAX_RETRIES,
  GROWTH_TRANSPORT_RETRY_DELAYS_MS,
  GROWTH_TRANSPORT_TIMELINE_EVENT_TYPES,
} from "../lib/growth/providers/adapters/provider-adapter-types"
import { buildRfc822Message } from "../lib/growth/providers/adapters/adapter-utils"
import { resolveTransportFallbackRoute, simulateTransportDelivery } from "../lib/growth/providers/transport/transport-fallback"
import { buildTransportHealthSnapshot, transportHealthLabel } from "../lib/growth/providers/transport/transport-health"
import {
  checkTransportRateLimit,
  defaultRateLimitsForProvider,
  incrementRateLimitCounters,
  rollRateLimitWindow,
} from "../lib/growth/providers/transport/transport-rate-limit"
import { GROWTH_LIVE_PROVIDER_TRANSPORT_SCHEMA_MIGRATION } from "../lib/growth/providers/transport/transport-schema-health"
import { selectDeliveryRoute, type DeliveryRouteCandidate } from "../lib/growth/providers/provider-router"

process.env.GROWTH_TRANSPORT_SIMULATE = "true"

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
  assert.equal(GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER, "growth-live-provider-transport-v1")
  assert.match(GROWTH_LIVE_PROVIDER_TRANSPORT_PRIVACY_NOTE, /human-approved/i)
  assert.equal(GROWTH_TRANSPORT_TIMELINE_EVENT_TYPES.length, 5)
  assert.equal(GROWTH_TRANSPORT_MAX_RETRIES, 3)
  assert.deepEqual(GROWTH_TRANSPORT_RETRY_DELAYS_MS.slice(0, 2), [0, 5 * 60 * 1000])

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_LIVE_PROVIDER_TRANSPORT_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.delivery_attempts/)
  assert.match(migration, /growth\.provider_rate_limits/)
  assert.match(migration, /delivery_queued/)
  assert.match(migration, /delivery_sent/)
  assert.match(migration, /delivery_failed/)
  assert.match(migration, /delivery_retry/)
  assert.match(migration, /rate_limit_hit/)
  assert.match(migration, /service role only/)

  const families = listTransportAdapterFamilies()
  assert.deepEqual(families.sort(), ["google", "microsoft", "resend", "ses", "smtp"].sort())
  assert.equal(supportsLiveTransport("google"), true)
  assert.equal(supportsLiveTransport("mailgun"), false)
  assert.equal(getTransportAdapter("google")?.family, "google")

  const googleValidation = googleProviderAdapter.validate({
    provider_family: "google",
    access_token: "token",
    from_address: "ops@example.com",
  })
  assert.equal(googleValidation.ok, true)

  const microsoftValidation = microsoftProviderAdapter.validate({
    provider_family: "microsoft",
    access_token: "token",
    from_address: "ops@example.com",
  })
  assert.equal(microsoftValidation.ok, true)

  const smtpValidation = smtpProviderAdapter.validate({
    provider_family: "smtp",
    smtp_host: "smtp.example.com",
    smtp_user: "user",
    smtp_password: "pass",
  })
  assert.equal(smtpValidation.ok, true)

  const sesValidation = sesProviderAdapter.validate({
    provider_family: "ses",
    aws_access_key_id: "AKIA",
    aws_secret_access_key: "secret",
    aws_region: "us-east-1",
    from_address: "ops@example.com",
  })
  assert.equal(sesValidation.ok, true)

  const resendValidation = resendProviderAdapter.validate({
    provider_family: "resend",
    api_key: "re_test",
    from_address: "ops@example.com",
  })
  assert.equal(resendValidation.ok, true)

  const googleSend = await googleProviderAdapter.send(
    { provider_family: "google", access_token: "token", from_address: "ops@example.com" },
    { to: "lead@example.com", subject: "Test", html: "<p>Hi</p>", from: "ops@example.com" },
  )
  assert.equal(googleSend.ok, true)
  assert.match(googleSend.provider_message_id ?? "", /sim-google/)

  const microsoftSend = await microsoftProviderAdapter.send(
    { provider_family: "microsoft", access_token: "token", from_address: "ops@example.com" },
    { to: "lead@example.com", subject: "Test", html: "<p>Hi</p>", from: "ops@example.com" },
  )
  assert.equal(microsoftSend.ok, true)

  const resendSend = await resendProviderAdapter.send(
    { provider_family: "resend", api_key: "re_test", from_address: "ops@example.com" },
    { to: "lead@example.com", subject: "Test", html: "<p>Hi</p>", from: "ops@example.com" },
  )
  assert.equal(resendSend.ok, true)

  const smtpSimulated = await smtpProviderAdapter.send(
    {
      provider_family: "smtp",
      smtp_host: "smtp.example.com",
      smtp_user: "user",
      smtp_password: "pass",
    },
    { to: "lead@example.com", subject: "Test", html: "<p>Hi</p>", from: "ops@example.com" },
  )
  assert.equal(smtpSimulated.ok, true)
  assert.match(smtpSimulated.provider_message_id ?? "", /sim-smtp/)

  const previousSimulate = process.env.GROWTH_TRANSPORT_SIMULATE
  delete process.env.GROWTH_TRANSPORT_SIMULATE
  const smtpLive = await smtpProviderAdapter.send(
    {
      provider_family: "smtp",
      smtp_host: "smtp.example.com",
      smtp_user: "user",
      smtp_password: "pass",
    },
    { to: "lead@example.com", subject: "Test", html: "<p>Hi</p>", from: "ops@example.com" },
  )
  assert.equal(smtpLive.ok, false)
  assert.match(smtpLive.error ?? "", /server runtime adapter wiring/i)
  if (previousSimulate) process.env.GROWTH_TRANSPORT_SIMULATE = previousSimulate
  else process.env.GROWTH_TRANSPORT_SIMULATE = "true"

  const rateRow = {
    id: "rl1",
    provider_id: "p1",
    minute_cap: 2,
    hour_cap: 10,
    day_cap: 100,
    current_minute: 2,
    current_hour: 2,
    current_day: 2,
    window_started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const blocked = checkTransportRateLimit(rateRow, 1)
  assert.equal(blocked.allowed, false)
  assert.match(blocked.reason, /Minute/)

  const fresh = checkTransportRateLimit({ ...rateRow, current_minute: 0 }, 1)
  assert.equal(fresh.allowed, true)

  const rolled = rollRateLimitWindow({ ...rateRow, current_minute: 1 }, Date.now() + 61_000)
  assert.equal(rolled.minute, 0)

  const incremented = incrementRateLimitCounters({ ...rateRow, current_minute: 0, current_hour: 0, current_day: 0 }, 1)
  assert.equal(incremented.current_minute, 1)

  const defaults = defaultRateLimitsForProvider(500)
  assert.ok(defaults.day_cap >= 500)

  const primary = sampleRoute({ route_id: "r1", provider_name: "Google" })
  const fallback = sampleRoute({ route_id: "r2", provider_id: "p2", provider_name: "SES", provider_family: "ses", priority: 80 })
  const selection = selectDeliveryRoute({ routes: [primary, fallback], requested_volume: 1 })
  assert.equal(selection.selected_provider_name, "Google")

  const fallbackOnly = resolveTransportFallbackRoute({
    routes: [primary, fallback],
    exclude_route_id: "r1",
  })
  assert.equal(fallbackOnly.provider_name, "SES")

  const simulation = simulateTransportDelivery({
    routes: [primary, fallback],
    rate_limit: { ...rateRow, current_minute: 0 },
    requested_volume: 1,
  })
  assert.equal(simulation.route.selected_provider_name, "Google")
  assert.equal(simulation.rate_limit.allowed, true)

  const health = buildTransportHealthSnapshot({
    attempts: [
      {
        id: "a1",
        provider_id: "p1",
        sender_account_id: "s1",
        lead_id: null,
        sequence_enrollment_id: null,
        channel: "email",
        status: "queued",
        queued_at: new Date().toISOString(),
        sent_at: null,
        failed_at: null,
        provider_message_id: null,
        failure_reason: null,
        retry_count: 0,
        metadata: {},
        created_at: new Date().toISOString(),
      },
    ],
    rate_limits: [rateRow],
    connected_provider_count: 2,
  })
  assert.equal(health.queued_count, 1)
  assert.ok(["Monitor", "Attention"].includes(transportHealthLabel(health)))

  const rfc822 = buildRfc822Message({ to: "a@b.com", subject: "Hi", text: "Hello", from: "ops@example.com" })
  assert.match(rfc822, /Subject: Hi/)
  assert.match(rfc822, /To: a@b.com/)

  const orchestratorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/transport/transport-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestratorSource, /TransportHumanApprovalRequiredError/)
  assert.match(orchestratorSource, /human_approved/)
  assert.match(orchestratorSource, /executeAttemptOnRoute/)
  assert.match(orchestratorSource, /assertPreSendSuppressionAllowed/)
  assert.match(orchestratorSource, /GROWTH_TRANSPORT_MAX_RETRIES/)

  const eventsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/transport/transport-events.ts"),
    "utf8",
  )
  assert.match(eventsSource, /recordTransportAuditEvent/)
  assert.match(eventsSource, /appendTransportTimelineEvent/)
  assert.match(eventsSource, /platform_timeline_events/)

  for (const routeFile of [
    "app/api/platform/growth/providers/send/route.ts",
    "app/api/platform/growth/providers/test-send/route.ts",
    "app/api/platform/growth/providers/delivery-attempts/route.ts",
    "app/api/platform/growth/providers/rate-limits/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8")
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.doesNotMatch(source, /apiKey|access_token|smtp_password/)
  }

  const sendRoute = fs.readFileSync(path.join(process.cwd(), "app/api/platform/growth/providers/send/route.ts"), "utf8")
  assert.match(sendRoute, /humanApproved: z\.literal\(true\)/)
  assert.match(sendRoute, /humanApprovalConfirmed: z\.literal\(true\)/)

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-provider-delivery-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /GROWTH_LIVE_PROVIDER_TRANSPORT_QA_MARKER/)
  assert.match(uiSource, /Transport Health/)
  assert.match(uiSource, /Rate Limits/)
  assert.match(uiSource, /Attempt Queue/)
  assert.match(uiSource, /Provider Delivery Feed/)
  assert.match(uiSource, /Transport Simulator/)
  assert.match(uiSource, /Live Send Test/)
  assert.match(uiSource, /human-approved/i)
  assert.doesNotMatch(uiSource, /encrypted_access_token|smtp_password|apiKey/)
  assert.doesNotMatch(uiSource, /adapter-registry/)

  const smtpSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/adapters/smtp-provider.ts"),
    "utf8",
  )
  assert.doesNotMatch(smtpSource, /from \"net\"|from \"tls\"|nodemailer/)
  assert.match(smtpSource, /server-only/)
  assert.match(smtpSource, /GROWTH_TRANSPORT_SIMULATE/)

  const capabilityRegistrySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/adapters/provider-transport-capability-registry.ts"),
    "utf8",
  )
  assert.doesNotMatch(capabilityRegistrySource, /adapter-registry|smtp-provider|net|tls/)
  assert.match(capabilityRegistrySource, /supportsLiveTransport/)

  console.log("growth-provider-transport: all checks passed")
}

void main()

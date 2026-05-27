/**
 * Regression checks for Growth Engine provider webhook ingestion (Phase 2G).
 * Run: pnpm test:growth-provider-webhooks
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_NORMALIZED_WEBHOOK_EVENT_TYPES,
  GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER,
  GROWTH_WEBHOOK_PRIVACY_NOTE,
  GROWTH_WEBHOOK_TIMELINE_EVENT_TYPES,
} from "../lib/growth/webhooks/webhook-types"
import { GROWTH_PROVIDER_WEBHOOK_SCHEMA_MIGRATION } from "../lib/growth/webhooks/webhook-schema-health"
import { mapWebhookEventType } from "../lib/growth/webhooks/webhook-normalizer"
import { normalizeSesWebhookPayload } from "../lib/growth/webhooks/provider-normalizers/ses-normalizer"
import { normalizeResendWebhookPayload } from "../lib/growth/webhooks/provider-normalizers/resend-normalizer"
import {
  hashWebhookPayload,
  hashWebhookSigningSecret,
  sanitizeProviderWebhookPayload,
} from "../lib/growth/webhooks/webhook-sanitizer"
import {
  isWebhookSimulationMode,
  verifyProviderWebhookSignature,
} from "../lib/growth/webhooks/webhook-signature"

async function main(): Promise<void> {
  assert.equal(GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER, "growth-provider-webhook-ingestion-v1")
  assert.match(GROWTH_WEBHOOK_PRIVACY_NOTE, /sanitized payloads/i)
  assert.match(GROWTH_WEBHOOK_PRIVACY_NOTE, /no raw email/i)
  assert.deepEqual(GROWTH_NORMALIZED_WEBHOOK_EVENT_TYPES, [
    "delivered",
    "deferred",
    "bounced",
    "complained",
    "unsubscribed",
    "opened",
    "clicked",
    "failed",
    "dropped",
    "unknown",
  ])
  assert.ok(GROWTH_WEBHOOK_TIMELINE_EVENT_TYPES.includes("provider_event_received"))
  assert.ok(GROWTH_WEBHOOK_TIMELINE_EVENT_TYPES.includes("webhook_signature_failed"))

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_PROVIDER_WEBHOOK_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.provider_delivery_events/)
  assert.match(migration, /growth\.provider_webhook_endpoints/)
  assert.match(migration, /payload_hash_unique unique \(payload_hash\)/)
  assert.match(migration, /provider_event_received/)
  assert.match(migration, /webhook_signature_failed/)
  assert.match(migration, /service role only/)

  assert.equal(mapWebhookEventType("email.delivered"), "delivered")
  assert.equal(mapWebhookEventType("bounce"), "bounced")
  assert.equal(mapWebhookEventType("spam_complaint"), "complained")
  assert.equal(mapWebhookEventType("unsubscribe"), "unsubscribed")
  assert.equal(mapWebhookEventType("email.opened"), "opened")
  assert.equal(mapWebhookEventType("link.clicked"), "clicked")
  assert.equal(mapWebhookEventType("delivery.failed"), "failed")
  assert.equal(mapWebhookEventType("dropped"), "dropped")

  const sesBounce = normalizeSesWebhookPayload({
    notificationType: "Bounce",
    mail: { messageId: "ses-msg-123" },
    bounce: {
      bounceType: "Permanent",
      bounceSubType: "General",
      bouncedRecipients: [{ emailAddress: "lead@example.com" }],
    },
  })
  assert.equal(sesBounce.normalizedEventType, "bounced")
  assert.equal(sesBounce.providerMessageId, "ses-msg-123")

  const resendDelivered = normalizeResendWebhookPayload({
    type: "email.delivered",
    data: { email_id: "re_abc", to: "lead@example.com" },
  })
  assert.equal(resendDelivered.normalizedEventType, "delivered")
  assert.equal(resendDelivered.providerMessageId, "re_abc")

  const sanitized = sanitizeProviderWebhookPayload({
    event: "bounce",
    authorization: "Bearer secret-token",
    smtp_password: "pw",
    headers: { "X-Custom": "value" },
    body: "<html><body>long email content that should never be stored raw in Growth Engine webhook ingestion</body></html>".repeat(
      5,
    ),
    message_id: "msg-1",
  })
  assert.equal(sanitized.authorization, undefined)
  assert.equal(sanitized.smtp_password, undefined)
  assert.equal(sanitized.headers, undefined)
  assert.equal(sanitized.body, "[redacted_body]")
  assert.equal(sanitized.message_id, "msg-1")

  const hash1 = hashWebhookPayload({
    providerFamily: "resend",
    rawBody: '{"type":"delivered"}',
    sanitizedPayload: { type: "delivered" },
  })
  const hash2 = hashWebhookPayload({
    providerFamily: "resend",
    rawBody: '{"type":"delivered"}',
    sanitizedPayload: { type: "delivered" },
  })
  const hash3 = hashWebhookPayload({
    providerFamily: "resend",
    rawBody: '{"type":"bounced"}',
    sanitizedPayload: { type: "bounced" },
  })
  assert.equal(hash1, hash2)
  assert.notEqual(hash1, hash3)
  assert.ok(hash1.length >= 32)

  const secretHash = hashWebhookSigningSecret("test-webhook-secret")
  assert.notEqual(secretHash, "test-webhook-secret")
  assert.equal(secretHash, hashWebhookSigningSecret("test-webhook-secret"))

  const prevEnv = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  assert.equal(isWebhookSimulationMode({ signingSecretHash: null, endpointStatus: "active" }), false)
  assert.equal(isWebhookSimulationMode({ signingSecretHash: null, endpointStatus: "simulation" }), true)
  process.env.NODE_ENV = prevEnv

  const simVerify = verifyProviderWebhookSignature({
    providerFamily: "resend",
    rawBody: "{}",
    headers: new Headers(),
    signingSecretHash: null,
    endpointStatus: "simulation",
  })
  assert.equal(simVerify.ok, true)
  assert.equal(simVerify.mode, "simulation")

  const routerSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/webhooks/webhook-router.ts"), "utf8")
  assert.match(routerSource, /recordEmailBounce/)
  assert.match(routerSource, /recordEmailComplaint/)
  assert.match(routerSource, /registerUnsubscribe/)
  assert.match(routerSource, /recordEmailOpen/)
  assert.match(routerSource, /recordEmailClick/)
  assert.match(routerSource, /updateDeliveryAttempt/)
  assert.match(routerSource, /findWebhookEventByPayloadHash/)
  assert.match(routerSource, /recordProviderEventReceivedTimelineEvent/)

  const publicRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/webhooks/provider/[providerFamily]/route.ts"),
    "utf8",
  )
  assert.match(publicRoute, /isGrowthEngineEnabledEnv/)
  assert.match(publicRoute, /createServiceRoleSupabaseClient/)
  assert.match(publicRoute, /ingestProviderWebhook/)
  assert.doesNotMatch(publicRoute, /requireGrowthEnginePlatformAccess/)
  assert.doesNotMatch(publicRoute, /signingSecret/)

  const platformRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/webhooks/provider-events/route.ts"),
    "utf8",
  )
  assert.match(platformRoute, /requireGrowthEnginePlatformAccess/)

  const endpointsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/webhooks/endpoints/route.ts"),
    "utf8",
  )
  assert.match(endpointsRoute, /hashWebhookSigningSecret/)
  assert.doesNotMatch(endpointsRoute, /signing_secret_hash/)

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-provider-webhooks-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /GROWTH_PROVIDER_WEBHOOK_INGESTION_QA_MARKER/)
  assert.match(uiSource, /Received 24h/)
  assert.match(uiSource, /Signature Failures/)
  assert.doesNotMatch(uiSource, /signingSecret/)
  assert.doesNotMatch(uiSource, /webhook-repository/)

  const deliveryUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-provider-delivery-dashboard.tsx"),
    "utf8",
  )
  assert.match(deliveryUi, /Webhook Health/)
  assert.match(deliveryUi, /Delivery Confirmation Rate/)
  assert.match(deliveryUi, /Last Provider Event/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/providers\/webhooks/)

  console.log("growth-provider-webhook-ingestion-v1: all checks passed")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

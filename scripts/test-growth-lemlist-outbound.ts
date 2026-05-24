/**
 * Regression checks for Growth Engine Lemlist outbound provider (slice 6.15A).
 * Run: pnpm test:growth-lemlist-outbound
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { classifyOutboundReply } from "../lib/growth/outbound/reply-classifier"
import { isKnownOutboundProvider, listOutboundProviderAdapters } from "../lib/growth/outbound/providers/registry"
import { parseLemlistConnectionConfig } from "../lib/growth/outbound/providers/lemlist/lemlist-config"
import {
  LEMLIST_AUTO_LAUNCH_WARNING,
  LEMLIST_PROVIDER_KEY,
  LEMLIST_WEBHOOK_VERIFICATION_NOTE,
} from "../lib/growth/outbound/providers/lemlist/lemlist-labels"
import {
  lemlistWebhookToEnvelope,
  mapLemlistWebhookEventType,
  parseLemlistWebhookPayload,
  verifyLemlistWebhookSecret,
} from "../lib/growth/outbound/providers/lemlist/lemlist-webhook-mapper"
import { mapLemlistApiError, mapLemlistExecutionError } from "../lib/growth/outbound/providers/lemlist/lemlist-errors"
import { GROWTH_OUTBOUND_PROVIDER_CAPABILITIES } from "../lib/growth/outbound/provider-capabilities"

assert.equal(mapLemlistWebhookEventType("contacted"), "sent")
assert.equal(mapLemlistWebhookEventType("emailsSent"), "sent")
assert.equal(mapLemlistWebhookEventType("hooked"), "opened")
assert.equal(mapLemlistWebhookEventType("attracted"), "clicked")
assert.equal(mapLemlistWebhookEventType("warmed"), "replied")
assert.equal(mapLemlistWebhookEventType("interested"), "replied")
assert.equal(mapLemlistWebhookEventType("notInterested"), "replied")
assert.equal(mapLemlistWebhookEventType("meetingBooked"), "replied")
assert.equal(mapLemlistWebhookEventType("bounced"), "bounced")
assert.equal(mapLemlistWebhookEventType("emailsUnsubscribed"), "unsubscribed")

const sentEnvelope = lemlistWebhookToEnvelope({
  _id: "evt-sent-1",
  type: "contacted",
  leadEmail: "jane@acme.example",
  campaignId: "cam_123",
  campaignName: "Outbound Q2",
})
assert.ok(sentEnvelope)
assert.equal(sentEnvelope?.eventType, "sent")
assert.equal(sentEnvelope?.provider, LEMLIST_PROVIDER_KEY)

const interestedEnvelope = lemlistWebhookToEnvelope({
  _id: "evt-int-1",
  type: "interested",
  leadEmail: "jane@acme.example",
})
assert.ok(interestedEnvelope)
assert.equal(interestedEnvelope?.eventType, "replied")
assert.equal(classifyOutboundReply(interestedEnvelope!.message?.bodyPreview ?? "").classification, "interested")

const notInterestedEnvelope = lemlistWebhookToEnvelope({
  _id: "evt-ni-1",
  type: "notInterested",
  leadEmail: "jane@acme.example",
})
assert.ok(notInterestedEnvelope)
assert.equal(classifyOutboundReply(notInterestedEnvelope!.message?.bodyPreview ?? "").classification, "not_interested")

const bounceEnvelope = lemlistWebhookToEnvelope({
  _id: "evt-bounce-1",
  type: "emailsBounced",
  leadEmail: "bad@acme.example",
  errorMessage: "hard bounce",
})
assert.ok(bounceEnvelope)
assert.equal(bounceEnvelope?.eventType, "bounced")
assert.equal(bounceEnvelope?.message?.bounceType, "hard")

const unsubscribeEnvelope = lemlistWebhookToEnvelope({
  _id: "evt-unsub-1",
  type: "unsubscribed",
  leadEmail: "optout@acme.example",
})
assert.ok(unsubscribeEnvelope)
assert.equal(unsubscribeEnvelope?.eventType, "unsubscribed")

const duplicateBatch = parseLemlistWebhookPayload([
  { _id: "evt-dup", type: "contacted", leadEmail: "a@example.com" },
  { _id: "evt-dup", type: "contacted", leadEmail: "a@example.com" },
])
assert.equal(duplicateBatch.length, 2)
assert.equal(duplicateBatch[0]?.providerEventId, duplicateBatch[1]?.providerEventId)

const headers = new Headers({ "x-growth-webhook-secret": "shared-secret" })
assert.equal(
  verifyLemlistWebhookSecret({ secret: "shared-secret", headers, payload: {} }).ok,
  true,
)
assert.equal(
  verifyLemlistWebhookSecret({ secret: "shared-secret", headers: new Headers(), payload: {}, querySecret: "shared-secret" }).ok,
  true,
)
assert.equal(
  verifyLemlistWebhookSecret({ secret: "shared-secret", headers: new Headers(), payload: { secret: "shared-secret" } }).ok,
  true,
)
assert.equal(
  verifyLemlistWebhookSecret({ secret: "shared-secret", headers: new Headers(), payload: {} }).ok,
  false,
)

const parsedConfig = parseLemlistConnectionConfig({
  defaultCampaignId: " cam_abc ",
  deduplicateAcrossCampaigns: true,
  campaignAutoLaunchWarning: true,
})
assert.equal(parsedConfig.defaultCampaignId, "cam_abc")
assert.equal(parsedConfig.deduplicateAcrossCampaigns, true)
assert.equal(parsedConfig.campaignAutoLaunchWarning, true)

const authError = mapLemlistApiError(401, { message: "Unauthorized" })
assert.equal(authError.code, "lemlist_auth_failed")
const rateError = mapLemlistApiError(429, {})
assert.equal(rateError.code, "lemlist_rate_limited")
const mappedExecution = mapLemlistExecutionError(authError)
assert.equal(mappedExecution.code, "lemlist_auth_failed")
assert.ok(!mappedExecution.message.toLowerCase().includes("secret"))

const lemlistCapability = GROWTH_OUTBOUND_PROVIDER_CAPABILITIES.find((entry) => entry.providerFamily === "lemlist")
assert.ok(lemlistCapability)
assert.equal(lemlistCapability?.fixtureOnly, false)

const adapters = listOutboundProviderAdapters()
assert.ok(adapters.some((entry) => entry.providerKey === LEMLIST_PROVIDER_KEY))
assert.ok(isKnownOutboundProvider(LEMLIST_PROVIDER_KEY))

const clientSafeFiles = [
  "lib/growth/outbound/providers/lemlist/lemlist-labels.ts",
  "lib/growth/outbound/providers/lemlist/lemlist-config.ts",
  "lib/growth/outbound/providers/lemlist/lemlist-webhook-mapper.ts",
  "lib/growth/outbound/providers/lemlist/lemlist-errors.ts",
]
for (const relativePath of clientSafeFiles) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
  assert.ok(!source.includes("server-only"), `${relativePath} must remain client-safe`)
  assert.ok(!source.includes("apiKey"), `${relativePath} must not expose apiKey field names in UI copy`)
}

const executeRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/outreach/queue/[queueId]/execute/route.ts"),
  "utf8",
)
assert.match(executeRouteSource, /approved.*scheduled/s)

const executeOutreachSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outreach/execute-outreach.ts"),
  "utf8",
)
assert.match(executeOutreachSource, /generation_not_approved/)
assert.match(executeOutreachSource, /LEMLIST_PROVIDER_KEY/)
assert.match(executeOutreachSource, /providerSubmission/)

const processEventSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outbound/process-event.ts"),
  "utf8",
)
assert.match(processEventSource, /findGrowthMessageEventByProviderId/)
assert.match(processEventSource, /unsubscribed/)
assert.match(processEventSource, /bounce_hard/)

const apiClientSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outbound/providers/lemlist/lemlist-api-client.ts"),
  "utf8",
)
assert.match(apiClientSource, /\/campaigns\/\$\{encodeURIComponent\(input\.campaignId\)\}\/leads\//)
assert.match(apiClientSource, /icebreaker/)
assert.match(apiClientSource, /deduplicate/)

const webhookRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/growth/webhooks/outbound/lemlist/[connectionId]/route.ts"),
  "utf8",
)
assert.match(webhookRouteSource, /verifyLemlistWebhookSecret/)
assert.match(webhookRouteSource, /signaturePreVerified: true/)

assert.ok(LEMLIST_AUTO_LAUNCH_WARNING.includes("running"))
assert.ok(LEMLIST_WEBHOOK_VERIFICATION_NOTE.includes("HMAC"))

console.log("growth lemlist outbound tests passed")

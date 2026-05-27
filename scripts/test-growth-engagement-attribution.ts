/**
 * Regression checks for Growth Engine engagement attribution (Phase 2E).
 * Run: pnpm test:growth-engagement-attribution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeAttributionEngagementScore,
  computeInactivityDecayPenalty,
  tierFromAttributionScore,
} from "../lib/growth/tracking/engagement-score"
import { injectTrackingPixel, GROWTH_TRACKING_PIXEL_BYTES } from "../lib/growth/tracking/tracking-pixel"
import { isSafeRedirectUrl, rewriteHtmlLinksForTracking } from "../lib/growth/tracking/tracking-links"
import {
  buildClickTrackingUrl,
  buildOpenTrackingUrl,
  createClickTrackingToken,
  createOpenTrackingToken,
  hashTrackingIp,
  signTrackingToken,
  verifyTrackingToken,
} from "../lib/growth/tracking/tracking-token"
import { applyOutboundEmailTracking } from "../lib/growth/tracking/tracking-links"
import { supportsTrackingSimulation, trackingHealthLabel } from "../lib/growth/tracking/tracking-health"
import {
  GROWTH_ENGAGEMENT_ATTRIBUTION_PRIVACY_NOTE,
  GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER,
  GROWTH_TRACKING_TIMELINE_EVENT_TYPES,
} from "../lib/growth/tracking/tracking-types"
import { GROWTH_ENGAGEMENT_TRACKING_SCHEMA_MIGRATION } from "../lib/growth/tracking/tracking-schema-health"
import { listTransportAdapterFamilies } from "../lib/growth/providers/adapters/provider-transport-capability-registry"

const ATTEMPT_ID = "00000000-0000-4000-8000-000000000099"
const NOW = new Date("2026-05-26T12:00:00.000Z")

async function main(): Promise<void> {
  assert.equal(GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER, "growth-engagement-attribution-v1")
  assert.match(GROWTH_ENGAGEMENT_ATTRIBUTION_PRIVACY_NOTE, /first-party/i)
  assert.match(GROWTH_ENGAGEMENT_ATTRIBUTION_PRIVACY_NOTE, /no third-party/i)
  assert.deepEqual(GROWTH_TRACKING_TIMELINE_EVENT_TYPES, [
    "email_opened",
    "email_clicked",
    "engagement_increased",
    "high_engagement_detected",
  ])

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_ENGAGEMENT_TRACKING_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.email_opens/)
  assert.match(migration, /growth\.email_clicks/)
  assert.match(migration, /growth\.engagement_scores/)
  assert.match(migration, /engagement_increased/)
  assert.match(migration, /high_engagement_detected/)
  assert.match(migration, /service role only/)

  const openToken = createOpenTrackingToken(ATTEMPT_ID)
  const openPayload = verifyTrackingToken(openToken)
  assert.ok(openPayload && openPayload.t === "open")
  assert.equal(openPayload.a, ATTEMPT_ID)

  const clickToken = createClickTrackingToken(ATTEMPT_ID, "https://example.com/pricing")
  const clickPayload = verifyTrackingToken(clickToken)
  assert.ok(clickPayload && clickPayload.t === "click")
  assert.equal(clickPayload.u, "https://example.com/pricing")

  assert.equal(verifyTrackingToken("invalid.token"), null)
  assert.equal(verifyTrackingToken(signTrackingToken({ t: "open", a: ATTEMPT_ID }).slice(0, -1) + "x"), null)

  assert.ok(buildOpenTrackingUrl(openToken).includes("/api/growth/track/open/"))
  assert.ok(buildClickTrackingUrl(clickToken).includes("/api/growth/track/click/"))

  const html = '<p>Hello</p><a href="https://example.com/demo">Demo</a>'
  const rewritten = rewriteHtmlLinksForTracking(html, { deliveryAttemptId: ATTEMPT_ID })
  assert.match(rewritten.html, /\/api\/growth\/track\/click\//)
  assert.equal(rewritten.clickTokenCount, 1)
  assert.equal(isSafeRedirectUrl("https://example.com"), true)
  assert.equal(isSafeRedirectUrl("javascript:alert(1)"), false)
  assert.equal(isSafeRedirectUrl("data:text/html,hello"), false)

  const tracked = applyOutboundEmailTracking({
    html,
    deliveryAttemptId: ATTEMPT_ID,
    baseUrl: "https://app.equipify.ai",
  })
  assert.match(tracked.html ?? "", /\/api\/growth\/track\/open\//)
  assert.match(tracked.html ?? "", /\/api\/growth\/track\/click\//)
  assert.equal(tracked.metadata.tracking_enabled, true)

  const pixelHtml = injectTrackingPixel("<html><body></body></html>", buildOpenTrackingUrl(openToken))
  assert.match(pixelHtml, /width="1"/)

  assert.ok(GROWTH_TRACKING_PIXEL_BYTES.length > 10)

  const fresh = computeAttributionEngagementScore({
    opens: 2,
    clicks: 1,
    replies: 0,
    meetings: 0,
    lastActivityAt: "2026-05-25T12:00:00.000Z",
    now: NOW,
  })
  assert.equal(fresh.baseScore, 25)
  assert.equal(fresh.score, 25)
  assert.equal(fresh.tier, "warm")

  const hot = computeAttributionEngagementScore({
    opens: 4,
    clicks: 4,
    replies: 1,
    meetings: 1,
    lastActivityAt: "2026-05-25T12:00:00.000Z",
    now: NOW,
  })
  assert.ok(hot.score >= 100)
  assert.equal(hot.tier, "hot")

  const decayed = computeAttributionEngagementScore({
    opens: 4,
    clicks: 2,
    replies: 0,
    meetings: 0,
    lastActivityAt: "2026-02-01T12:00:00.000Z",
    now: NOW,
  })
  assert.equal(computeInactivityDecayPenalty(95), 50)
  assert.ok(decayed.decayPenalty >= 50)
  assert.ok(decayed.score < decayed.baseScore)

  assert.equal(tierFromAttributionScore(10), "cold")
  assert.equal(tierFromAttributionScore(25), "warm")
  assert.equal(tierFromAttributionScore(60), "engaged")
  assert.equal(tierFromAttributionScore(120), "hot")

  const ipHash = hashTrackingIp("203.0.113.10")
  assert.ok(ipHash)
  assert.ok(ipHash!.length >= 16)
  assert.notEqual(ipHash, "203.0.113.10")
  assert.equal(hashTrackingIp(null), null)

  const sim = supportsTrackingSimulation()
  assert.equal(sim.trackingSupport, true)
  assert.equal(sim.linkRewriteSupport, true)
  assert.equal(sim.pixelSupport, true)
  assert.equal(trackingHealthLabel("healthy"), "Healthy")

  const openRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/track/open/[token]/route.ts"),
    "utf8",
  )
  const clickRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/growth/track/click/[token]/route.ts"),
    "utf8",
  )
  assert.match(openRoute, /GROWTH_TRACKING_PIXEL_BYTES/)
  assert.match(openRoute, /verifyTrackingToken/)
  assert.match(openRoute, /hashTrackingIp/)
  assert.match(clickRoute, /status: 302/)
  assert.match(clickRoute, /isSafeRedirectUrl/)

  const engagementRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/engagement/route.ts"),
    "utf8",
  )
  assert.match(engagementRoute, /requireGrowthEnginePlatformAccess/)

  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/transport/transport-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestrator, /applyOutboundEmailTracking/)

  const families = listTransportAdapterFamilies()
  assert.deepEqual(families.sort(), ["google", "microsoft", "resend", "ses", "smtp"].sort())

  console.log("growth-engagement-attribution-v1: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

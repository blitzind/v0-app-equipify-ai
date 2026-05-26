/**
 * Regression checks for Real-Time Intent Pixel foundation (Prompt 12).
 * Run: pnpm test:growth-intent-pixel
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeConsentStatus, resolveTrackingMode } from "../lib/growth/intent-pixel/consent-gate"
import { normalizeCollectPayload } from "../lib/growth/intent-pixel/capture-intent-event"
import { isDomainAllowed } from "../lib/growth/intent-pixel/intent-pixel-repository"
import { GROWTH_INTENT_PIXEL_QA_MARKER } from "../lib/growth/intent-pixel/intent-pixel-types"
import { buildIntentPixelScript } from "../lib/growth/intent-pixel/pixel-script"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE, resolvePiiCaptureSource, sanitizeSubmittedIdentity } from "../lib/growth/intent-pixel/pii-policy"
import { hasUtmSignal, mergeUtmAttribution, parseUtmFromUrl } from "../lib/growth/intent-pixel/utm-attribution"

assert.equal(GROWTH_INTENT_PIXEL_QA_MARKER, "growth-intent-pixel-v1")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270316120000_growth_engine_intent_pixel_foundation.sql"),
  "utf8",
)
assert.match(migration, /intent_pixel_sites/)
assert.match(migration, /intent_visitor_sessions/)
assert.match(migration, /intent_pageview_events/)
assert.match(migration, /intent_conversion_events/)
assert.match(migration, /intent_identified_contacts/)
assert.match(migration, /equipify-sandbox/)

const typesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/intent-pixel-types.ts"),
  "utf8",
)
assert.match(typesSource, /growth-intent-pixel-v1/)
assert.match(typesSource, /GROWTH_INTENT_PIXEL_PII_CAPTURE_SOURCES/)

const collectRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/growth/intent-pixel/collect/route.ts"),
  "utf8",
)
assert.match(collectRoute, /captureIntentPixelEvent/)
assert.match(collectRoute, /Access-Control-Allow-Origin/)

const pixelRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/growth/intent-pixel/pixel.js/route.ts"),
  "utf8",
)
assert.match(pixelRoute, /buildIntentPixelScript/)

const diagnosticsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/intent-pixel/diagnostics/route.ts"),
  "utf8",
)
assert.match(diagnosticsRoute, /requireGrowthEnginePlatformAccess/)
assert.match(diagnosticsRoute, /GROWTH_INTENT_PIXEL_QA_MARKER/)
assert.match(diagnosticsRoute, /fetchIntentPixelDiagnostics/)

// Consent gate
const site = {
  id: "1",
  site_key: "test",
  site_name: "Test",
  domain_allowlist: ["example.com"],
  tracking_enabled: true,
  consent_required: true,
}

let gate = resolveTrackingMode(site, "unknown", "pageview")
assert.equal(gate.accepted, false)
assert.equal(gate.mode, "rejected")

gate = resolveTrackingMode(site, "granted", "pageview")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "full")

gate = resolveTrackingMode(site, "denied", "consent_update")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "essential_only")

assert.equal(normalizeConsentStatus("GRANTED"), "granted")

// UTM / attribution
const utm = parseUtmFromUrl("https://example.com/pricing?utm_source=google&utm_medium=cpc")
assert.equal(utm.utm_source, "google")
assert.equal(utm.utm_medium, "cpc")
assert.equal(hasUtmSignal(utm), true)

const merged = mergeUtmAttribution({ utm_campaign: "spring" }, "https://example.com/?utm_source=newsletter")
assert.equal(merged.utm_source, "newsletter")
assert.equal(merged.utm_campaign, "spring")

// Domain allowlist
assert.equal(
  isDomainAllowed(site, "https://www.example.com/page"),
  true,
)
assert.equal(
  isDomainAllowed(site, "https://evil.com/page"),
  false,
)

// PII policy — anonymous pageviews never attach identity
const blocked = sanitizeSubmittedIdentity(
  { email: "a@example.com", full_name: "Anon" },
  null,
)
assert.equal(blocked.allowed, false)
assert.equal(blocked.identity, null)

const formPii = sanitizeSubmittedIdentity(
  { email: "lead@example.com" },
  resolvePiiCaptureSource("form_submit"),
)
assert.equal(formPii.allowed, true)
assert.equal(formPii.identity?.email, "lead@example.com")

assert.match(GROWTH_INTENT_PIXEL_PRIVACY_NOTE, /Anonymous visitors/)

// Collect payload normalization
const payload = normalizeCollectPayload({
  site_key: "equipify-sandbox",
  event_type: "pageview",
  page_url: "http://localhost:3000/demo",
})
assert.ok(payload)
assert.equal(payload.event_type, "pageview")

// Pixel script
const script = buildIntentPixelScript({
  collectUrl: "https://app.equipify.com/api/growth/intent-pixel/collect",
  siteKey: "equipify-sandbox",
})
assert.match(script, /growth-intent-pixel-v1/)
assert.match(script, /EquipifyIntentPixel/)
assert.match(script, /trackConversion/)
assert.doesNotMatch(script, /email.*inferred/i)

console.log("growth-intent-pixel-v1 checks passed")

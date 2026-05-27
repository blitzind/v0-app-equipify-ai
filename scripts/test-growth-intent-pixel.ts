/**
 * Regression checks for Real-Time Intent Pixel foundation (Prompts 12–13).
 * Run: pnpm test:growth-intent-pixel
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeConsentStatus, resolveTrackingMode } from "../lib/growth/intent-pixel/consent-gate"
import { normalizeCollectPayload } from "../lib/growth/intent-pixel/capture-intent-event"
import {
  GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
  GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
  GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
} from "../lib/growth/intent-pixel/intent-pixel-admin-types"
import { GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION } from "../lib/growth/intent-pixel/intent-pixel-schema-health"
import { isDomainAllowed } from "../lib/growth/intent-pixel/intent-pixel-repository"
import {
  buildIntentPixelScriptSnippet,
  isValidIntentPixelSiteKey,
  siteFlagsFromTrackingMode,
  trackingModeFromSite,
} from "../lib/growth/intent-pixel/intent-pixel-site-config"
import { GROWTH_INTENT_PIXEL_QA_MARKER } from "../lib/growth/intent-pixel/intent-pixel-types"
import { buildIntentPixelScript } from "../lib/growth/intent-pixel/pixel-script"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE, resolvePiiCaptureSource, sanitizeSubmittedIdentity } from "../lib/growth/intent-pixel/pii-policy"
import { hasUtmSignal, mergeUtmAttribution, parseUtmFromUrl } from "../lib/growth/intent-pixel/utm-attribution"

assert.equal(GROWTH_INTENT_PIXEL_QA_MARKER, "growth-intent-pixel-v1")
assert.equal(GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER, "growth-intent-pixel-admin-v1")
assert.equal(GROWTH_INTENT_PIXEL_LIVE_QA_MARKER, "growth-intent-pixel-live-v1")
assert.equal(GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER, "growth-live-visitor-monitor-v1")
assert.equal(
  GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION,
  "20270316120000_growth_engine_intent_pixel_foundation.sql",
)

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
assert.match(collectRoute, /GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER/)
assert.match(collectRoute, /rejection_code/)
assert.match(collectRoute, /logIntentPixelCollectRejection/)

const collectDebug = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/intent-pixel-collect-debug.ts"),
  "utf8",
)
assert.match(collectDebug, /consent_unknown/)
assert.match(collectDebug, /domain_not_allowed/)

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
assert.match(diagnosticsRoute, /fetchIntentPixelAdminDiagnostics/)

const sitesRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/intent-pixel/sites/route.ts"),
  "utf8",
)
assert.match(sitesRoute, /listIntentPixelSites/)
assert.match(sitesRoute, /createIntentPixelSite/)
assert.match(sitesRoute, /requireGrowthEnginePlatformAccess/)
assert.match(sitesRoute, /schema_ready/)
assert.match(sitesRoute, /GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION/)

const processRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/intent-pixel/process-recent/route.ts"),
  "utf8",
)
assert.match(processRoute, /processRecentIntentToLeadInbox/)
assert.match(processRoute, /requireGrowthEnginePlatformAccess/)
assert.match(processRoute, /GROWTH_INTENT_PIXEL_LIVE_QA_MARKER/)

const monitorRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/intent-pixel/monitor/route.ts"),
  "utf8",
)
assert.match(monitorRoute, /fetchLiveVisitorMonitorSnapshot/)
assert.match(monitorRoute, /GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER/)
assert.match(monitorRoute, /requireGrowthEnginePlatformAccess/)

const processSessionRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/intent-pixel/process-session/route.ts"),
  "utf8",
)
assert.match(processSessionRoute, /processIntentSessionToLeadInbox/)
assert.match(processSessionRoute, /requireGrowthEnginePlatformAccess/)

const monitorLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/live-visitor-monitor.ts"),
  "utf8",
)
assert.match(monitorLib, /buildInstallVerification/)
assert.match(monitorLib, /fetchLiveVisitorMonitorSnapshot/)
assert.doesNotMatch(monitorLib, /runLeadEnginePipeline|sendEmail|executePipeline/)

const sessionHandoff = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/process-intent-session-handoff.ts"),
  "utf8",
)
assert.match(sessionHandoff, /ingestIntentCandidateToLeadInbox/)
assert.match(sessionHandoff, /GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER/)
assert.doesNotMatch(sessionHandoff, /runLeadEnginePipeline|sendEmail/)

const handoffSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/process-recent-intent-handoff.ts"),
  "utf8",
)
assert.match(handoffSource, /bridgeRecentIntentSessions/)
assert.match(handoffSource, /ingestIntentCandidateToLeadInbox/)
assert.doesNotMatch(handoffSource, /runLeadEnginePipeline|sendEmail|executePipeline/)

const eventsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/intent-pixel/events/recent/route.ts"),
  "utf8",
)
assert.match(eventsRoute, /fetchIntentPixelRecentEvents/)

const adminPage = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/intent-pixel/page.tsx"),
  "utf8",
)
assert.match(adminPage, /GrowthIntentPixelAdmin/)
assert.doesNotMatch(adminPage, /GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER/)
assert.doesNotMatch(adminPage, /growth-intent-pixel-admin-v1/)

const adminUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-intent-pixel-admin.tsx"),
  "utf8",
)
assert.match(adminUi, /Privacy guardrails/)
assert.match(adminUi, /Copy script/)
assert.match(adminUi, /Event stream/)
assert.match(adminUi, /GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER/)
assert.match(adminUi, /data-qa-marker=\{GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER\}/)
assert.match(adminUi, /Process recent intent/)
assert.match(adminUi, /Schema:/)
assert.match(adminUi, /"Ready"/)
assert.match(adminUi, /GROWTH_INTENT_PIXEL_SCHEMA_MIGRATION/)
assert.doesNotMatch(adminUi, /submitted_identity/)
assert.doesNotMatch(adminUi, /identified_contacts.*select.*email/i)

const sidebar = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
  "utf8",
)
assert.match(sidebar, /\/admin\/growth\/intent-pixel/)
assert.match(sidebar, /Intent Pixel/)

const adminRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/intent-pixel-admin-repository.ts"),
  "utf8",
)
assert.match(adminRepo, /PII_METADATA_KEY/)
assert.match(adminRepo, /consent_denied_sessions_24h/)
assert.doesNotMatch(adminRepo, /email.*full_name.*linkedin.*from.*identified/)

// Site config
assert.equal(
  trackingModeFromSite({
    tracking_enabled: false,
    consent_required: true,
    allow_anonymous_pageviews: false,
  }),
  "disabled",
)
assert.equal(
  trackingModeFromSite({
    tracking_enabled: true,
    consent_required: true,
    allow_anonymous_pageviews: true,
  }),
  "anonymous_pageviews",
)
assert.equal(siteFlagsFromTrackingMode("always_on").consent_required, false)
assert.equal(siteFlagsFromTrackingMode("anonymous_pageviews").allow_anonymous_pageviews, true)
assert.equal(isValidIntentPixelSiteKey("equipify-sandbox"), true)
assert.match(
  buildIntentPixelScriptSnippet("https://app.test", "equipify-sandbox").script_snippet,
  /pixel\.js\?site_key=equipify-sandbox/,
)

// Consent gate
const site = {
  id: "1",
  site_key: "test",
  site_name: "Test",
  domain_allowlist: ["example.com"],
  tracking_enabled: true,
  consent_required: true,
  allow_anonymous_pageviews: false,
}

let gate = resolveTrackingMode(site, "unknown", "pageview")
assert.equal(gate.accepted, false)
assert.equal(gate.mode, "rejected")

const anonSite = { ...site, allow_anonymous_pageviews: true }
gate = resolveTrackingMode(anonSite, "unknown", "pageview")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "essential_only")

gate = resolveTrackingMode(anonSite, "unknown", "conversion")
assert.equal(gate.accepted, false)
assert.equal(gate.mode, "rejected")

gate = resolveTrackingMode(site, "granted", "pageview")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "full")

gate = resolveTrackingMode(site, "denied", "consent_update")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "essential_only")

gate = resolveTrackingMode(site, "denied", "conversion", "form_submit")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "essential_only")

gate = resolveTrackingMode(site, "denied", "pageview")
assert.equal(gate.accepted, false)

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
assert.match(script, /equipify_intent_consent_ts/)
assert.match(script, /allowsAnalytics/)
assert.doesNotMatch(script, /email.*inferred/i)

const monitorUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/intent-pixel-monitor/growth-live-visitor-monitor.tsx"),
  "utf8",
)
assert.match(monitorUi, /InstallVerificationCard/)
assert.match(monitorUi, /LiveVisitorsPanel/)
assert.match(monitorUi, /VisitorTimelinePanel/)
assert.match(monitorUi, /HighIntentQueuePanel/)
assert.match(monitorUi, /data-qa-marker=\{GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER\}/)
assert.match(
  fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-pixel-monitor/install-verification-card.tsx"),
    "utf8",
  ),
  /Install verification/,
)
assert.doesNotMatch(monitorUi, /submitted_identity/)

const marketingSiteRoot = path.resolve(process.cwd(), "../equipify-site")
if (fs.existsSync(marketingSiteRoot)) {
  const marketingLayout = fs.readFileSync(path.join(marketingSiteRoot, "app/layout.tsx"), "utf8")
  assert.match(marketingLayout, /EquipifyIntentPixelScript/)
  assert.match(marketingLayout, /IntentConsentProvider/)
  assert.doesNotMatch(marketingLayout, /pixel\.js\?site_key=equipify-sandbox/)
  const marketingScript = fs.readFileSync(
    path.join(marketingSiteRoot, "components/analytics/equipify-intent-pixel-script.tsx"),
    "utf8",
  )
  assert.match(marketingScript, /EQUIPIFY_INTENT_PIXEL_SCRIPT_URL/)
  const marketingHelper = fs.readFileSync(
    path.join(marketingSiteRoot, "lib/analytics/equipify-intent-pixel.ts"),
    "utf8",
  )
  assert.match(marketingHelper, /growth-intent-pixel-installed-equipify-site-v1/)
  assert.match(
    marketingHelper,
    /app\.equipify\.ai\/api\/growth\/intent-pixel\/pixel\.js\?site_key=equipify-sandbox/,
  )
  const adminUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-intent-pixel-admin.tsx"),
    "utf8",
  )
  assert.match(adminUi, /buildIntentPixelScriptSnippet/)
  assert.match(adminUi, /script_snippet/)
}

console.log(
  "growth-intent-pixel-v1 + growth-intent-pixel-admin-v1 + growth-intent-pixel-live-v1 + growth-live-visitor-monitor-v1 checks passed",
)

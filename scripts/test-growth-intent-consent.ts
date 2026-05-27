/**
 * Intent Pixel consent manager regression checks (Prompt 36).
 * Run: pnpm test:growth-intent-consent
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  allowsBehavioralTracking,
  allowsBuyingStageInference,
  allowsIntentScoring,
  allowsSearchIntentSignals,
  isExplicitCaptureConversion,
  normalizeConsentStatus,
  resolveTrackingMode,
} from "../lib/growth/intent-pixel/consent-gate"
import { buildIntentPixelScript } from "../lib/growth/intent-pixel/pixel-script"
import {
  EQUIPIFY_INTENT_CONSENT_STORAGE_KEY,
  EQUIPIFY_INTENT_CONSENT_TIMESTAMP_KEY,
  EQUIPIFY_INTENT_CONSENT_TTL_MS,
  EXPLICIT_CAPTURE_CONVERSION_TYPES,
  GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER,
  TRACKING_VISIBILITY_IMPACTED_THRESHOLD,
} from "../lib/growth/intent-pixel/intent-consent-manager-types"

assert.equal(GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER, "growth-intent-consent-manager-v1")
assert.equal(EQUIPIFY_INTENT_CONSENT_STORAGE_KEY, "equipify_intent_consent")
assert.equal(EQUIPIFY_INTENT_CONSENT_TIMESTAMP_KEY, "equipify_intent_consent_ts")
assert.equal(EQUIPIFY_INTENT_CONSENT_TTL_MS, 365 * 24 * 60 * 60 * 1000)
assert.equal(TRACKING_VISIBILITY_IMPACTED_THRESHOLD, 0.45)
assert.deepEqual([...EXPLICIT_CAPTURE_CONVERSION_TYPES], [
  "form_submit",
  "booking",
  "chat",
  "login",
  "lead_capture",
])

const consentGate = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/consent-gate.ts"),
  "utf8",
)
assert.match(consentGate, /isExplicitCaptureConversion/)
assert.match(consentGate, /allowsBehavioralTracking/)
assert.match(consentGate, /allowsIntentScoring/)
assert.match(consentGate, /allowsSearchIntentSignals/)
assert.match(consentGate, /allowsBuyingStageInference/)

const capture = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/capture-intent-event.ts"),
  "utf8",
)
assert.match(capture, /payload\.conversion_type/)

const monitor = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/live-visitor-monitor.ts"),
  "utf8",
)
assert.match(monitor, /allowsIntentScoring/)
assert.match(monitor, /allowsSearchIntentSignals/)
assert.match(monitor, /allowsBuyingStageInference/)
assert.doesNotMatch(monitor, /runLeadEnginePipeline|sendEmail|executePipeline/)

const adminUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-intent-pixel-admin.tsx"),
  "utf8",
)
assert.match(adminUi, /GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER/)
assert.match(adminUi, /Consent acceptance %/)
assert.match(adminUi, /Tracking coverage %/)
assert.match(adminUi, /Anonymous sessions blocked/)
assert.match(adminUi, /High intent blocked by consent/)
assert.match(adminUi, /ConsentBreakdownChart/)
assert.match(adminUi, /Tracking visibility impacted/)

const adminRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/intent-pixel/intent-pixel-admin-repository.ts"),
  "utf8",
)
assert.match(adminRepo, /buildConsentDiagnostics/)
assert.match(adminRepo, /consent_acceptance_pct/)
assert.match(adminRepo, /tracking_visibility_impacted/)

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

gate = resolveTrackingMode(site, "granted", "pageview")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "full")

gate = resolveTrackingMode(site, "denied", "consent_update")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "essential_only")

gate = resolveTrackingMode(site, "denied", "pageview")
assert.equal(gate.accepted, false)

gate = resolveTrackingMode(site, "denied", "conversion", "form_submit")
assert.equal(gate.accepted, true)
assert.equal(gate.mode, "essential_only")

gate = resolveTrackingMode(site, "denied", "conversion", "custom")
assert.equal(gate.accepted, false)

assert.equal(isExplicitCaptureConversion("form_submit"), true)
assert.equal(isExplicitCaptureConversion("custom"), false)
assert.equal(allowsIntentScoring("granted"), true)
assert.equal(allowsIntentScoring("denied"), false)
assert.equal(allowsIntentScoring("unknown"), false)
assert.equal(allowsBehavioralTracking("granted", "full"), true)
assert.equal(allowsBehavioralTracking("unknown", "essential_only"), false)
assert.equal(allowsSearchIntentSignals("unknown"), false)
assert.equal(allowsBuyingStageInference("denied"), false)
assert.equal(normalizeConsentStatus("GRANTED"), "granted")

const script = buildIntentPixelScript({
  collectUrl: "https://app.equipify.ai/api/growth/intent-pixel/collect",
  siteKey: "equipify-sandbox",
})
assert.match(script, /equipify_intent_consent/)
assert.match(script, /equipify_intent_consent_ts/)
assert.match(script, /allowsBehavioral/)
assert.match(script, /allowsOperational/)
assert.doesNotMatch(script, /if\(allowsOperational\(\)\)send\("pageview"\)[\s\S]*if\(allowsOperational\(\)\)send\("pageview"\)/)

const marketingSiteRoot = path.resolve(process.cwd(), "../equipify-site")
if (fs.existsSync(marketingSiteRoot)) {
  const layout = fs.readFileSync(path.join(marketingSiteRoot, "app/layout.tsx"), "utf8")
  assert.match(layout, /IntentConsentProvider/)
  assert.match(layout, /EquipifyIntentPixelScript/)
  assert.equal((layout.match(/<IntentConsentProvider/g) ?? []).length, 1)
  assert.equal((layout.match(/IntentConsentBanner/g) ?? []).length, 0)

  const provider = fs.readFileSync(
    path.join(marketingSiteRoot, "components/privacy/intent-consent-provider.tsx"),
    "utf8",
  )
  assert.match(provider, /GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER/)
  assert.match(provider, /data-qa-marker=\{GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER\}/)
  assert.match(provider, /IntentConsentBanner/)
  assert.equal((provider.match(/<IntentConsentBanner/g) ?? []).length, 1)

  const banner = fs.readFileSync(
    path.join(marketingSiteRoot, "components/privacy/intent-consent-banner.tsx"),
    "utf8",
  )
  assert.match(banner, /Accept/)
  assert.match(banner, /Decline/)
  assert.match(banner, /Preferences/)
  assert.match(banner, /We only collect personal information/)

  const modal = fs.readFileSync(
    path.join(marketingSiteRoot, "components/privacy/intent-consent-preferences-modal.tsx"),
    "utf8",
  )
  assert.match(modal, /Required/)
  assert.match(modal, /Analytics/)
  assert.match(modal, /Personalization/)
  assert.match(modal, /Marketing/)
  assert.match(modal, /Intent Pixel analytics/)

  const consentLib = fs.readFileSync(
    path.join(marketingSiteRoot, "lib/analytics/equipify-intent-consent.ts"),
    "utf8",
  )
  assert.match(consentLib, /equipify_intent_consent/)
  assert.match(consentLib, /365/)
}

console.log(`${GROWTH_INTENT_CONSENT_MANAGER_QA_MARKER} consent manager checks passed`)

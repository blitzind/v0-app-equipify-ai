/**
 * Regression checks for Growth Engine call dial resolver and call count cache.
 * Run: pnpm test:growth-call-dial
 */
import assert from "node:assert/strict"
import {
  buildGrowthCallDialOptions,
  normalizeGrowthCallPhone,
  resolveGrowthCallHref,
  resolveGrowthDialPreferences,
  resolveGrowthPlatformAdminDialPreferences,
} from "../lib/growth/communication/call-dial"
import { computeGrowthLeadCallCountsFromRows } from "../lib/growth/communication/call-counts"

const phone = normalizeGrowthCallPhone("(555) 123-4567")
assert.ok(phone)
assert.equal(phone?.e164, "+15551234567")

assert.equal(resolveGrowthCallHref("(555) 123-4567", "tel"), "tel:+15551234567")
assert.equal(
  resolveGrowthCallHref("(555) 123-4567", "google_voice"),
  "https://voice.google.com/u/0/calls?a=nc,%2B15551234567",
)
assert.equal(
  resolveGrowthCallHref("(555) 123-4567", "custom_url_template", "zoom://{{phone_digits}}"),
  "zoom://5551234567",
)

const resolved = resolveGrowthPlatformAdminDialPreferences({
  platformDefaults: { callDialMode: "google_voice", showAlternateDialers: true },
  adminUserOverrides: { callDialMode: "tel" },
})
assert.equal(resolved.callDialMode, "tel")
assert.equal(resolved.source.callDialMode, "user")

const scopeFallback = resolveGrowthDialPreferences({
  scopeDefaults: { callDialMode: "facetime" },
  userOverrides: null,
})
assert.equal(scopeFallback.callDialMode, "facetime")
assert.equal(scopeFallback.source.callDialMode, "scope_defaults")

const telFallback = resolveGrowthDialPreferences({ scopeDefaults: null, userOverrides: null })
assert.equal(telFallback.callDialMode, "tel")
assert.equal(telFallback.source.callDialMode, "hard_default")

const options = buildGrowthCallDialOptions("(555) 123-4567", {
  callDialMode: "tel",
  customUrlTemplate: null,
  showAlternateDialers: true,
})
assert.ok(options.length >= 2)

const counts = computeGrowthLeadCallCountsFromRows([
  { disposition: "call_attempted" },
  { disposition: "left_voicemail" },
  { disposition: "interested" },
  { disposition: "no_answer" },
  { disposition: "not_a_fit" },
])
assert.equal(counts.callAttemptCount, 4)
assert.equal(counts.voicemailCount, 1)
assert.equal(counts.connectedCallCount, 2)

console.log("growth call dial tests passed")

/**
 * Regression checks for Growth Engine provider connector (slice 5.3A).
 * Run: pnpm test:growth-provider-connector
 */
import assert from "node:assert/strict"
import {
  decryptGrowthProviderCredentials,
  encryptGrowthProviderCredentials,
  sanitizeGrowthProviderConfigForApi,
} from "../lib/growth/outbound/credentials-crypto"
import {
  mapGrowthProviderLegacyStatus,
  resolveGrowthProviderLifecycleFromValidation,
} from "../lib/growth/outbound/connection-lifecycle"
import { emptyGrowthProviderCapabilitySnapshot } from "../lib/growth/outbound/capability-snapshot"
import { buildFixtureValidationResult } from "../lib/growth/outbound/providers/fixture-validation"
import { smartleadOutboundProviderAdapter } from "../lib/growth/outbound/providers/families"
import { stubOutboundProviderAdapter } from "../lib/growth/outbound/providers/stub"
import { isKnownOutboundProvider, listOutboundProviderAdapters } from "../lib/growth/outbound/providers/registry"
import {
  GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS,
  growthProviderDeleteRequiresConfirmation,
  type GrowthProviderConnectionSummary,
} from "../lib/growth/outbound/provider-types"
import {
  growthProviderValidationCooldownRemainingMs,
  isGrowthProviderValidationCooldownActive,
} from "../lib/growth/outbound/provider-connection-repository"

const declared = emptyGrowthProviderCapabilitySnapshot()

assert.equal(resolveGrowthProviderLifecycleFromValidation({ healthy: true, warnings: [] }), "connected")
assert.equal(
  resolveGrowthProviderLifecycleFromValidation({ healthy: true, warnings: [{ code: "w", message: "warn" }] }),
  "warning",
)
assert.equal(
  resolveGrowthProviderLifecycleFromValidation({ healthy: false, warnings: [], temporarilyDegraded: true }),
  "warning",
)
assert.equal(mapGrowthProviderLegacyStatus("disabled"), "disabled")
assert.equal(mapGrowthProviderLegacyStatus("connected"), "active")

const encrypted = encryptGrowthProviderCredentials({ apiKey: "secret-key-123" })
assert.ok(encrypted.startsWith("v1:"))
const decrypted = decryptGrowthProviderCredentials(encrypted)
assert.equal(decrypted?.apiKey, "secret-key-123")
assert.equal(decryptGrowthProviderCredentials("invalid"), null)

const sanitized = sanitizeGrowthProviderConfigForApi({ apiKey: "x", validationFixture: "healthy" })
assert.equal(sanitized.apiKey, undefined)
assert.equal(sanitized.validationFixture, "healthy")

const healthyFixture = buildFixtureValidationResult({
  declared,
  config: { validationFixture: "healthy" },
  credentials: { apiKey: "test" },
  providerLabel: "Smartlead",
})
assert.equal(healthyFixture.healthy, true)

const errorFixture = buildFixtureValidationResult({
  declared,
  config: { validationFixture: "error" },
  credentials: { apiKey: "test" },
  providerLabel: "Smartlead",
})
assert.equal(errorFixture.healthy, false)

const degradedFixture = buildFixtureValidationResult({
  declared,
  config: { validationFixture: "degraded" },
  credentials: { apiKey: "test" },
  providerLabel: "Instantly",
})
assert.equal(degradedFixture.temporarilyDegraded, true)
assert.ok(degradedFixture.degradedUntil)

assert.equal(GROWTH_PROVIDER_VALIDATION_COOLDOWN_MS, 30_000)

const cooldownConnection = {
  health: { nextValidationAllowedAt: new Date(Date.now() + 10_000).toISOString() },
} as GrowthProviderConnectionSummary
assert.equal(isGrowthProviderValidationCooldownActive(cooldownConnection), true)
assert.ok(growthProviderValidationCooldownRemainingMs(cooldownConnection) > 0)

const adapters = listOutboundProviderAdapters()
assert.ok(adapters.some((entry) => entry.providerKey === "smartlead"))
assert.ok(isKnownOutboundProvider("stub"))
assert.ok(isKnownOutboundProvider("emailbison"))

assert.equal(stubOutboundProviderAdapter.providerFamily(), "custom")
assert.equal(smartleadOutboundProviderAdapter.providerFamily(), "smartlead")

assert.equal(growthProviderDeleteRequiresConfirmation("connected"), true)
assert.equal(growthProviderDeleteRequiresConfirmation("warning"), true)
assert.equal(growthProviderDeleteRequiresConfirmation("disabled"), false)
assert.equal(growthProviderDeleteRequiresConfirmation("configuring"), false)

async function run() {
  const stubValidation = await stubOutboundProviderAdapter.validateConnection({
    connection: {
      id: "00000000-0000-4000-8000-000000000001",
      provider: "stub",
      providerFamily: "custom",
      label: "Stub",
      status: "active",
      apiBaseUrl: null,
      webhookSecret: null,
      config: { validationFixture: "healthy" },
      lastWebhookAt: null,
      lastError: null,
      monthlyCostEstimate: null,
      seatCount: null,
      notes: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    credentials: { apiKey: "fixture" },
  })
  assert.equal(stubValidation.healthy, true)
  assert.equal(JSON.stringify(stubValidation).includes("fixture"), true)
  assert.equal(JSON.stringify(stubValidation).includes("secret-key-123"), false)

  console.log("growth provider connector tests passed")
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

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
import { mapGrowthProviderApiError } from "../lib/growth/outbound/provider-api-errors"
import { growthStubBootstrapBlockedBySoftDelete } from "../lib/growth/outbound/connection-repository"
import {
  filterActiveProviderConnectionRows,
  isActiveProviderConnectionRow,
  withActiveProviderConnectionScope,
} from "../lib/growth/outbound/provider-connection-query"

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

const deletedAtError = mapGrowthProviderApiError(new Error('column "deleted_at" does not exist'))
assert.equal(deletedAtError.error, "growth_schema_incomplete")
assert.equal(deletedAtError.status, 503)
assert.match(deletedAtError.message, /20270102120000/)

const filterProbe = {
  is(column: string, value: null) {
    return { column, value, kind: "filter" as const }
  },
}
const tableProbe = { select: () => filterProbe }
assert.equal(withActiveProviderConnectionScope(filterProbe, false), filterProbe)
assert.deepEqual(withActiveProviderConnectionScope(tableProbe.select(), true), {
  column: "deleted_at",
  value: null,
  kind: "filter",
})

assert.equal(isActiveProviderConnectionRow({ deleted_at: null }), true)
assert.equal(isActiveProviderConnectionRow({ deleted_at: "2026-01-01T00:00:00.000Z" }), false)
assert.deepEqual(
  filterActiveProviderConnectionRows(
    [{ id: "a", deleted_at: null }, { id: "b", deleted_at: "2026-01-01T00:00:00.000Z" }],
    true,
  ),
  [{ id: "a", deleted_at: null }],
)

assert.equal(growthStubBootstrapBlockedBySoftDelete(null, true), false)
assert.equal(growthStubBootstrapBlockedBySoftDelete({ deleted_at: null }, true), false)
assert.equal(growthStubBootstrapBlockedBySoftDelete({ deleted_at: "2026-01-01T00:00:00.000Z" }, true), true)
assert.equal(growthStubBootstrapBlockedBySoftDelete({ deleted_at: "2026-01-01T00:00:00.000Z" }, false), false)

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

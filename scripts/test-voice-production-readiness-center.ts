/**
 * Voice Production Readiness Center — regression checks.
 * Run: pnpm test:voice-production-readiness-center
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateTwilioConnectionReadiness,
  evaluateTwilioWebhookReadiness,
} from "../lib/voice/production-readiness/evaluate-twilio-connection-readiness"
import {
  VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
  VOICE_PRODUCTION_READINESS_SECTION_IDS,
} from "../lib/voice/production-readiness/types"
import type { VoiceProviderConfigurationRecord } from "../lib/voice/types"

assert.equal(VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER, "voice-production-readiness-center-v1")
assert.equal(VOICE_PRODUCTION_READINESS_SECTION_IDS.length, 12)

const typesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/production-readiness/types.ts"),
  "utf8",
)
assert.match(typesSource, /twilio_connection/)
assert.match(typesSource, /multi_channel/)

const builderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/production-readiness/build-voice-production-readiness-center.ts"),
  "utf8",
)
assert.match(builderSource, /fetchVoiceOperationsReadiness/)
assert.match(builderSource, /fetchVoiceBrowserCallingReadiness/)
assert.match(builderSource, /fetchAiReceptionistReadiness/)
assert.match(builderSource, /fetchComplianceReadiness/)
assert.match(builderSource, /buildTwilioConnectionSection/)
assert.match(builderSource, /buildMultiChannelSection/)
assert.match(builderSource, /evaluateTwilioConnectionReadiness/)
assert.match(builderSource, /readTwilioEnvPresence/)
assert.match(builderSource, /TWILIO_API_KEY_SID/)
assert.match(builderSource, /TWILIO_API_KEY_SECRET/)
assert.doesNotMatch(builderSource, /"TWILIO_API_KEY"/)
assert.doesNotMatch(builderSource, /"TWILIO_API_SECRET"/)

const providerRegistrySource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/provider-registry.ts"),
  "utf8",
)
assert.match(providerRegistrySource, /TWILIO_API_KEY_SID/)
assert.match(providerRegistrySource, /TWILIO_API_KEY_SECRET/)

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/readiness/route.ts"),
  "utf8",
)
assert.match(routeSource, /buildVoiceProductionReadinessCenter/)
assert.match(routeSource, /VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER/)
assert.doesNotMatch(routeSource, /fetchVoiceOperationsReadiness/)

const settingsRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/settings/route.ts"),
  "utf8",
)
assert.match(settingsRouteSource, /ensureTwilioVoiceProviderConfiguration/)
assert.match(settingsRouteSource, /twilioEnvPresence/)
assert.match(settingsRouteSource, /initialize_twilio/)

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Initialize Twilio Provider/)
assert.match(panelSource, /presence only/)
assert.doesNotMatch(panelSource, /TWILIO_AUTH_TOKEN.*value/i)

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/voice/readiness/page.tsx"),
  "utf8",
)
assert.match(pageSource, /GrowthVoiceProductionReadinessDashboard/)
assert.match(pageSource, /VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER/)
assert.match(pageSource, /data-voice-production-readiness-page-qa-marker/)

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-production-readiness-dashboard.tsx"),
  "utf8",
)
assert.match(dashboardSource, /Re-run readiness check/)
assert.match(dashboardSource, /Copy URL/)
assert.match(dashboardSource, /Open provider settings/)
assert.match(dashboardSource, /data-voice-readiness-section/)

const navSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
  "utf8",
)
assert.match(navSource, /\/admin\/growth\/voice\/readiness/)

const docsSource = fs.readFileSync(
  path.join(process.cwd(), "docs/VOICE_ENVIRONMENT_REQUIREMENTS.md"),
  "utf8",
)
assert.match(docsSource, /\/admin\/growth\/voice\/readiness/)

const orgId = "00000000-0000-4000-8000-000000000001"
const envPresent = {
  twilioAccountSid: true,
  twilioAuthToken: true,
  growthEngineAiOrgId: true,
  twilioCredentialsConfigured: true,
}
const envMissingToken = {
  twilioAccountSid: true,
  twilioAuthToken: false,
  growthEngineAiOrgId: true,
  twilioCredentialsConfigured: false,
}

function twilioProvider(
  overrides: Partial<VoiceProviderConfigurationRecord> = {},
): VoiceProviderConfigurationRecord {
  return {
    id: "provider-twilio",
    organizationId: orgId,
    provider: "twilio",
    providerAccountReference: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    status: "pending",
    voiceEnabled: true,
    smsEnabled: false,
    webhookValidated: false,
    lastValidationAt: null,
    metadataJson: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const envPresentRowMissing = evaluateTwilioConnectionReadiness({
  organizationId: orgId,
  twilioProvider: null,
  env: envPresent,
})
assert.equal(envPresentRowMissing.status, "partial")
assert.deepEqual(envPresentRowMissing.missingEnvVars, [])
assert.deepEqual(envPresentRowMissing.missingCredentials, [])
assert.match(envPresentRowMissing.recommendedFix, /Initialize Twilio Provider in Communications settings/)

const rowPresentEnvMissing = evaluateTwilioConnectionReadiness({
  organizationId: orgId,
  twilioProvider: twilioProvider(),
  env: envMissingToken,
})
assert.equal(rowPresentEnvMissing.status, "blocked")
assert.deepEqual(rowPresentEnvMissing.missingCredentials, ["TWILIO_AUTH_TOKEN"])
assert.match(rowPresentEnvMissing.recommendedFix, /TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN/)

const rowPresentEnvPresentPending = evaluateTwilioConnectionReadiness({
  organizationId: orgId,
  twilioProvider: twilioProvider({ status: "pending", webhookValidated: false }),
  env: envPresent,
})
assert.equal(rowPresentEnvPresentPending.status, "partial")
assert.deepEqual(rowPresentEnvPresentPending.missingEnvVars, [])
assert.deepEqual(rowPresentEnvPresentPending.missingCredentials, [])

const rowPresentEnvPresentReady = evaluateTwilioConnectionReadiness({
  organizationId: orgId,
  twilioProvider: twilioProvider({ status: "ready", webhookValidated: true }),
  env: envPresent,
})
assert.equal(rowPresentEnvPresentReady.status, "ready")

const webhookEnvPresentRowMissing = evaluateTwilioWebhookReadiness({
  organizationId: orgId,
  configuredProviderCount: 0,
  webhookValidatedCount: 0,
  webhookPendingCount: 0,
  twilioProvider: null,
  env: envPresent,
  publicOriginConfigured: true,
})
assert.equal(webhookEnvPresentRowMissing.status, "partial")
assert.deepEqual(webhookEnvPresentRowMissing.missingCredentials, [])
assert.match(webhookEnvPresentRowMissing.recommendedFix, /Initialize Twilio Provider/)

const webhookRowPresentEnvMissing = evaluateTwilioWebhookReadiness({
  organizationId: orgId,
  configuredProviderCount: 1,
  webhookValidatedCount: 0,
  webhookPendingCount: 1,
  twilioProvider: twilioProvider(),
  env: envMissingToken,
  publicOriginConfigured: true,
})
assert.deepEqual(webhookRowPresentEnvMissing.missingCredentials, ["TWILIO_AUTH_TOKEN"])
assert.match(webhookRowPresentEnvMissing.recommendedFix, /TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN/)

const webhookRowPresentValidated = evaluateTwilioWebhookReadiness({
  organizationId: orgId,
  configuredProviderCount: 1,
  webhookValidatedCount: 1,
  webhookPendingCount: 0,
  twilioProvider: twilioProvider({ webhookValidated: true, status: "ready" }),
  env: envPresent,
  publicOriginConfigured: true,
})
assert.equal(webhookRowPresentValidated.status, "ready")
assert.deepEqual(webhookRowPresentValidated.missingCredentials, [])

console.log("voice-production-readiness-center checks passed")

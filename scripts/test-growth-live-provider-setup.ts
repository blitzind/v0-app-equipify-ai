/**
 * Regression checks for Live Provider Setup (Phase 2W).
 * Run: pnpm test:growth-live-provider-setup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  encryptProviderSetupCredentials,
  sanitizeProviderSetupForApi,
} from "../lib/growth/provider-setup/credential-vault"
import {
  googleProviderOAuthConfigured,
  googleProviderOAuthEnvWarnings,
} from "../lib/growth/provider-setup/google-oauth"
import {
  microsoftProviderOAuthConfigured,
  microsoftProviderOAuthEnvWarnings,
} from "../lib/growth/provider-setup/microsoft-oauth"
import {
  normalizeProviderSetupReturnTo,
  signProviderSetupOAuthState,
  verifyProviderSetupOAuthState,
} from "../lib/growth/provider-setup/oauth-state"
import {
  GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER,
  GROWTH_PROVIDER_CONNECTION_STATUSES,
  GROWTH_PROVIDER_READINESS_CHECK_KEYS,
  GROWTH_PROVIDER_SETUP_FAMILIES,
  GROWTH_PROVIDER_SETUP_INTERNAL_FIELD_NAMES,
} from "../lib/growth/provider-setup/provider-setup-types"
import { GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_MIGRATION } from "../lib/growth/provider-setup/schema-health"

process.env.INTEGRATION_OAUTH_STATE_SECRET = process.env.INTEGRATION_OAUTH_STATE_SECRET ?? "test-oauth-state-secret-123456"

function main(): void {
  assert.equal(GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER, "growth-live-provider-setup-v1")
  assert.equal(GROWTH_PROVIDER_SETUP_FAMILIES.length, 6)
  assert.equal(GROWTH_PROVIDER_CONNECTION_STATUSES.length, 7)
  assert.equal(GROWTH_PROVIDER_READINESS_CHECK_KEYS.length, 10)

  const migrationPath = path.join(
    process.cwd(),
    `supabase/migrations/${GROWTH_LIVE_PROVIDER_SETUP_SCHEMA_MIGRATION}`,
  )
  assert.ok(fs.existsSync(migrationPath), "live provider setup migration must exist")
  const migration = fs.readFileSync(migrationPath, "utf8")
  assert.match(migration, /growth\.provider_connection_settings/)
  assert.match(migration, /growth\.provider_oauth_states/)
  assert.match(migration, /growth\.provider_connection_checks/)
  assert.match(migration, /growth\.provider_secret_audit_events/)
  assert.match(migration, /growth\.provider_setup_readiness/)
  assert.match(migration, /oauth_configured/)
  assert.match(migration, /test_send_passed/)
  assert.match(migration, /service_role/)

  const encrypted = encryptProviderSetupCredentials({ api_key: "secret-value", from_email: "ops@example.com" })
  assert.match(encrypted, /^v1:/)
  const sanitized = sanitizeProviderSetupForApi({
    id: "1",
    encrypted_credentials: encrypted,
    api_key: "secret-value",
    metadata: { api_key: "secret-value", region: "us-east-1" },
  })
  for (const key of GROWTH_PROVIDER_SETUP_INTERNAL_FIELD_NAMES) {
    assert.equal(key in sanitized, false, `expected ${key} stripped`)
  }

  assert.equal(normalizeProviderSetupReturnTo("/admin/evil"), "/growth/settings/delivery")
  assert.equal(
    normalizeProviderSetupReturnTo("/admin/growth/providers/setup?x=1", "admin"),
    "/admin/growth/providers/setup?x=1",
  )
  assert.equal(
    normalizeProviderSetupReturnTo("/growth/settings/delivery", "growth"),
    "/growth/settings/delivery",
  )

  const state = signProviderSetupOAuthState({
    userId: "user-1",
    providerFamily: "google",
    returnTo: "/admin/growth/providers/setup",
    workspace: "admin",
    ts: Date.now(),
    nonce: "abc",
  })
  assert.ok(state)
  const verified = verifyProviderSetupOAuthState(state!, "google")
  assert.ok(verified)
  assert.equal(verified!.userId, "user-1")

  assert.equal(typeof googleProviderOAuthConfigured(), "boolean")
  assert.equal(typeof microsoftProviderOAuthConfigured(), "boolean")
  assert.ok(Array.isArray(googleProviderOAuthEnvWarnings()))
  assert.ok(Array.isArray(microsoftProviderOAuthEnvWarnings()))
  const readinessSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/provider-setup/readiness-checklist.ts"),
    "utf8",
  )
  assert.match(readinessSource, /collectProviderSetupEnvWarnings/)

  const webhookSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/provider-setup/webhook-setup.ts"),
    "utf8",
  )
  assert.match(webhookSource, /buildProviderWebhookPublicUrl/)
  assert.match(webhookSource, /hashWebhookSigningSecret/)

  const dashboardSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/provider-setup/dashboard.ts"),
    "utf8",
  )
  assert.match(dashboardSource, /encryptProviderSetupCredentials/)
  assert.match(dashboardSource, /recordProviderSecretAuditEvent/)
  assert.doesNotMatch(dashboardSource, /decryptProviderSetupCredentials\(.*\).*NextResponse/s)

  const testSendSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/provider-setup/provider-test-send.ts"),
    "utf8",
  )
  assert.match(testSendSource, /humanApprovalConfirmed/)
  assert.match(testSendSource, /executeTransportSend/)
  assert.doesNotMatch(testSendSource, /auto.?outreach|sequence/i)

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-provider-setup-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER/)
  assert.match(uiSource, /GROWTH_PROVIDER_SETUP_SENDER_SELECT_QA/)
  const constantsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/provider-setup/growth-provider-setup-constants.ts"),
    "utf8",
  )
  assert.match(constantsSource, /growth-sender-select-overlay-fix-v1/)
  assert.match(uiSource, /Connect \/ Reconnect Google/)
  assert.match(uiSource, /humanApprovalConfirmed/)
  assert.match(uiSource, /position="popper"/)

  const selectSource = fs.readFileSync(path.join(process.cwd(), "components/ui/select.tsx"), "utf8")
  assert.match(selectSource, /SelectPrimitive\.Portal/)
  assert.match(selectSource, /APP_Z_DIALOG/)
  assert.doesNotMatch(selectSource, /relative z-\[120\]/)

  const listRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/provider-setup/dashboard/route.ts"),
    "utf8",
  )
  assert.match(listRoute, /fetchProviderSetupDashboard/)
  assert.doesNotMatch(listRoute, /encrypted_credentials|access_token|refresh_token/)

  console.log("growth-live-provider-setup: ok")
}

main()

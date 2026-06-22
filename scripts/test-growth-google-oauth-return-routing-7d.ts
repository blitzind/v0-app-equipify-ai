/**
 * GS-GROWTH-MAIL-7D — Google OAuth return routing certification.
 * Run: pnpm test:growth-google-oauth-return-routing-7d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_DELIVERY_SETTINGS_PATH,
} from "../lib/growth/navigation/growth-delivery-settings-navigation"
import {
  signProviderSetupOAuthState,
  verifyProviderSetupOAuthState,
} from "../lib/growth/provider-setup/oauth-state"
import { GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES } from "../lib/growth/provider-setup/provider-setup-types"

process.env.INTEGRATION_OAUTH_STATE_SECRET = process.env.INTEGRATION_OAUTH_STATE_SECRET ?? "test-oauth-state-secret-123456"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.ok(GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES.includes("/growth/settings/delivery"))
  assert.ok(GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES.includes("/growth/settings/communications"))

  const googleCallback = readSource("app/api/platform/growth/provider-setup/google/callback/route.ts")
  assert.match(googleCallback, /defaultGrowthProviderOAuthReturnTo\("growth"\)/)

  const microsoftCallback = readSource("app/api/platform/growth/provider-setup/microsoft/callback/route.ts")
  assert.match(microsoftCallback, /defaultGrowthProviderOAuthReturnTo\("growth"\)/)

  const googleStart = readSource("app/api/platform/growth/provider-setup/google/start/route.ts")
  assert.match(googleStart, /workspace/)
  assert.match(googleStart, /organizationId/)
  assert.match(googleStart, /normalizeProviderSetupReturnTo\(body\.return_to, workspace\)/)

  const oauthState = readSource("lib/growth/provider-setup/oauth-state.ts")
  assert.match(oauthState, /workspace\?: GrowthProviderOAuthWorkspace/)
  assert.match(oauthState, /organizationId\?: string/)

  const state = signProviderSetupOAuthState({
    userId: "user-1",
    providerFamily: "google",
    returnTo: GROWTH_DELIVERY_SETTINGS_PATH,
    workspace: "growth",
    organizationId: "org-1",
    ts: Date.now(),
    nonce: "abc",
  })
  assert.ok(state)
  const verified = verifyProviderSetupOAuthState(state!, "google")
  assert.ok(verified)
  assert.equal(verified!.returnTo, GROWTH_DELIVERY_SETTINGS_PATH)
  assert.equal(verified!.workspace, "growth")

  console.log("growth-google-oauth-return-routing-7d: ok")
}

main()

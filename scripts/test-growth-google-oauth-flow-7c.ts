/**
 * GS-GROWTH-MAIL-7C — Gmail OAuth end-to-end flow certification.
 * Run: pnpm test:growth-google-oauth-flow-7c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  normalizeProviderSetupReturnTo,
  signProviderSetupOAuthState,
  verifyProviderSetupOAuthState,
} from "../lib/growth/provider-setup/oauth-state"
import { GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES } from "../lib/growth/provider-setup/provider-setup-types"

process.env.INTEGRATION_OAUTH_STATE_SECRET = process.env.INTEGRATION_OAUTH_STATE_SECRET ?? "test-oauth-state-secret-123456"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  const flowLog = readSource("lib/growth/provider-setup/google-oauth-flow-log.ts")
  assert.match(flowLog, /growth-google-oauth-flow-7c-v1/)

  const startRoute = readSource("app/api/platform/growth/provider-setup/google/start/route.ts")
  assert.match(startRoute, /buildGoogleProviderAuthorizeUrl/)
  assert.match(startRoute, /mailboxConnectionId/)
  assert.match(startRoute, /logGrowthGoogleOAuthFlow\("oauth_start"/)
  assert.match(startRoute, /signProviderSetupOAuthState/)

  const callbackRoute = readSource("app/api/platform/growth/provider-setup/google/callback/route.ts")
  assert.match(callbackRoute, /exchangeGoogleProviderOAuthCode/)
  assert.match(callbackRoute, /completeOAuthProviderConnection/)
  assert.match(callbackRoute, /logGrowthGoogleOAuthFlow\("oauth_callback_received"/)
  assert.match(callbackRoute, /logGrowthGoogleOAuthFlow\("token_exchange_success"/)
  assert.match(callbackRoute, /mailboxConnectionId/)

  const googleOAuth = readSource("lib/growth/provider-setup/google-oauth.ts")
  assert.match(googleOAuth, /access_type.*offline/)
  assert.match(googleOAuth, /prompt.*consent/)
  assert.match(googleOAuth, /refresh_token/)

  const uiPaths = [
    "components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx",
    "components/growth/growth-provider-setup-dashboard.tsx",
    "components/growth/growth-mailbox-connections-dashboard.tsx",
    "components/growth/mailboxes/growth-mailbox-onboarding-wizard.tsx",
  ]
  for (const uiPath of uiPaths) {
    const ui = readSource(uiPath)
    assert.match(ui, /provider-setup\/(\$\{provider\}|google)\/start/)
    assert.match(ui, /sender_account_id|senderId/)
  }

  for (const prefix of [
    "/admin/growth/infrastructure/mailboxes/onboard?senderId=x",
    "/growth/settings/delivery",
    "/growth/settings/connected-mailboxes",
    "/settings/growth-engine/connected-mailboxes",
  ]) {
    assert.ok(
      GROWTH_PROVIDER_SETUP_ALLOWED_RETURN_PREFIXES.some((allowed) => prefix.startsWith(allowed)),
      `expected allowed return prefix for ${prefix}`,
    )
  }

  const state = signProviderSetupOAuthState({
    userId: "user-1",
    providerFamily: "google",
    returnTo: "/growth/settings/connected-mailboxes",
    senderAccountId: "sender-1",
    mailboxConnectionId: "mailbox-1",
    ts: Date.now(),
    nonce: "abc",
  })
  assert.ok(state)
  const verified = verifyProviderSetupOAuthState(state!, "google")
  assert.ok(verified)
  assert.equal(verified!.senderAccountId, "sender-1")
  assert.equal(verified!.mailboxConnectionId, "mailbox-1")
  assert.equal(
    normalizeProviderSetupReturnTo("/growth/settings/connected-mailboxes"),
    "/growth/settings/connected-mailboxes",
  )

  console.log("growth-google-oauth-flow-7c: ok")
}

main()

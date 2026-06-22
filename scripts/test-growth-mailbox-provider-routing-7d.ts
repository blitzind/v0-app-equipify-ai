/**
 * GS-GROWTH-MAIL-7D — Mailbox provider routing certification.
 * Run: pnpm test:growth-mailbox-provider-routing-7d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  GROWTH_COMMUNICATIONS_SETTINGS_PATH,
} from "../lib/growth/navigation/growth-communications-settings-navigation"
import {
  defaultGrowthProviderOAuthReturnTo,
} from "../lib/growth/navigation/growth-delivery-settings-navigation"
import { normalizeProviderSetupReturnTo } from "../lib/growth/provider-setup/oauth-state"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(defaultGrowthProviderOAuthReturnTo("growth"), GROWTH_COMMUNICATIONS_MAILBOXES_PATH)
  assert.equal(defaultGrowthProviderOAuthReturnTo("admin"), "/admin/growth/providers/setup")
  assert.equal(normalizeProviderSetupReturnTo(undefined, "growth"), GROWTH_COMMUNICATIONS_MAILBOXES_PATH)
  assert.equal(normalizeProviderSetupReturnTo(undefined, "admin"), "/admin/growth/providers/setup")
  assert.equal(
    normalizeProviderSetupReturnTo("/growth/settings/communications/mailboxes?provider_connected=google", "growth"),
    "/growth/settings/communications/mailboxes?provider_connected=google",
  )

  const connectedMailboxes = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(connectedMailboxes, /GROWTH_WORKSPACE_MAILBOXES_PATH/)
  assert.match(connectedMailboxes, /workspace:/)

  const providerSetup = readSource("components/growth/growth-provider-setup-dashboard.tsx")
  assert.match(providerSetup, /variant\?: "admin" \| "operator"/)
  assert.match(providerSetup, /workspace: oauthWorkspace/)

  const redirectPage = readSource("app/(growth)/growth/settings/connected-mailboxes/page.tsx")
  assert.match(redirectPage, /redirect\(/)
  assert.match(redirectPage, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  const deliveryRedirect = readSource("app/(growth)/growth/settings/delivery/page.tsx")
  assert.match(deliveryRedirect, /GROWTH_COMMUNICATIONS_MAILBOXES_PATH/)

  const infraTypes = readSource("lib/growth/infrastructure/send-infrastructure-operator-types.ts")
  assert.match(infraTypes, /\/growth\/settings/)

  console.log("growth-mailbox-provider-routing-7d: ok")
}

main()

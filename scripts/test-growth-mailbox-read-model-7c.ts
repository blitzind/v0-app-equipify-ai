/**
 * GS-GROWTH-MAIL-7C — Connected mailbox UI read-model certification.
 * Run: pnpm test:growth-mailbox-read-model-7c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  const readModel = readSource("lib/growth/mailboxes/connected-mailboxes-dashboard.ts")
  assert.match(readModel, /listSenderAccounts/)
  assert.match(readModel, /listMailboxConnections/)
  assert.match(readModel, /mailboxBySender/)
  assert.match(readModel, /connectionStatus = mailbox\?\.status \?\? "no_mailbox"/)
  assert.match(readModel, /listDeliveryRoutes/)
  assert.match(readModel, /listWarmupProfiles/)
  assert.match(readModel, /listSenderPools/)

  const operatorRoute = readSource("app/api/platform/growth/mailboxes/operator-dashboard/route.ts")
  assert.match(operatorRoute, /buildConnectedMailboxesDashboard/)

  const mailboxesRoute = readSource("app/api/platform/growth/mailboxes/route.ts")
  assert.match(mailboxesRoute, /listMailboxConnections/)
  assert.match(mailboxesRoute, /listSenderAccounts/)

  const providerDashboardRoute = readSource("app/api/platform/growth/provider-setup/dashboard/route.ts")
  assert.match(providerDashboardRoute, /fetchProviderSetupDashboard/)

  const providerDashboardLib = readSource("lib/growth/provider-setup/dashboard.ts")
  assert.match(providerDashboardLib, /listProviderConnectionSettingsRows/)
  assert.match(providerDashboardLib, /provider_connection_settings/)

  const healthRoute = readSource("app/api/platform/growth/mailboxes/health/route.ts")
  assert.match(healthRoute, /fetchMailboxHealthDashboard/)

  const connectedUi = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(connectedUi, /operator-dashboard/)
  assert.match(connectedUi, /connectionStatus/)
  assert.match(connectedUi, /needsReconnect/)

  const providerUi = readSource("components/growth/growth-provider-setup-dashboard.tsx")
  assert.match(providerUi, /provider-setup\/dashboard/)
  assert.match(providerUi, /selectedSenderId/)

  // OAuth writes mailbox tokens to mailbox_connections; UI read model uses the same table.
  const dashboard = readSource("lib/growth/provider-setup/dashboard.ts")
  assert.match(dashboard, /createMailboxConnection|updateMailboxConnection/)
  assert.doesNotMatch(readModel, /provider_connection_settings/)

  console.log("growth-mailbox-read-model-7c: ok")
}

main()

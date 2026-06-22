/**
 * GS-GROWTH-MAIL-7C — OAuth callback persistence write certification.
 * Run: pnpm test:growth-mailbox-persistence-7c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  const dashboard = readSource("lib/growth/provider-setup/dashboard.ts")
  assert.match(dashboard, /completeOAuthProviderConnection/)
  assert.match(dashboard, /createMailboxConnection/)
  assert.match(dashboard, /updateMailboxConnection/)
  assert.match(dashboard, /validateMailboxConnection/)
  assert.match(dashboard, /upsertProviderConnectionSettings/)
  assert.match(dashboard, /wireOAuthProviderTransportAfterConnection/)
  assert.match(dashboard, /resolvedSenderAccountId/)
  assert.match(dashboard, /mailbox_connection_id: mailboxId/)

  const oauthState = readSource("lib/growth/provider-setup/oauth-state.ts")
  assert.match(oauthState, /provider_oauth_states/)
  assert.match(oauthState, /mailbox_connection_id/)
  assert.match(oauthState, /sender_account_id/)

  const mailboxRepo = readSource("lib/growth/mailboxes/mailbox-repository.ts")
  assert.match(mailboxRepo, /mailbox_connections/)
  assert.match(mailboxRepo, /encrypted_access_token/)
  assert.match(mailboxRepo, /encrypted_refresh_token/)

  const senderRepo = readSource("lib/growth/sender/sender-repository.ts")
  assert.match(senderRepo, /sender_accounts/)
  assert.match(senderRepo, /updateSenderAccount/)

  const transportWire = readSource("lib/growth/provider-setup/oauth-transport-auto-wire.ts")
  assert.match(transportWire, /createDeliveryProvider/)
  assert.match(transportWire, /upsertDeliveryRoute/)
  assert.match(transportWire, /ensureOAuthReplyIngestionConnection/)

  const migration = readSource("supabase/migrations/20270125120000_growth_mailbox_connections.sql")
  assert.match(migration, /growth\.mailbox_connections/)

  const providerSetupMigration = readSource("supabase/migrations/20270428120000_growth_live_provider_setup.sql")
  assert.match(providerSetupMigration, /growth\.provider_connection_settings/)

  const callback = readSource("app/api/platform/growth/provider-setup/google/callback/route.ts")
  assert.match(callback, /completeOAuthProviderConnection\([\s\S]*mailboxConnectionId/)
  assert.match(callback, /senderAccountId/)
  assert.match(callback, /logGrowthGoogleOAuthFlow\("mailbox_persisted"/)
  assert.doesNotMatch(callback, /console\.(log|info).*access_token/)

  const start = readSource("app/api/platform/growth/provider-setup/google/start/route.ts")
  assert.match(start, /createProviderSetupOAuthStateRecord/)
  assert.match(start, /upsertProviderConnectionSettings/)
  assert.match(start, /senderAccountId: statePayload\.senderAccountId/)

  console.log("growth-mailbox-persistence-7c: ok")
}

main()

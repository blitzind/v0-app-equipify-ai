/**
 * Phase 6.35A — Microsoft 365 native transport parity regression.
 * Run: pnpm test:growth-microsoft365-transport-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MICROSOFT365_TRANSPORT_QA_MARKER,
  supportsLiveTransport,
} from "../lib/growth/providers/adapters/provider-transport-capability-registry"
import { getMicrosoftOAuthScopes, microsoftProviderOAuthConfigured } from "../lib/growth/provider-setup/microsoft-oauth"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_MICROSOFT365_TRANSPORT_QA_MARKER, "growth-microsoft365-transport-parity-v1")
  assert.equal(supportsLiveTransport("microsoft"), true)

  const scopes = getMicrosoftOAuthScopes()
  assert.ok(scopes.some((s) => s.includes("Mail.Send")))
  assert.ok(scopes.some((s) => s.includes("Mail.Read")))

  assert.match(readSource("lib/growth/providers/adapters/microsoft-provider.ts"), /GROWTH_TRANSPORT_SIMULATE/)
  assert.match(readSource("lib/growth/providers/adapters/microsoft-provider.ts"), /\/messages\/.+\/send/)

  assert.match(readSource("lib/growth/inbox-sync/provider-sync-adapters/inbox-sync-adapter-registry.ts"), /createMicrosoftInboxSyncAdapter/)
  assert.match(readSource("lib/growth/inbox-sync/mailbox-sync-credentials.ts"), /refreshMicrosoftMailboxTokensLive/)
  assert.match(readSource("lib/growth/providers/transport/transport-repository.ts"), /refreshMicrosoftMailboxTokensLive/)
  assert.match(readSource("lib/growth/mailboxes/mailbox-repository.ts"), /validateMicrosoftMailboxConnectionLive/)
  assert.match(readSource("lib/growth/infrastructure/infrastructure-readiness.ts"), /microsoftProviderOAuthConfigured/)

  assert.match(
    readSource("app/api/platform/growth/provider-setup/microsoft/start/route.ts"),
    /buildMicrosoftProviderAuthorizeUrl/,
  )

  console.log(
    `growth microsoft365 transport parity tests passed (oauth configured: ${microsoftProviderOAuthConfigured()})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

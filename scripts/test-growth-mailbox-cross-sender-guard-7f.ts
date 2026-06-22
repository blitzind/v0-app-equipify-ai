/**
 * GS-GROWTH-MAIL-7F — Cross-sender OAuth mailbox resolution guards.
 * Run: pnpm test:growth-mailbox-cross-sender-guard-7f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  const resolution = readSource("lib/growth/provider-setup/oauth-mailbox-resolution.ts")
  const dashboard = readSource("lib/growth/provider-setup/dashboard.ts")
  const googleStart = readSource("app/api/platform/growth/provider-setup/google/start/route.ts")
  const microsoftStart = readSource("app/api/platform/growth/provider-setup/microsoft/start/route.ts")
  const mailboxRepo = readSource("lib/growth/mailboxes/mailbox-repository.ts")

  assert.match(resolution, /isMailboxOwnedBySender/)
  assert.match(resolution, /resolveOAuthConnectionMailboxId/)
  assert.match(resolution, /resolveOAuthStartMailboxPointer/)
  assert.match(resolution, /mailbox_stale_cross_sender_ignored/)
  assert.match(resolution, /settings_mailbox_cross_sender_ignored/)
  assert.match(resolution, /start_stale_mailbox_ignored/)
  assert.match(resolution, /mailbox_created/)
  assert.match(resolution, /mailbox_repaired/)

  assert.match(dashboard, /resolveOAuthConnectionMailboxId/)
  assert.match(dashboard, /logProviderOAuthMailboxFlow\("mailbox_created"/)
  assert.match(dashboard, /validation_message/)
  assert.match(dashboard, /validationMessage \?\? validated\.health_reason/)
  assert.doesNotMatch(dashboard, /existing\?\.mailbox_connection_id[\s\S]*mailboxId = existing\.mailbox_connection_id/)

  assert.match(googleStart, /resolveOAuthStartMailboxPointer/)
  assert.match(googleStart, /pendingSettingsMailboxConnectionId/)
  assert.match(microsoftStart, /resolveOAuthStartMailboxPointer/)
  assert.match(microsoftStart, /pendingSettingsMailboxConnectionId/)

  assert.match(mailboxRepo, /validation_message: validation\.message/)

  const liveValidation = readSource("lib/growth/mailboxes/google-mailbox-live-validation.ts")
  assert.match(liveValidation, /does not match mailbox record/)

  console.log("growth-mailbox-cross-sender-guard-7f: ok")
}

main()

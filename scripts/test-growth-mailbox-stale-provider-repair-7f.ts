/**
 * GS-GROWTH-MAIL-7F — Stale provider mailbox link repair script certification.
 * Run: pnpm test:growth-mailbox-stale-provider-repair-7f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertCliSafeImports(relativePath: string, source: string): void {
  assert.doesNotMatch(source, /["']server-only["']/, `${relativePath} must not import server-only`)
  assert.doesNotMatch(source, /next\/headers/, `${relativePath} must not import next/headers`)
  assert.doesNotMatch(source, /from ["']@\/components\//, `${relativePath} must not import components`)
  assert.doesNotMatch(source, /from ["']@\/app\//, `${relativePath} must not import app routes`)
  assert.doesNotMatch(
    source,
    /oauth-mailbox-resolution/,
    `${relativePath} must not import oauth-mailbox-resolution (server-only)`,
  )
  assert.doesNotMatch(
    source,
    /google-oauth-flow-log/,
    `${relativePath} must not import google-oauth-flow-log (server-only)`,
  )
}

function main(): void {
  const repairLib = readSource("lib/growth/provider-setup/repair-mailbox-stale-provider-links.ts")
  const repairScript = readSource("scripts/repair-growth-mailbox-stale-provider-links.ts")
  const pkg = readSource("package.json")

  assertCliSafeImports("lib/growth/provider-setup/repair-mailbox-stale-provider-links.ts", repairLib)
  assertCliSafeImports("scripts/repair-growth-mailbox-stale-provider-links.ts", repairScript)

  assert.match(repairLib, /auditStaleProviderMailboxLinks/)
  assert.match(repairLib, /repairStaleProviderMailboxLinks/)
  assert.match(repairLib, /mailbox_connection_id: null/)
  assert.match(repairLib, /recommended_action: "clear_mailbox_connection_id"/)
  assert.match(repairLib, /logRepairMailboxLinkCliEvent/)
  assert.doesNotMatch(repairLib, /logProviderOAuthMailboxFlow/)
  assert.doesNotMatch(repairLib, /updateSenderAccount/)
  assert.doesNotMatch(repairLib, /\.delete\(/)
  assert.doesNotMatch(repairLib, /\.from\("delivery_routes"\)/)

  assert.match(repairScript, /createClient/)
  assert.match(repairScript, /bootstrapVerifiedChannelsCertEnv/)
  assert.match(repairScript, /--dry-run/)
  assert.match(repairScript, /--confirm/)
  assert.match(repairScript, /GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM/)
  assert.match(repairScript, /logRepairMailboxLinkCliEvent/)

  assert.match(pkg, /growth:repair-mailbox-links/)
  assert.match(pkg, /test:growth-mailbox-cross-sender-guard-7f/)
  assert.match(pkg, /test:growth-mailbox-stale-provider-repair-7f/)

  console.log("growth-mailbox-stale-provider-repair-7f: ok")
}

main()

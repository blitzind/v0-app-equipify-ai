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

function main(): void {
  const repairLib = readSource("lib/growth/provider-setup/repair-mailbox-stale-provider-links.ts")
  const repairScript = readSource("scripts/repair-growth-mailbox-stale-provider-links.ts")
  const pkg = readSource("package.json")

  assert.match(repairLib, /auditStaleProviderMailboxLinks/)
  assert.match(repairLib, /repairStaleProviderMailboxLinks/)
  assert.match(repairLib, /mailbox_connection_id: null/)
  assert.match(repairLib, /recommended_action: "clear_mailbox_connection_id"/)
  assert.doesNotMatch(repairLib, /logProviderOAuthMailboxFlow/)
  assert.doesNotMatch(repairLib, /updateSenderAccount/)
  assert.doesNotMatch(repairLib, /\.delete\(/)
  assert.doesNotMatch(repairLib, /\.from\("delivery_routes"\)/)

  assert.match(repairScript, /--dry-run/)
  assert.match(repairScript, /--confirm/)
  assert.match(repairScript, /GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM/)
  assert.match(repairScript, /logProviderOAuthMailboxFlow\("mailbox_repaired"/)

  assert.match(pkg, /growth:repair-mailbox-links/)
  assert.match(pkg, /test:growth-mailbox-cross-sender-guard-7f/)
  assert.match(pkg, /test:growth-mailbox-stale-provider-repair-7f/)

  console.log("growth-mailbox-stale-provider-repair-7f: ok")
}

main()

/**
 * GS-GROWTH-MAIL-7C — Mailbox status recompute certification.
 * Run: pnpm test:growth-mailbox-status-recompute-7c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeMailboxConnectionHealth,
  isMailboxTokenExpired,
} from "../lib/growth/mailboxes/mailbox-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  const mailboxRepo = readSource("lib/growth/mailboxes/mailbox-repository.ts")
  assert.match(mailboxRepo, /recomputeMailboxHealth/)
  assert.match(mailboxRepo, /validateMailboxConnection/)
  assert.match(mailboxRepo, /connection_health/)
  assert.match(mailboxRepo, /health_reason/)

  const dashboard = readSource("lib/growth/provider-setup/dashboard.ts")
  assert.match(dashboard, /validateMailboxConnection/)
  assert.match(dashboard, /logGrowthGoogleOAuthFlow\("status_recomputed"/)

  const connectedReadModel = readSource("lib/growth/mailboxes/connected-mailboxes-dashboard.ts")
  assert.match(connectedReadModel, /connectedMailboxes \+= 1/)
  assert.match(connectedReadModel, /connectionStatus === "connected"/)

  const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  assert.equal(isMailboxTokenExpired(futureExpiry), false)
  const healthyScore = computeMailboxConnectionHealth({
    status: "connected",
    token_expires_at: futureExpiry,
    validation_failure_count: 0,
  })
  assert.ok(healthyScore >= 80)

  const expiredScore = computeMailboxConnectionHealth({
    status: "expired",
    token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    validation_failure_count: 0,
  })
  assert.ok(expiredScore < healthyScore)

  const oauthWire = readSource("lib/growth/provider-setup/oauth-transport-auto-wire.ts")
  assert.match(oauthWire, /updateSenderAccount/)
  assert.match(oauthWire, /evaluateGrowthOutboundTransportReadiness/)

  console.log("growth-mailbox-status-recompute-7c: ok")
}

main()

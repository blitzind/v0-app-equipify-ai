/**
 * Regression checks for GE-MAIL-1B Connected Mailboxes operator dashboard.
 * Run: pnpm test:growth-connected-mailboxes
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CONNECTED_MAILBOXES_QA_MARKER,
  type GrowthConnectedMailboxRow,
} from "../lib/growth/mailboxes/connected-mailboxes-dashboard-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseRow(overrides: Partial<GrowthConnectedMailboxRow> = {}): GrowthConnectedMailboxRow {
  return {
    senderId: "s1",
    senderDisplayName: "Alice",
    email: "alice@example.com",
    domain: "example.com",
    connectionStatus: "connected",
    healthTier: "healthy",
    healthScore: 95,
    canonicalHealthState: "healthy",
    canonicalHealthLabel: "Healthy",
    warningReasons: [],
    warmupStatus: "active",
    warmupProfileId: null,
    poolMemberships: [],
    dailyCap: 50,
    dailyUsed: 5,
    lastValidationAt: new Date().toISOString(),
    mailboxId: "m1",
    mailboxTokenConfigured: true,
    senderStatus: "connected",
    deliveryRouteEnabled: true,
    providerFamily: "google",
    needsReconnect: false,
    operationalPaused: false,
    signatureStatus: "configured",
    ...overrides,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_CONNECTED_MAILBOXES_QA_MARKER, "growth-connected-mailboxes-1b-v1")

  const readModelSource = readSource("lib/growth/mailboxes/connected-mailboxes-dashboard.ts")
  assert.match(readModelSource, /buildConnectedMailboxesDashboard/)
  assert.match(readModelSource, /listSenderAccounts/)
  assert.match(readModelSource, /listMailboxConnections/)
  assert.match(readModelSource, /listSenderPools/)
  assert.match(readModelSource, /listWarmupProfiles/)
  assert.match(readModelSource, /listDeliveryRoutes/)

  const apiSource = readSource("app/api/platform/growth/mailboxes/operator-dashboard/route.ts")
  assert.match(apiSource, /buildConnectedMailboxesDashboard/)
  assert.match(apiSource, /requireGrowthCommunicationsSettingsAccess/)

  const uiSource = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(uiSource, /GrowthConnectedMailboxesDashboard/)
  assert.match(uiSource, /operator-dashboard/)
  assert.match(uiSource, /Connect Gmail/)
  assert.match(uiSource, /Reconnect Gmail/)
  assert.match(uiSource, /Remove from pool/)
  assert.match(uiSource, /Start warmup/)
  assert.match(uiSource, /\/api\/platform\/growth\/warmup\/start/)

  const warmupLabelSource = readSource("lib/growth/mailboxes/connected-mailbox-warmup-label.ts")
  assert.match(warmupLabelSource, /Ready to Generate/)

  const adminPageSource = readSource("app/(admin)/admin/growth/infrastructure/mailboxes/page.tsx")
  assert.match(adminPageSource, /GrowthConnectedMailboxesDashboard/)

  const connectedMailboxesPage = readSource(
    "app/(growth)/growth/settings/communications/connected-mailboxes/page.tsx",
  )
  assert.match(connectedMailboxesPage, /GrowthConnectedMailboxesDashboard/)

  const healthy = baseRow()
  assert.equal(healthy.canonicalHealthState, "healthy")

  const disconnected = baseRow({ connectionStatus: "error", healthTier: "critical", healthScore: 20, canonicalHealthState: "unhealthy", canonicalHealthLabel: "Unhealthy", warningReasons: ["Mailbox connection error"] })
  assert.notEqual(disconnected.connectionStatus, "connected")

  assert.match(readModelSource, /classifyMailboxCanonicalHealth/)
  assert.match(readModelSource, /canonicalHealthState/)
  assert.match(uiSource, /warningReasons/)
  assert.match(uiSource, /canonicalHealthLabel/)
  assert.match(uiSource, /warningMailboxes/)

  assert.match(readModelSource, /signatureStatus/)
  assert.match(readModelSource, /listSenderProfiles/)
  assert.match(uiSource, /Add signature/)
  assert.match(uiSource, /email-signatures/)
  assert.match(uiSource, /signatureStatus/)

  console.log("growth connected mailboxes dashboard checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

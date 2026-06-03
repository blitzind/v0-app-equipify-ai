/**
 * Regression checks for Mailbox Connection Foundation (Phase 1B).
 * Run: pnpm test:growth-mailbox-connections
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeMailboxConnectionHealth,
  isMailboxTokenExpired,
  mailboxHealthToTier,
} from "../lib/growth/mailboxes/mailbox-health"
import {
  decryptMailboxToken,
  encryptMailboxToken,
  refreshProviderToken,
  sanitizeMailboxConnectionRow,
} from "../lib/growth/mailboxes/mailbox-token-manager"
import { listMailboxProviderCapabilities } from "../lib/growth/mailboxes/mailbox-provider-registry"
import { validateMailboxConnectionStub } from "../lib/growth/mailboxes/mailbox-validation"
import {
  GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE,
  GROWTH_MAILBOX_CONNECTION_QA_MARKER,
  GROWTH_MAILBOX_TIMELINE_EVENT_TYPES,
} from "../lib/growth/mailboxes/mailbox-types"
import { GROWTH_MAILBOX_CONNECTION_SCHEMA_MIGRATION } from "../lib/growth/mailboxes/mailbox-schema-health"
import {
  GROWTH_SENDER_PROVIDER_CAPABILITIES,
} from "../lib/growth/sender/provider-sender-capabilities"

async function main(): Promise<void> {
  assert.equal(GROWTH_MAILBOX_CONNECTION_QA_MARKER, "growth-mailbox-connection-v1")
  assert.match(GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE, /encrypted|never returned/i)
  assert.equal(GROWTH_MAILBOX_TIMELINE_EVENT_TYPES.length, 5)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_MAILBOX_CONNECTION_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.mailbox_connections/)
  assert.match(migration, /mailbox_connection_events/)
  assert.match(migration, /encrypted_access_token/)
  assert.match(migration, /encrypted_refresh_token/)
  assert.match(migration, /mailbox_connected/)
  assert.match(migration, /mailbox_token_expired/)
  assert.match(migration, /deleted_at/)

  assert.equal(computeMailboxConnectionHealth({}), 100)
  assert.equal(
    computeMailboxConnectionHealth({
      status: "expired",
      token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    }),
    50,
  )
  assert.equal(computeMailboxConnectionHealth({ validation_failure_count: 4 }), 80)
  assert.equal(computeMailboxConnectionHealth({ status: "warning" }), 90)
  assert.equal(computeMailboxConnectionHealth({ status: "error" }), 75)

  assert.equal(mailboxHealthToTier(95), "healthy")
  assert.equal(mailboxHealthToTier(75), "warning")
  assert.equal(mailboxHealthToTier(55), "degraded")
  assert.equal(mailboxHealthToTier(20), "critical")

  assert.equal(isMailboxTokenExpired(new Date(Date.now() - 1000).toISOString()), true)
  assert.equal(isMailboxTokenExpired(new Date(Date.now() + 60_000).toISOString()), false)

  const encrypted = encryptMailboxToken("secret-access-token")
  assert.ok(encrypted)
  assert.notEqual(encrypted, "secret-access-token")
  assert.equal(decryptMailboxToken(encrypted), "secret-access-token")

  assert.equal(refreshProviderToken({ provider_family: "google", encrypted_refresh_token: "x" }), "supported")
  assert.equal(refreshProviderToken({ provider_family: "smtp", encrypted_refresh_token: "x" }), "unsupported")
  assert.equal(refreshProviderToken({ provider_family: "google", encrypted_refresh_token: null }), "failed")

  const stripped = sanitizeMailboxConnectionRow({
    id: "mb-1",
    encrypted_access_token: "cipher",
    encrypted_refresh_token: "cipher2",
    email_address: "ops@example.com",
  })
  assert.equal(stripped.email_address, "ops@example.com")
  assert.equal("encrypted_access_token" in stripped, false)
  assert.equal("encrypted_refresh_token" in stripped, false)

  const capabilities = listMailboxProviderCapabilities()
  assert.equal(capabilities.length, 4)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsMailboxConnection, true)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsTokenRefresh, true)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.smtp.supportsTokenRefresh, false)

  const validation = validateMailboxConnectionStub({
    provider_family: "google",
    email_address: "ops@example.com",
    status: "pending",
    token_configured: false,
  })
  assert.equal(validation.valid, false)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/mailboxes/mailbox-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /softDeleteMailboxConnection/)
  assert.match(repoSource, /encryptMailboxToken/)
  assert.match(repoSource, /appendMailboxTimelineEvent/)
  assert.match(repoSource, /mailbox_connected/)
  assert.match(repoSource, /mailbox_validation_failed/)
  assert.match(repoSource, /mapSummary/)
  assert.doesNotMatch(repoSource, /return.*encrypted_access_token/i)

  const apiSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/mailboxes/route.ts"),
    "utf8",
  )
  assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  assert.doesNotMatch(apiSource, /encrypted_access_token|encrypted_refresh_token/)

  const eventsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/mailboxes/mailbox-events.ts"),
    "utf8",
  )
  assert.match(eventsSource, /createMailboxConnectionEvent/)
  assert.match(eventsSource, /mailbox_disconnected/)

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-mailbox-connections-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /Mailbox Health/)
  assert.match(uiSource, /Reconnect Gmail/)
  assert.match(uiSource, /provider-setup\/google\/start/)
  assert.match(uiSource, /GROWTH_MAILBOX_CONNECTION_QA_MARKER/)

  const oauthCompleteSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/provider-setup/dashboard.ts"),
    "utf8",
  )
  assert.match(oauthCompleteSource, /getMailboxConnectionBySender/)
  assert.match(oauthCompleteSource, /validateMailboxConnection/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/infrastructure\/mailboxes/)

  console.log("growth-mailbox-connections: all checks passed")
}

void main()

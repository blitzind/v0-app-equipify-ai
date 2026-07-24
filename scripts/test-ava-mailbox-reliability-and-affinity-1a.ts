/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Focused certification (no live send).
 *
 * Run: pnpm test:ava-mailbox-reliability-and-affinity-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { classifyMailboxCanonicalHealth } from "../lib/growth/mailboxes/mailbox-canonical-health"
import { classifyOAuthRefreshFailure } from "../lib/growth/mailboxes/mailbox-oauth-diagnostics"
import { isMailboxAccessTokenRefreshable } from "../lib/growth/mailboxes/mailbox-token-refresh-service"
import { AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER } from "../lib/growth/outbound-sender-affinity/outbound-sender-affinity-service"
import { MAILBOX_OAUTH_FAILURE_QA_MARKER } from "../lib/growth/mailboxes/mailbox-oauth-failure-types"

const CERTIFICATION_ID = AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A focused certification`)

  runGate("Schema migration defines atomic sender assignment claim RPC", () => {
    const migration = readSource("supabase/migrations/20270724160000_outbound_sender_assignments_1a.sql")
    assert.match(migration, /growth\.outbound_sender_assignments/)
    assert.match(migration, /idx_outbound_sender_assignments_active_unique/)
    assert.match(migration, /growth\.claim_outbound_sender_assignment/)
    assert.match(migration, /on conflict do nothing/i)
  })

  runGate("Expired access token with refresh token stays refreshable, not disconnected", () => {
    const repo = readSource("lib/growth/mailboxes/mailbox-repository.ts")
    assert.match(repo, /if \(!hasRefreshToken\)/)
    assert.match(repo, /nextStatus = "expired"/)
    assert.match(repo, /writeMailboxAccessTokenRefreshRequired/)

    const expiredAt = new Date(Date.now() - 60_000).toISOString()
    const health = classifyMailboxCanonicalHealth({
      connectionStatus: "connected",
      healthTier: "healthy",
      healthScore: 95,
      tokenExpiresAt: expiredAt,
      tokenConfigured: true,
      refreshTokenConfigured: true,
      accessTokenRefreshRequired: true,
      validationFailureCount: 0,
      needsReconnect: false,
    })
    assert.notEqual(health.state, "unhealthy")
    assert.match(health.warningReasons.join(" "), /refresh required/i)
  })

  runGate("Pre-send guard invokes canonical refresh before blocking", () => {
    const guards = readSource("lib/growth/compliance/pre-send-infrastructure-guards.ts")
    const readiness = readSource("lib/growth/mailboxes/mailbox-pre-send-readiness.ts")
    assert.match(guards, /ensureMailboxReadyForOutboundSend/)
    assert.match(readiness, /refreshMailboxTokensForSenderIfNeeded/)
  })

  runGate("Refresh token cannot be wiped by null update", () => {
    const repo = readSource("lib/growth/mailboxes/mailbox-repository.ts")
    assert.match(repo, /existingEncryptedRefresh/)
    assert.match(repo, /if \(nextRefresh \|\| !existingEncryptedRefresh\)/)
    const loader = readSource("lib/growth/mailboxes/mailbox-credential-loader.ts")
    assert.match(loader, /if \(refreshed\.refreshToken\?\.trim\(\)\)/)
  })

  runGate("OAuth failure taxonomy persists structured metadata", () => {
    const invalidGrant = classifyOAuthRefreshFailure({
      message: "invalid_grant: Token has been expired or revoked.",
      providerErrorCode: "invalid_grant",
    })
    assert.equal(invalidGrant.category, "invalid_grant")
    assert.equal(invalidGrant.reconnectRequired, true)
    assert.equal(invalidGrant.retryable, false)

    const transient = classifyOAuthRefreshFailure({
      message: "Google token refresh failed: upstream 503 temporarily unavailable",
    })
    assert.equal(transient.category, "transient_provider_failure")
    assert.equal(transient.reconnectRequired, false)
    assert.equal(transient.retryable, true)

    assert.match(readSource("lib/growth/mailboxes/mailbox-oauth-failure-types.ts"), /mailbox-oauth-failure-1a-v1/)
  })

  runGate("isMailboxAccessTokenRefreshable distinguishes reconnect vs refresh", () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString()
    assert.equal(
      isMailboxAccessTokenRefreshable({
        tokenExpiresAt: expiredAt,
        refreshTokenConfigured: true,
        reconnectRequired: false,
      }),
      true,
    )
    assert.equal(
      isMailboxAccessTokenRefreshable({
        tokenExpiresAt: expiredAt,
        refreshTokenConfigured: true,
        reconnectRequired: true,
      }),
      false,
    )
  })

  runGate("Ava approval binds durable sender affinity", () => {
    const approval = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-approval-service.ts")
    assert.match(approval, /resolveAvaSupervisedOutboundSenderBundle/)
    assert.match(approval, /senderAssignmentId/)
    assert.match(approval, /assignmentSource/)
    const types = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-1a-types.ts")
    assert.match(types, /senderAssignmentId/)
    assert.match(types, /mailboxConnectionId/)
  })

  runGate("Bundle verification rejects stale sender assignment after migration", () => {
    const bundle = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-bundle-verification.ts")
    assert.match(bundle, /approval_sender_assignment_stale/)
    assert.match(bundle, /approval_sender_assignment_mismatch/)
    const migration = readSource("lib/growth/outbound-sender-affinity/outbound-sender-migration-service.ts")
    assert.match(migration, /invalidateAvaSupervisedApprovalsForSenderMigration/)
  })

  runGate("Primary-sender policy when no pool configured — no silent global fallback", () => {
    const affinity = readSource("lib/growth/outbound-sender-affinity/outbound-sender-affinity-service.ts")
    assert.match(affinity, /resolveSupervisedApprovedSenderAccountId/)
    assert.match(affinity, /assignmentSource: "primary_sender"/)
    assert.match(affinity, /resolveConfiguredAvaSenderPoolId/)
    assert.doesNotMatch(affinity, /listSenderAccounts[\s\S]*find\([\s\S]*connected/)
  })

  runGate("Follow-ups and replies resolve sender affinity first", () => {
    const sequence = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
    assert.match(sequence, /fetchActiveOutboundSenderAssignment/)
    const reply = readSource("lib/growth/replies/reply-send-builder.ts")
    assert.match(reply, /fetchActiveOutboundSenderAssignment/)
  })

  runGate("Assigned sender unhealthy blocks instead of rotating", () => {
    const affinity = readSource("lib/growth/outbound-sender-affinity/outbound-sender-affinity-service.ts")
    assert.match(affinity, /blocked_reconnect/)
    assert.match(affinity, /paused_capacity/)
    assert.match(affinity, /ensureAssignedSenderReadyForSend/)
  })

  runGate("Operator workspace shows sending-from assignment", () => {
    const ui = readSource("components/growth/growth-ava-operator-workspace-review.tsx")
    assert.match(ui, /Sending from/)
    assert.match(ui, /Sender assigned when approved/)
    assert.match(ui, /readAvaSupervisedOutboundApprovalBinding/)
  })

  runGate("Connected mailboxes dashboard distinguishes refresh required vs reconnect", () => {
    const dashboard = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
    assert.match(dashboard, /accessTokenRefreshRequired/)
    assert.match(dashboard, /refresh automatically before send/)
  })

  console.log(`\n[${CERTIFICATION_ID}] PASS`)
}

main()

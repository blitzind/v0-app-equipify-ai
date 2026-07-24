/**
 * AVA-MAILBOX-CREDENTIAL-RESOLUTION-HOTFIX-1A — Focused certification.
 *
 * Run: pnpm test:ava-mailbox-credential-resolution-hotfix-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  MAILBOX_CREDENTIAL_LOADER_QA_MARKER,
  resolveEncryptedMailboxToken,
} from "../lib/growth/mailboxes/mailbox-credential-loader"
import { encryptMailboxToken } from "../lib/growth/mailboxes/mailbox-token-manager"

const CERTIFICATION_ID = MAILBOX_CREDENTIAL_LOADER_QA_MARKER

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
  console.log(`[${CERTIFICATION_ID}] AVA-MAILBOX-CREDENTIAL-RESOLUTION-HOTFIX-1A certification`)

  runGate("Canonical credential loader is shared by transport and readiness", () => {
    const transport = readSource("lib/growth/providers/transport/transport-repository.ts")
    const readiness = readSource("lib/growth/mailboxes/mailbox-pre-send-readiness.ts")
    const refresh = readSource("lib/growth/mailboxes/mailbox-token-refresh-service.ts")
    assert.match(transport, /loadMailboxCredentialsForSender/)
    assert.match(readiness, /loadMailboxCredentialsForSender/)
    assert.match(refresh, /loadMailboxCredentialsForSender/)
  })

  runGate("Missing encrypted token produces refresh_token_missing, not decryption failure", () => {
    const missing = resolveEncryptedMailboxToken(null)
    assert.equal(missing.encryptedPresent, false)
    assert.equal(missing.decryptionFailed, false)
    assert.equal(missing.plaintext, null)
  })

  runGate("Encrypted token resolves through canonical encrypt/decrypt path", () => {
    const encrypted = encryptMailboxToken("refresh-token-value")
    assert.ok(encrypted)
    const resolved = resolveEncryptedMailboxToken(encrypted)
    assert.equal(resolved.encryptedPresent, true)
    assert.equal(resolved.decryptionFailed, false)
    assert.equal(resolved.plaintext, "refresh-token-value")
  })

  runGate("Decryption failure is distinct from missing token in credential loader", () => {
    const loader = readSource("lib/growth/mailboxes/mailbox-credential-loader.ts")
    assert.match(loader, /credential_decryption_failed/)
    assert.match(loader, /refresh_token_missing/)
    assert.match(loader, /decryptionFailed/)
    const refresh = readSource("lib/growth/mailboxes/mailbox-token-refresh-service.ts")
    assert.doesNotMatch(refresh, /if \(!refreshToken\)[\s\S]{0,120}refresh_token_missing/)
  })

  runGate("Assignment eligibility does not force refresh when access token is valid", () => {
    const readiness = readSource("lib/growth/mailboxes/mailbox-pre-send-readiness.ts")
    assert.match(readiness, /ensureMailboxEligibleForSenderAssignment/)
    assert.match(readiness, /if \(!accessExpired\)/)
    const affinity = readSource("lib/growth/outbound-sender-affinity/outbound-sender-affinity-service.ts")
    assert.match(affinity, /forAssignment/)
    assert.match(affinity, /purpose\?: "assignment" \| "transport"/)
    assert.match(
      readSource("lib/growth/outbound-sender-affinity/ava-supervised-outbound-sender-resolution.ts"),
      /purpose: "assignment"/,
    )
  })

  runGate("Transport readiness proves credentials via canonical loader", () => {
    const readiness = readSource("lib/growth/mailboxes/mailbox-pre-send-readiness.ts")
    assert.match(readiness, /refreshIfExpired: false/)
    assert.match(readiness, /refreshMailboxTokensForSenderIfNeeded/)
  })

  runGate("Probe B performs approve → assign → send without pre-existing assignment", () => {
    const probe = readSource("scripts/probe-ava-mailbox-reliability-and-affinity-1a.ts")
    assert.match(probe, /bindAvaSupervisedOutboundApproval/)
    assert.match(probe, /fetchActiveOutboundSenderAssignment/)
    assert.match(probe, /sendApprovedAvaSupervisedGeneration/)
    assert.match(probe, /resolveSequenceExecutionSender/)
    assert.doesNotMatch(probe, /run supervised approval\/send first/)
  })

  runGate("Credential diagnostic never prints token values", () => {
    const loader = readSource("lib/growth/mailboxes/mailbox-credential-loader.ts")
    assert.match(loader, /diagnoseMailboxCredentialsForSender/)
    assert.doesNotMatch(loader, /console\.log\(.*accessToken/)
    const probe = readSource("scripts/probe-ava-mailbox-reliability-and-affinity-1a.ts")
    assert.match(probe, /diagnoseMailboxCredentialsForSender/)
    assert.match(probe, /encryptedRefreshPresent/)
    assert.doesNotMatch(probe, /accessToken:/)
  })

  runGate("Credential pepper resolves lazily at decrypt time", () => {
    const crypto = readSource("lib/growth/outbound/credentials-crypto.ts")
    assert.doesNotMatch(crypto, /const PEPPER = resolveCredentialPepper\(\)/)
    assert.match(crypto, /resolveCredentialPepper\(\)/)
  })

  console.log(`\n[${CERTIFICATION_ID}] PASS`)
}

main()

/**
 * Regression checks for Growth Engine compliance suppression (Phase 2F).
 * Run: pnpm test:growth-compliance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyBounce,
  hashComplianceEmail,
  isHardBounceType,
  maskEmailHash,
} from "../lib/growth/compliance/bounce-classifier"
import {
  computeSenderReputationScore,
  tierFromSenderReputationScore,
  SENDER_REPUTATION_PENALTIES,
  buildSenderReputationSnapshot,
} from "../lib/growth/compliance/sender-reputation"
import {
  GROWTH_COMPLIANCE_PRIVACY_NOTE,
  GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
  GROWTH_COMPLIANCE_TIMELINE_EVENT_TYPES,
  maskComplianceEmailHash,
} from "../lib/growth/compliance/compliance-types"
import { GROWTH_COMPLIANCE_SCHEMA_MIGRATION } from "../lib/growth/compliance/compliance-schema-health"
import { complianceHealthLabel } from "../lib/growth/compliance/suppression-health"

async function main(): Promise<void> {
  assert.equal(GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER, "growth-compliance-suppression-v1")
  assert.match(GROWTH_COMPLIANCE_PRIVACY_NOTE, /hashed recipient/i)
  assert.match(GROWTH_COMPLIANCE_PRIVACY_NOTE, /no autonomous/i)
  assert.deepEqual(GROWTH_COMPLIANCE_TIMELINE_EVENT_TYPES, [
    "bounce_detected",
    "hard_bounce_detected",
    "unsubscribe_detected",
    "complaint_detected",
    "suppression_applied",
    "sender_reputation_declined",
  ])

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_COMPLIANCE_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.email_bounces/)
  assert.match(migration, /growth\.email_complaints/)
  assert.match(migration, /growth\.unsubscribe_registry/)
  assert.match(migration, /growth\.delivery_suppressions/)
  assert.match(migration, /bounce_detected/)
  assert.match(migration, /suppression_applied/)
  assert.match(migration, /service role only/)

  const hard = classifyBounce({ providerReason: "550 user unknown" })
  assert.equal(hard.bounceType, "hard")
  assert.equal(hard.shouldSuppress, true)
  assert.equal(hard.retryAllowed, false)

  const soft = classifyBounce({ providerReason: "452 mailbox full temporary" })
  assert.equal(soft.bounceType, "soft")
  assert.equal(soft.shouldSuppress, false)
  assert.equal(soft.retryAllowed, true)

  const spam = classifyBounce({ providerReason: "spam complaint abuse" })
  assert.equal(spam.bounceType, "spam")
  assert.equal(spam.shouldSuppress, true)

  assert.equal(isHardBounceType("hard"), true)
  assert.equal(isHardBounceType("soft"), false)

  const hash = hashComplianceEmail("Lead@Example.com")
  assert.ok(hash.length >= 16)
  assert.equal(hash, hashComplianceEmail("lead@example.com"))
  assert.notEqual(hash, "lead@example.com")
  assert.equal(maskEmailHash(hash), maskComplianceEmailHash(hash))

  let score = computeSenderReputationScore({
    hardBounces: 1,
    softBounces: 0,
    complaints: 0,
    spamEvents: 0,
    cleanDays: 0,
  })
  assert.equal(score, 100 - SENDER_REPUTATION_PENALTIES.hard_bounce)

  score = computeSenderReputationScore({
    hardBounces: 0,
    softBounces: 0,
    complaints: 1,
    spamEvents: 1,
    cleanDays: 5,
  })
  assert.equal(
    score,
    100 - SENDER_REPUTATION_PENALTIES.complaint - SENDER_REPUTATION_PENALTIES.spam_event + 5 * 2,
  )

  assert.equal(tierFromSenderReputationScore(85), "healthy")
  assert.equal(tierFromSenderReputationScore(65), "monitor")
  assert.equal(tierFromSenderReputationScore(45), "warning")
  assert.equal(tierFromSenderReputationScore(20), "critical")

  const snapshot = buildSenderReputationSnapshot({
    hardBounces: 2,
    softBounces: 1,
    complaints: 0,
    spamEvents: 0,
    cleanDays: 3,
  })
  assert.ok(snapshot.score <= 100)
  assert.ok(["healthy", "monitor", "warning", "critical"].includes(snapshot.tier))

  assert.equal(complianceHealthLabel("healthy"), "Healthy")

  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/transport/transport-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestrator, /assertPreSendSuppressionAllowed/)
  assert.match(orchestrator, /Delivery blocked by compliance/)

  for (const route of [
    "app/api/platform/growth/compliance/bounce/route.ts",
    "app/api/platform/growth/compliance/unsubscribe/route.ts",
    "app/api/platform/growth/compliance/complaint/route.ts",
    "app/api/platform/growth/compliance/dashboard/route.ts",
    "app/api/platform/growth/compliance/suppressions/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), route), "utf8")
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.doesNotMatch(source, /smtp_password|apiKey|access_token/)
  }

  const smtpSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/adapters/smtp-provider.ts"),
    "utf8",
  )
  assert.doesNotMatch(smtpSource, /from \"net\"|from \"tls\"/)

  const complianceUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-compliance-dashboard.tsx"),
    "utf8",
  )
  assert.match(complianceUi, /Hard bounce rate/)
  assert.match(complianceUi, /Suppression table/)
  assert.doesNotMatch(complianceUi, /adapter-registry|suppression-engine|compliance-repository/)

  const deliveryUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-provider-delivery-dashboard.tsx"),
    "utf8",
  )
  assert.match(deliveryUi, /Compliance status/)
  assert.match(deliveryUi, /Suppression protection/)
  assert.doesNotMatch(deliveryUi, /adapter-registry/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/providers\/compliance/)

  console.log("growth-compliance-suppression-v1: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

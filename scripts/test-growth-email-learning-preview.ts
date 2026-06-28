/**
 * GE-EI-IMP-4C — Email learning preview certification.
 * Run: pnpm test:growth-email-learning-preview-cert
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import {
  assertPreviewOutputHasNoPlaintextEmails,
  GROWTH_EMAIL_LEARNING_PREVIEW_QA_MARKER,
  runEmailLearningPreview,
  type EmailLearningPreviewOutput,
  type EmailLearningPreviewSourceKey,
} from "./reconstruct-email-learning-preview"

const EXPECTED_SOURCE_KEYS: EmailLearningPreviewSourceKey[] = [
  "delivery_attempts",
  "provider_delivery_events",
  "message_events",
  "outbound_replies",
  "email_bounces",
  "email_complaints",
  "contact_verifications",
  "lead_timeline_events",
]

function assertPreviewShape(output: EmailLearningPreviewOutput): void {
  assert.equal(output.qa_marker, GROWTH_EMAIL_LEARNING_PREVIEW_QA_MARKER)
  assert.ok(output.mode === "fixture" || output.mode === "live")
  assert.ok(Number.isFinite(output.limit) && output.limit > 0)

  for (const key of EXPECTED_SOURCE_KEYS) {
    assert.ok(output.sources[key], `missing source key: ${key}`)
    assert.ok(typeof output.sources[key].rows === "number")
    assert.ok(typeof output.sources[key].observations === "number")
    assert.ok(typeof output.sources[key].skipped === "number")
  }

  assert.ok(typeof output.summary.observations_created === "number")
  assert.ok(typeof output.summary.duplicates_removed === "number")
  assert.ok(typeof output.summary.invalid_records_skipped === "number")
  assert.ok(typeof output.summary.unsupported_events_skipped === "number")
  assert.ok(typeof output.summary.domains_discovered === "number")
  assert.ok(Array.isArray(output.top_domains))
  assert.ok(Array.isArray(output.pattern_preview))
  assert.ok(Array.isArray(output.skipped_sources))
  assert.ok(Array.isArray(output.warnings))
}

async function main(): Promise<void> {
  console.log("\n=== GE-EI-IMP-4C Email Learning Preview Certification ===\n")

  assert.equal(GROWTH_EMAIL_LEARNING_PREVIEW_QA_MARKER, "growth-email-learning-preview-v1")

  const fixtureDirect = await runEmailLearningPreview(["--fixture"])
  assertPreviewShape(fixtureDirect)
  assert.equal(fixtureDirect.mode, "fixture")
  assert.ok(fixtureDirect.summary.observations_created > 0)
  assert.ok(fixtureDirect.summary.domains_discovered > 0)
  assert.ok(fixtureDirect.top_domains.length > 0)
  assert.ok(fixtureDirect.pattern_preview.length > 0)
  assert.ok(
    fixtureDirect.top_domains.some((row) => row.domain === "acme.com"),
    "expected acme.com in domain preview",
  )
  assert.ok(
    assertPreviewOutputHasNoPlaintextEmails(fixtureDirect),
    "fixture output must not contain plaintext emails",
  )

  const fixtureRepeat = await runEmailLearningPreview(["--fixture", "--limit=250"])
  assert.deepEqual(fixtureDirect, fixtureRepeat, "fixture output must be deterministic")

  const subprocessOutput = execSync("tsx scripts/reconstruct-email-learning-preview.ts --fixture", {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  })
  const subprocessParsed = JSON.parse(subprocessOutput) as EmailLearningPreviewOutput
  assertPreviewShape(subprocessParsed)
  assert.equal(subprocessParsed.mode, "fixture")
  assert.ok(
    assertPreviewOutputHasNoPlaintextEmails(subprocessParsed),
    "subprocess fixture output must not contain plaintext emails",
  )
  console.log("  ✓ Fixture mode runs without Supabase credentials")
  console.log("  ✓ JSON output is valid with expected source keys")
  console.log("  ✓ Domain and pattern previews present")
  console.log("  ✓ No plaintext emails in fixture output")

  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const liveMissing = await runEmailLearningPreview([])
    assertPreviewShape(liveMissing)
    assert.equal(liveMissing.mode, "live")
    assert.ok(liveMissing.warnings.includes("supabase_credentials_missing"))
    assert.deepEqual(liveMissing.skipped_sources, EXPECTED_SOURCE_KEYS)
    assert.equal(liveMissing.summary.observations_created, 0)
    assert.ok(
      assertPreviewOutputHasNoPlaintextEmails(liveMissing),
      "live credential-missing output must not contain plaintext emails",
    )
    console.log("  ✓ Live mode exits gracefully when credentials are missing")
  } finally {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY
  }

  console.log("\nGE-EI-IMP-4C email learning preview certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
